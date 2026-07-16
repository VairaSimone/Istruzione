'use strict';

const catchAsync = require('../utils/catchAsync');
const impostazioniService = require('../services/impostazioniService');
const piattaforma = require('../config/piattaforma');
const { catalogoPubblico: catalogoFunzionalita } = require('../constants/funzionalita');
const { catalogoPubblico: catalogoTipiAttivita } = require('../constants/tipiAttivita');
const { descrizioneSchema } = require('../constants/impostazioniScuola');

/**
 * ConfigController — CONFIGURAZIONE PER IL FRONTEND.
 *
 * Espone, senza autenticazione, tutto ciò che serve al client per
 * personalizzarsi PRIMA del login: nome della scuola, logo, favicon, colori,
 * tema, immagini, contatti, social, footer e funzionalità abilitate.
 *
 * È l'endpoint che elimina ogni valore cablato nel frontend.
 *
 * FORMA DEL PAYLOAD (contratto con `frontend/src/services/configService.js`):
 *
 *   {
 *     piattaforma: { nome, descrizione, versione },
 *     scuola: { id, slug, nome, impostazioni } | branding di piattaforma,
 *     funzionalita: Record<string, boolean>,          // il GATE
 *     catalogoFunzionalita: Array<Descrittore>,       // gli INTERRUTTORI
 *   }
 *
 * Le due chiavi non sono ridondanti: la prima risponde «è attiva?», la seconda
 * descrive «che cos'è e da cosa dipende». Confonderle è costato due bug
 * silenziosi (gate sempre aperto, pannello sempre vuoto).
 *
 * RISOLUZIONE DEL TENANT (in ordine):
 *   1. `?scuola=<slug|uuid>`
 *   2. header `X-Scuola: <slug|uuid>`
 *   3. scuola marcata `predefinita`
 *   4. unica scuola esistente (deploy mono-scuola)
 *   5. nessuna → si serve l'identità della piattaforma (colori di default)
 *
 * Nessun dato riservato transita da qui: la vista pubblica è filtrata dallo
 * schema (`impostazioniScuola.impostazioniPubbliche`).
 */

// ─────────────────────────────────────────────
// CACHE DI RISPOSTA per GET /api/config
//
// Il branding cambia di rado (solo dal pannello di amministrazione), mentre il
// frontend interroga questo endpoint a ogni bootstrap. Una cache in memoria con
// TTL breve evita di ricomporre branding + catalogo funzionalità a ogni
// richiesta. Il payload NON dipende dalla lingua (nome/descrizione sono chiavi
// statiche del catalogo), quindi la chiave di cache è il solo tenant risolto.
//
// COERENZA: registrando un listener su impostazioniService.invalida(), la cache
// viene azzerata immediatamente a ogni scrittura delle impostazioni della
// scuola; il TTL è quindi solo una rete di sicurezza.
// ─────────────────────────────────────────────

// TTL in millisecondi, vincolato all'intervallo consigliato 60–120 s.
const CONFIG_TTL_MS = Math.min(
  120000,
  Math.max(60000, parseInt(process.env.CONFIG_CACHE_TTL_MS, 10) || 90000)
);

/** @type {Map<string, { scadenza: number, payload: object }>} */
const _cacheConfig = new Map();

const _leggiConfig = (chiave) => {
  const voce = _cacheConfig.get(chiave);
  if (!voce) return undefined;
  if (voce.scadenza < Date.now()) {
    _cacheConfig.delete(chiave);
    return undefined;
  }
  return voce.payload;
};

const _scriviConfig = (chiave, payload) => {
  _cacheConfig.set(chiave, { scadenza: Date.now() + CONFIG_TTL_MS, payload });
  return payload;
};

// Azzera la cache di risposta a ogni invalidazione delle impostazioni: così un
// cambio di branding è visibile subito, senza attendere la scadenza del TTL.
impostazioniService.registraInvalidazione(() => _cacheConfig.clear());

