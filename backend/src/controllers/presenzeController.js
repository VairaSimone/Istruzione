'use strict';

const catchAsync = require('../utils/catchAsync');
const presenzeService = require('../services/presenzeService');

/**
 * PresenzeController — livello sottile tra route e PresenzeService.
 * Due gruppi: GESTIONE APPELLO (insegnante|admin) e VISTA STUDENTE (proprie
 * presenze). Il riepilogo aula è riservato allo staff.
 */

// ═════════════════════════════ GESTIONE APPELLO ═════════════════════════════

// POST /api/presenze/registri
exports.creaRegistro = catchAsync(async (req, res) => {
  const { classeId, data, argomento, note } = req.body;

  const registro = await presenzeService.creaRegistro({
    dati: { classeId, data, argomento, note },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Appello aperto con successo.',
    data: { registro },
  });
});

// GET /api/presenze/registri
exports.elencoRegistri = catchAsync(async (req, res) => {
  const { classeId, da, a, page, limit } = req.query;

  const { registri, paginazione } = await presenzeService.elencoRegistri({
    richiedente: req.user,
    filtri: { classeId, da, a, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: registri.length,
    data: { registri },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/presenze/registri/:id
exports.dettaglioRegistro = catchAsync(async (req, res) => {
  const registro = await presenzeService.dettaglioRegistro({
    registroId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', data: { registro } });
});

// PATCH /api/presenze/registri/:id
exports.aggiornaRegistro = catchAsync(async (req, res) => {
  const { argomento, note } = req.body;

  const registro = await presenzeService.aggiornaRegistro({
    registroId: req.params.id,
    dati: { argomento, note },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Appello aggiornato con successo.',
    data: { registro },
  });
});

// DELETE /api/presenze/registri/:id
exports.eliminaRegistro = catchAsync(async (req, res) => {
  await presenzeService.eliminaRegistro({
    registroId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', message: 'Appello eliminato con successo.' });
});

// PUT /api/presenze/registri/:id/voci
exports.salvaVoci = catchAsync(async (req, res) => {
  const registro = await presenzeService.salvaVoci({
    registroId: req.params.id,
    voci: req.body.voci,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Presenze salvate con successo.',
    data: { registro },
  });
});

// GET /api/presenze/riepilogo/:classeId
exports.riepilogoAula = catchAsync(async (req, res) => {
  const riepilogo = await presenzeService.riepilogoAula({
    classeId: req.params.classeId,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', data: { riepilogo } });
});

// ═════════════════════════════ VISTA STUDENTE ═════════════════════════════

// GET /api/presenze/mie
exports.miePresenze = catchAsync(async (req, res) => {
  const { da, a } = req.query;

  const dati = await presenzeService.miePresenze({
    richiedente: req.user,
    filtri: { da, a },
  });

  res.status(200).json({
    status: 'success',
    results: dati.voci.length,
    data: dati,
  });
});
