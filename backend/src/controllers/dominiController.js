'use strict';

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const dominiService = require('../services/dominiService');

/**
 * DominiController — livello sottile tra route e DominiService.
 *
 * I domini sono gestiti sotto due percorsi speculari (cfr. scuolaRoutes):
 *   - `/api/scuole/mia/domini`     → la PROPRIA scuola (staff): lo `scuolaId`
 *     viene dal token (`req.user.scuola_id`);
 *   - `/api/scuole/:id/domini`     → una scuola qualsiasi (admin): lo `scuolaId`
 *     viene dal parametro di percorso.
 *
 * `risolviScuolaId` sceglie la sorgente corretta, così i due gruppi di route
 * condividono gli stessi handler.
 */

const risolviScuolaId = (req) => {
  if (req.params && req.params.id) return req.params.id;
  if (req.user && req.user.scuola_id) return req.user.scuola_id;
  throw new AppError('Il tuo account non è associato ad alcuna scuola.', 403, 'NO_SCUOLA');
};

// GET .../domini
exports.elencoDomini = catchAsync(async (req, res) => {
  const domini = await dominiService.elencoDomini(req.user, risolviScuolaId(req));
  res.status(200).json({ status: 'success', results: domini.length, data: { domini } });
});

// POST .../domini
exports.aggiungiDominio = catchAsync(async (req, res) => {
  const { dominio, principale, note } = req.body;
  const creato = await dominiService.aggiungiDominio(req.user, risolviScuolaId(req), {
    dominio,
    principale,
    note,
  });
  res.status(201).json({
    status: 'success',
    message: creato.verificato
      ? 'Dominio aggiunto e verificato.'
      : 'Dominio aggiunto. Un amministratore deve verificarlo prima che diventi attivo.',
    data: { dominio: creato },
  });
});

// PATCH .../domini/:dominioId
exports.aggiornaDominio = catchAsync(async (req, res) => {
  const { verificato, principale, note } = req.body;
  const aggiornato = await dominiService.aggiornaDominio(
    req.user,
    risolviScuolaId(req),
    req.params.dominioId,
    { verificato, principale, note }
  );
  res.status(200).json({
    status: 'success',
    message: 'Dominio aggiornato con successo.',
    data: { dominio: aggiornato },
  });
});

// DELETE .../domini/:dominioId
exports.rimuoviDominio = catchAsync(async (req, res) => {
  await dominiService.rimuoviDominio(req.user, risolviScuolaId(req), req.params.dominioId);
  res.status(200).json({ status: 'success', message: 'Dominio rimosso con successo.' });
});
