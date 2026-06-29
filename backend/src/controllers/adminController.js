'use strict';
const Scuola = require('../models/Scuola');
const catchAsync = require('../utils/catchAsync');
const adminService = require('../services/adminService');
exports.createSchool = catchAsync(async (req, res) => {
  const { nome } = req.body;
  const scuola = await Scuola.create({ nome });
  res.status(201).json({ status: 'success', data: { scuola } });
});

exports.getSchools = catchAsync(async (req, res) => {
  const scuole = await Scuola.findAll();
  res.status(200).json({ status: 'success', data: { scuole } });
});
/**
 * AdminController — livello sottile tra route e AdminService.
 * Gestione delle candidature insegnante (elenco / approvazione / rifiuto).
 */

// ─────────────────────────────────────────────
// GET /api/admin/teacher-requests  (solo admin)
// ─────────────────────────────────────────────
exports.elencoCandidature = catchAsync(async (req, res) => {
  const { stato, nome, page, limit } = req.query;

  const { candidature, paginazione } = await adminService.elencoCandidatureInsegnante({
    stato, nome, page, limit,
  });

  res.status(200).json({
    status: 'success',
    results: candidature.length,
    data: { candidature },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// POST /api/admin/teacher-requests/:id/approve  (solo admin)
// ─────────────────────────────────────────────
exports.approvaCandidatura = catchAsync(async (req, res) => {
  const { id } = req.params;

  const utente = await adminService.approvaInsegnante(req.user.id, id);

  res.status(200).json({
    status: 'success',
    message: 'Insegnante approvato con successo.',
    data: { utente },
  });
});

// ─────────────────────────────────────────────
// POST /api/admin/teacher-requests/:id/reject  (solo admin)
// ─────────────────────────────────────────────
exports.rifiutaCandidatura = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { motivazione } = req.body;

  const utente = await adminService.rifiutaInsegnante(req.user.id, id, motivazione);

  res.status(200).json({
    status: 'success',
    message: 'Candidatura insegnante rifiutata.',
    data: { utente },
  });
});
