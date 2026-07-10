'use strict';

const { Op } = require('sequelize');
const Scuola = require('../models/Scuola');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const piattaforma = require('../config/piattaforma');
const {
  applicaDefault,
  impostazioniPubbliche,
  funzionalitaDi,
  vocabolario,
} = require('../constants/impostazioniScuola');
const { funzionalitaPredefinite } = require('../constants/funzionalita');

/**
 * ImpostazioniService — punto d'accesso UNICO alla configurazione di un tenant.
 *
 * Ogni richiesta autenticata può aver bisogno di sapere se una sezione è
 * abilitata per la scuola dell'utente. Interrogare `scuole` a ogni richiesta
 * sarebbe uno spreco: le impostazioni cambiano di rado (un pannello di
 * amministrazione), mentre le letture sono continue.
 *
 * Perciò questo service mantiene una CACHE IN MEMORIA con TTL breve,
 * invalidata esplicitamente a ogni scrittura. La cache è per-processo: in un
 * deploy multi-istanza il TTL garantisce comunque la convergenza entro pochi
 * secondi. Se in futuro servisse invalidazione immediata cross-istanza, basterà
 * sostituire l'implementazione di `_cache` con Redis: l'interfaccia pubblica
 * (`perScuola`, `funzionalita`, `invalida`) resta identica.
 *
 * SEPARAZIONE DELLE RESPONSABILITÀ
 *   - `constants/impostazioniScuola.js` → forma e validazione del blob;
 *   - questo file                       → recupero, cache, risoluzione del tenant;
 *   - `scuolaService.js`                → scritture (CRUD delle scuole);
 *   - `middleware/funzionalita.js`      → applicazione del gate sulle route.
 */

// TTL della cache in millisecondi. Volutamente breve: le impostazioni sono
// piccole, ricaricarle costa una SELECT su chiave primaria.
const TTL_MS = Math.max(1000, parseInt(process.env.SETTINGS_CACHE_TTL_MS, 10) || 30000);

/** @type {Map<string, {scadenza:number, valore:any}>} */
const _cache = new Map();

const _leggi = (chiave) => {
  const voce = _cache.get(chiave);
  if (!voce) return undefined;
  if (voce.scadenza < Date.now()) {
    _cache.delete(chiave);
    return undefined;
  }
  return voce.valore;
};

const _scrivi = (chiave, valore) => {
  _cache.set(chiave, { scadenza: Date.now() + TTL_MS, valore });
  return valore;
};

/**
 * Invalida la cache. Senza argomenti svuota tutto (usato dai test e dopo le
 * operazioni che toccano più scuole).
 * @param {?string} scuolaId
 */
const invalida = (scuolaId = null) => {
  if (!scuolaId) {
    _cache.clear();
    return;
  }
  _cache.delete(`id:${String(scuolaId)}`);
  // Lo slug e il flag `predefinita` possono essere cambiati dalla stessa
  // scrittura: le voci derivate vanno rimosse in blocco.
  for (const chiave of _cache.keys()) {
    if (chiave.startsWith('slug:') || chiave === 'predefinita') _cache.delete(chiave);
  }
};

// ─────────────────────────────────────────────
// Recupero della scuola
// ─────────────────────────────────────────────

/** Scuola per id (con cache). `null` se inesistente. */
const perId = async (scuolaId) => {
  if (!scuolaId) return null;
  const chiave = `id:${String(scuolaId)}`;
  const inCache = _leggi(chiave);
  if (inCache !== undefined) return inCache;

  const scuola = await Scuola.findByPk(scuolaId);
  return _scrivi(chiave, scuola || null);
};

/** Scuola per slug (con cache). `null` se inesistente. */
const perSlug = async (slug) => {
  if (!slug) return null;
  const chiave = `slug:${String(slug).toLowerCase()}`;
  const inCache = _leggi(chiave);
  if (inCache !== undefined) return inCache;

  const scuola = await Scuola.findOne({ where: { slug: String(slug).toLowerCase() } });
  return _scrivi(chiave, scuola || null);
};

/**
 * Scuola PREDEFINITA, con questa precedenza:
 *   1. la scuola marcata `predefinita = true`;
 *   2. la scuola il cui slug coincide con `DEFAULT_SCHOOL_SLUG`;
 *   3. l'unica scuola esistente, se e solo se ce n'è esattamente una
 *      (deploy mono-scuola: nessuna configurazione necessaria);
 *   4. `null` (deploy multi-scuola senza predefinita: il frontend deve
 *      indicare il tenant).
 */
const predefinita = async () => {
  const inCache = _leggi('predefinita');
  if (inCache !== undefined) return inCache;

  let scuola = await Scuola.findOne({ where: { predefinita: true, attiva: true } });

  if (!scuola && piattaforma.SCUOLA_PREDEFINITA_SLUG) {
    scuola = await Scuola.findOne({
      where: { slug: piattaforma.SCUOLA_PREDEFINITA_SLUG, attiva: true },
    });
  }

  if (!scuola) {
    const attive = await Scuola.findAll({ where: { attiva: true }, limit: 2 });
    if (attive.length === 1) scuola = attive[0];
  }

  return _scrivi('predefinita', scuola || null);
};

/**
 * Risolve il tenant di una richiesta NON autenticata:
 *   `?scuola=<slug|uuid>` → header `X-Scuola` → scuola predefinita.
 *
 * @param {import('express').Request} req
 * @returns {Promise<?Scuola>}
 */
