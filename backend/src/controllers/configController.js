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
// GET /api/config  (pubblico)
// ─────────────────────────────────────────────
exports.configurazione = catchAsync(async (req, res) => {
  const scuola = await impostazioniService.risolviTenantRichiesta(req);
  const branding = impostazioniService.brandingPubblico(scuola);

  res.status(200).json({
    status: 'success',
    data: {
      piattaforma: {
        nome: piattaforma.NOME,
        descrizione: piattaforma.DESCRIZIONE,
        versione: piattaforma.VERSIONE,
      },
      scuola: branding,
      // Catalogo completo: descrittori + stato di abilitazione per questa
      // scuola. Il frontend costruisce il menu da qui, senza elenchi cablati.
      funzionalita: catalogoFunzionalita(branding.impostazioni.funzionalita),
    },
  });
});

// ─────────────────────────────────────────────
// GET /api/config/scuole  (pubblico)
// Elenco minimale delle scuole attive: serve al selettore di tenant nella
// pagina di login dei deploy multi-scuola. Espone solo slug, nome e logo.
// ─────────────────────────────────────────────
exports.elencoScuolePubblico = catchAsync(async (req, res) => {
  const Scuola = require('../models/Scuola');
  const scuole = await Scuola.findAll({
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
