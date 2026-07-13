'use strict';

const catchAsync = require('../utils/catchAsync');
const scuolaService = require('../services/scuolaService');

/**
 * ScuolaController — livello sottile tra route e ScuolaService.
 *
 * Due piani distinti:
 *   - ANAGRAFICA delle scuole (creazione, elenco, eliminazione, scuola
 *     predefinita): riservata all'admin, che è trasversale ai tenant;
 *   - IMPOSTAZIONI della propria scuola (branding, colori, tema, contatti,
 *     funzionalità attive): leggibili da ogni utente autenticato, modificabili
 *     dallo staff della scuola stessa.
 */

// ─────────────────────────────────────────────
// POST /api/scuole  (admin)
// ─────────────────────────────────────────────
exports.creaScuola = catchAsync(async (req, res) => {
  const {
    nome,
    slug,
    impostazioni,
    attiva,
    predefinita,
    limiteStorageGb,
    limiteUtenti,
    limiteInsegnanti,
    dominio,
  } = req.body;

  const scuola = await scuolaService.creaScuola({
    nome,
    slug,
    impostazioni,
    attiva,
    predefinita,
    limiteStorageGb,
    limiteUtenti,
    limiteInsegnanti,
    dominio,
  });

  res.status(201).json({
    status: 'success',
    message: 'Scuola creata con successo.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole  (admin)
// ─────────────────────────────────────────────
exports.elencoScuole = catchAsync(async (req, res) => {
  const { q, page, limit, attiva } = req.query;

  const { scuole, paginazione } = await scuolaService.elencoScuole({ q, page, limit, attiva });

  res.status(200).json({
    status: 'success',
    results: scuole.length,
    data: { scuole },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole/mia  (qualsiasi utente autenticato)
// La scuola del richiedente con le impostazioni complete (null per l'admin).
// ─────────────────────────────────────────────
exports.miaScuola = catchAsync(async (req, res) => {
  const scuola = await scuolaService.scuolaCorrente(req.user);

  res.status(200).json({
    status: 'success',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole/mia/impostazioni  (qualsiasi utente autenticato)
// Solo il blob delle impostazioni: è ciò che il frontend applica al tema.
// ─────────────────────────────────────────────
exports.mieImpostazioni = catchAsync(async (req, res) => {
  const impostazioni = await scuolaService.impostazioniCorrenti(req.user);

  res.status(200).json({
    status: 'success',
    data: { impostazioni },
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole/mia/quota  (insegnante | admin della propria scuola)
// Occupazione vs limiti (storage/utenti/insegnanti) della PROPRIA scuola.
// ─────────────────────────────────────────────
exports.mieQuota = catchAsync(async (req, res) => {
  const quota = await scuolaService.quotaScuola(req.user, req.user.scuola_id);

  res.status(200).json({
    status: 'success',
    data: { quota },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/scuole/mia/impostazioni  (insegnante | admin)
// Merge per sezione sulle impostazioni della PROPRIA scuola.
// ─────────────────────────────────────────────
exports.aggiornaMieImpostazioni = catchAsync(async (req, res) => {
  const { impostazioni } = req.body;

  const scuola = await scuolaService.aggiornaImpostazioni(req.user.scuola_id, impostazioni, req.user);

  res.status(200).json({
    status: 'success',
    message: 'Impostazioni della scuola aggiornate con successo.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole/:id  (admin)
// ─────────────────────────────────────────────
exports.dettaglioScuola = catchAsync(async (req, res) => {
  const scuola = await scuolaService.dettaglioScuola(req.params.id);

  res.status(200).json({
    status: 'success',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole/:id/quota  (admin)
// Occupazione vs limiti di una scuola qualsiasi.
// ─────────────────────────────────────────────
exports.quotaScuola = catchAsync(async (req, res) => {
  const quota = await scuolaService.quotaScuola(req.user, req.params.id);

  res.status(200).json({
    status: 'success',
    data: { quota },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/scuole/:id  (admin) — anagrafica e/o impostazioni (sostituzione)
// ─────────────────────────────────────────────
exports.aggiornaScuola = catchAsync(async (req, res) => {
  const {
    nome,
    slug,
    impostazioni,
    attiva,
    predefinita,
    limiteStorageGb,
    limiteUtenti,
    limiteInsegnanti,
  } = req.body;

  const scuola = await scuolaService.aggiornaScuola(req.params.id, {
    nome,
    slug,
    impostazioni,
    attiva,
    predefinita,
    limiteStorageGb,
    limiteUtenti,
    limiteInsegnanti,
  });

  res.status(200).json({
    status: 'success',
    message: 'Scuola aggiornata con successo.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/scuole/:id/impostazioni  (admin) — MERGE per sezione
// ─────────────────────────────────────────────
exports.aggiornaImpostazioni = catchAsync(async (req, res) => {
  const { impostazioni } = req.body;

  const scuola = await scuolaService.aggiornaImpostazioni(req.params.id, impostazioni, req.user);

  res.status(200).json({
    status: 'success',
    message: 'Impostazioni della scuola aggiornate con successo.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// POST /api/scuole/:id/blocca  (admin)
// Sospende la scuola: nessun utente (nemmeno gli studenti) può più accedere.
// I dati restano intatti. Reversibile con /sblocca.
// ─────────────────────────────────────────────
exports.bloccaScuola = catchAsync(async (req, res) => {
  const scuola = await scuolaService.impostaStatoScuola(req.params.id, false);

  res.status(200).json({
    status: 'success',
    message: 'Scuola bloccata: gli accessi sono sospesi.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// POST /api/scuole/:id/sblocca  (admin)
// Riattiva una scuola precedentemente bloccata.
// ─────────────────────────────────────────────
exports.sbloccaScuola = catchAsync(async (req, res) => {
  const scuola = await scuolaService.impostaStatoScuola(req.params.id, true);

  res.status(200).json({
    status: 'success',
    message: 'Scuola sbloccata: gli accessi sono di nuovo consentiti.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/scuole/:id  (admin)
// `?forza=true` elimina la scuola e TUTTI i suoi dati (irreversibile).
// ─────────────────────────────────────────────
exports.eliminaScuola = catchAsync(async (req, res) => {
  const forza = req.query.forza === 'true' || req.query.forza === '1';

  await scuolaService.eliminaScuola(req.params.id, { forza });

  res.status(200).json({
    status: 'success',
    message: forza
      ? 'Scuola e tutti i suoi dati eliminati definitivamente.'
      : 'Scuola eliminata con successo.',
  });
});