const risolviTenantRichiesta = async (req) => {
  const grezzo =
    (req.query && req.query.scuola) ||
    (req.headers && req.headers[piattaforma.HEADER_TENANT]) ||
    null;

  if (!grezzo) return predefinita();

  const valore = String(grezzo).trim();
  // Un UUID è accettato per comodità degli strumenti interni; lo slug è la via
  // canonica per il frontend.
  const sembraUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valore);
  const scuola = sembraUuid ? await perId(valore) : await perSlug(valore);

  if (!scuola || !scuola.attiva) return null;
  return scuola;
};

// ─────────────────────────────────────────────
// Viste delle impostazioni
// ─────────────────────────────────────────────

/**
 * Impostazioni COMPLETE (con default) della scuola indicata.
 * Se `scuolaId` è null (admin trasversale) restituisce i soli default della
 * piattaforma: l'admin non ha un tenant proprio.
 */
const perScuola = async (scuolaId) => {
  const scuola = await perId(scuolaId);
  return applicaDefault(scuola ? scuola.impostazioni : {}, scuola ? scuola.nome : null);
};

/** Vista pubblica (branding) per il frontend non autenticato. */
const brandingPubblico = (scuola) => {
  if (!scuola) {
    // Nessun tenant risolto: si serve l'identità della PIATTAFORMA, così la
    // pagina di login ha comunque colori e nome coerenti.
    return {
      id: null,
      slug: null,
      nome: piattaforma.NOME,
      impostazioni: impostazioniPubbliche({}, piattaforma.NOME),
    };
  }
  return scuola.toBrandingJSON();
};

/**
 * Mappa risolta delle funzionalità della scuola.
 *
 * REGOLA CHIAVE: se `scuolaId` è null il richiedente è l'ADMIN (trasversale),
 * che deve poter amministrare qualunque sezione a prescindere dai flag di una
 * singola scuola. Riceve quindi i default della piattaforma, tutti attivi
 * tranne le funzionalità opzionali.
 */
const funzionalita = async (scuolaId) => {
  if (!scuolaId) return funzionalitaPredefinite();
  const scuola = await perId(scuolaId);
  if (!scuola) {
    // Fail-closed: un utente che punta a una scuola inesistente non abilita nulla.
    throw new AppError('La scuola associata al tuo account non esiste più.', 403, 'SCUOLA_NOT_FOUND');
  }
  if (!scuola.attiva) {
    throw new AppError('La tua scuola è temporaneamente sospesa.', 403, 'SCUOLA_SOSPESA');
  }
  return funzionalitaDi(scuola.impostazioni);
};

/** True se la sezione è abilitata per la scuola (admin: sempre true). */
const funzionalitaAttiva = async (scuolaId, chiave) => {
  const mappa = await funzionalita(scuolaId);
  return Boolean(mappa[chiave]);
};

/**
 * Vocabolario didattico della scuola (`classiDisponibili`, `livelliDisponibili`,
 * `materieDisponibili`). Un array VUOTO significa «nessun vincolo»: il campo
 * corrispondente è a testo libero.
 *
 * @param {?string} scuolaId
 * @param {'classiDisponibili'|'livelliDisponibili'|'materieDisponibili'} nome
 */
const vocabolarioScuola = async (scuolaId, nome) => {
  const scuola = await perId(scuolaId);
  if (!scuola) return [];
  return vocabolario(scuola.impostazioni, nome);
};

/**
 * Verifica che un valore appartenga al vocabolario della scuola.
 * Vocabolario vuoto ⇒ qualunque valore non vuoto è ammesso (testo libero).
 * Valore assente ⇒ ammesso (i campi sono facoltativi).
 *
 * @throws {AppError} 422 se il valore non è nel vocabolario
 */
const assicuraNelVocabolario = async (scuolaId, nome, valore, etichetta) => {
  if (valore === undefined || valore === null || valore === '') return null;
  const voci = await vocabolarioScuola(scuolaId, nome);
  if (!voci.length) return String(valore).trim();

  const v = String(valore).trim();
  if (!voci.includes(v)) {
    throw new AppError(
      `${etichetta} deve essere uno dei valori configurati dalla scuola: ${voci.join(', ')}.`,
      422,
      'VALORE_FUORI_VOCABOLARIO'
    );
  }
  return v;
};

/**
 * Valore di una singola impostazione della sezione `didattica`, con default.
 * Scorciatoia tipizzata per i service che non hanno bisogno dell'intero blob.
 *
 * @param {?string} scuolaId
 * @param {string} campo  es. 'accessoLiberoTemplate'
 */
const impostazioneDidattica = async (scuolaId, campo) => {
  const complete = await perScuola(scuolaId);
  return complete.didattica[campo];
};

/** Utilità per i test/CLI: numero di voci attualmente in cache. */
const dimensioneCache = () => _cache.size;

logger.debug(`[IMPOSTAZIONI] Cache impostazioni scuola attiva (TTL ${TTL_MS} ms).`);

module.exports = {
  TTL_MS,
  invalida,
  perId,
  perSlug,
  predefinita,
  risolviTenantRichiesta,
  perScuola,
  brandingPubblico,
  funzionalita,
  funzionalitaAttiva,
  vocabolarioScuola,
  impostazioneDidattica,
  assicuraNelVocabolario,
  dimensioneCache,
  // Riesportato per comodità dei chiamanti che filtrano le scuole attive.
  Op,
};
