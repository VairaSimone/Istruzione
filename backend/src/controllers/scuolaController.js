'use strict';

const catchAsync = require('../utils/catchAsync');
const scuolaService = require('../services/scuolaService');

/**
 * ScuolaController — livello sottile tra route e ScuolaService.
 * Gestione delle scuole (tenant) e delle loro impostazioni. Le scritture sono
 * riservate all'admin (gate di ruolo nelle route); la lettura della propria
 * scuola è disponibile anche agli insegnanti.
 */

// ─────────────────────────────────────────────
// POST /api/scuole  (admin)
// ─────────────────────────────────────────────
exports.creaScuola = catchAsync(async (req, res) => {
  const { nome, impostazioni } = req.body;

  const scuola = await scuolaService.creaScuola({ nome, impostazioni });

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
  const { q, page, limit } = req.query;

  const { scuole, paginazione } = await scuolaService.elencoScuole({ q, page, limit });

  res.status(200).json({
    status: 'success',
    results: scuole.length,
    data: { scuole },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// GET /api/scuole/mia  (insegnante / admin)
// Restituisce la scuola del richiedente (null per l'admin, trasversale).
// ─────────────────────────────────────────────
exports.miaScuola = catchAsync(async (req, res) => {
  const scuola = await scuolaService.scuolaCorrente(req.user);

  res.status(200).json({
    status: 'success',
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
// PATCH /api/scuole/:id  (admin) — nome e/o impostazioni (sostituzione)
// ─────────────────────────────────────────────
exports.aggiornaScuola = catchAsync(async (req, res) => {
  const { nome, impostazioni } = req.body;

  const scuola = await scuolaService.aggiornaScuola(req.params.id, { nome, impostazioni });

  res.status(200).json({
    status: 'success',
    message: 'Scuola aggiornata con successo.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/scuole/:id/impostazioni  (admin) — MERGE delle chiavi fornite
// ─────────────────────────────────────────────
exports.aggiornaImpostazioni = catchAsync(async (req, res) => {
  const { impostazioni } = req.body;

  const scuola = await scuolaService.aggiornaImpostazioni(req.params.id, impostazioni);

  res.status(200).json({
    status: 'success',
    message: 'Impostazioni della scuola aggiornate con successo.',
    data: { scuola },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/scuole/:id  (admin)
// ─────────────────────────────────────────────
exports.eliminaScuola = catchAsync(async (req, res) => {
  await scuolaService.eliminaScuola(req.params.id);

  res.status(200).json({
    status: 'success',
    message: 'Scuola eliminata con successo.',
  });
});