// ─────────────────────────────────────────────
// GET /api/config  (pubblico)
// ─────────────────────────────────────────────
exports.configurazione = catchAsync(async (req, res) => {
  const scuola = await impostazioniService.risolviTenantRichiesta(req);
  const chiave = scuola ? `id:${scuola.id}` : 'default';

  let payload = _leggiConfig(chiave);
  if (!payload) {
    const branding = impostazioniService.brandingPubblico(scuola);
    // Mappa risolta { chiave: boolean } della scuola: nucleo forzato a true e
    // dipendenze già propagate (cfr. `risolviFunzionalita`).
    const funzionalita = branding.impostazioni.funzionalita;
    payload = {
      piattaforma: {
        nome: piattaforma.NOME,
        descrizione: piattaforma.DESCRIZIONE,
        versione: piattaforma.VERSIONE,
      },
      scuola: branding,
      // DUE forme, due usi distinti — e finora ne mancava una.
      //
      //   `funzionalita`          MAPPA { chiave: boolean }. È il gate: serve a
      //                           rispondere «questa sezione è attiva?» in O(1).
      //   `catalogoFunzionalita`  ARRAY di descrittori (chiave, nome,
      //                           descrizione, nucleo, dipendeDa, abilitata).
      //                           Serve al pannello per generare gli interruttori.
      //
      // Qui veniva spedito il solo ARRAY sotto la chiave `funzionalita`. Il
      // frontend lo indicizzava per chiave (`funzionalita['quiz']`) ottenendo
      // sempre `undefined`, e siccome `undefined !== false` il gate passava
      // SEMPRE: nessuna sezione veniva mai nascosta. Specularmente
      // `catalogoFunzionalita` non arrivava affatto e il pannello «Impostazioni
      // scuola» restava senza interruttori — cioè la funzionalità centrale del
      // multi-tenant era irraggiungibile dalla UI.
      //
      // Questa è la forma che il JSDoc di `frontend/src/services/configService.js`
      // documenta da sempre: il contratto scritto era giusto, era il payload a
      // non rispettarlo.
      funzionalita,
      catalogoFunzionalita: catalogoFunzionalita(funzionalita),
    };
    _scriviConfig(chiave, payload);
  }

  // Cache-Control coerente col TTL applicativo: permette anche a browser e CDN
  // di riusare la risposta per la stessa finestra temporale.
  res.set('Cache-Control', `public, max-age=${Math.floor(CONFIG_TTL_MS / 1000)}`);

  res.status(200).json({ status: 'success', data: payload });
});

// ─────────────────────────────────────────────
// GET /api/config/scuole  (pubblico)
//
// Elenco minimale delle scuole attive: serve UNICAMENTE al selettore di tenant
// (`ScuolaSwitcher`) nella pagina di login dei deploy multi-scuola su dominio
// condiviso. Espone slug, nome e logo.
//
// ── PERCHÉ È CONDIZIONATO ──
// Su un deploy a domini personalizzati, questo endpoint dava a chiunque
// visitasse il sito della scuola A l'elenco completo dei clienti della
// piattaforma: nomi e loghi di tutte le scuole concorrenti, con una GET senza
// autenticazione. Non è un dato segreto, ma non è nemmeno un dato che la scuola
// A abbia acconsentito a pubblicare sul proprio sito.
//
// Se l'host risolve già un tenant, la scelta della scuola È GIÀ FATTA: il
// selettore non ha senso e l'elenco nemmeno. Rispondiamo con la sola scuola del
// dominio. L'elenco completo resta disponibile dove serve davvero — il dominio
// globale, dove il visitatore deve poter scegliere.
// ─────────────────────────────────────────────
exports.elencoScuolePubblico = catchAsync(async (req, res) => {
  const Scuola = require('../models/Scuola');

  const scuolaDelDominio = await impostazioniService.perDominio(
    req.hostname || (req.headers && req.headers.host) || null
  );

  const scuole = scuolaDelDominio
    ? [scuolaDelDominio]
    : await Scuola.findAll({
        where: { attiva: true },
        order: [['nome', 'ASC']],
        limit: 200,
      });

  const elenco = scuole.map((s) => {
    const branding = s.toBrandingJSON();
    return {
      slug: branding.slug,
      nome: branding.impostazioni.identita.nomeVisualizzato,
      logoUrl: branding.impostazioni.identita.logoUrl,
    };
  });

  res.status(200).json({
    status: 'success',
    results: elenco.length,
    data: { scuole: elenco },
  });
});

// ─────────────────────────────────────────────
// GET /api/config/schema  (pubblico)
// Descrizione dichiarativa dello schema delle impostazioni: consente al
// pannello di amministrazione di generare il form dinamicamente, senza
// duplicare l'elenco dei campi lato frontend.
// ─────────────────────────────────────────────
exports.schemaImpostazioni = catchAsync(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      schema: descrizioneSchema(),
      funzionalita: catalogoFunzionalita(),
      tipiAttivita: catalogoTipiAttivita(),
    },
  });
});
