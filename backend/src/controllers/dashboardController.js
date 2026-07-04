'use strict';

const catchAsync = require('../utils/catchAsync');
const dashboardService = require('../services/dashboardService');

/**
 * DashboardController — livello sottile tra route e DashboardService.
 * Statistiche aggregate per il docente: per singola aula o globali.
 */

// GET /api/dashboard/aula/:classeId?giorni=&limite=
exports.dashboardAula = catchAsync(async (req, res) => {
  const { giorni, limite } = req.query;

  const dati = await dashboardService.dashboardAula({
    classeId: req.params.classeId,
    richiedente: req.user,
    opzioni: { giorni, limite },
  });

  res.status(200).json({ status: 'success', data: dati });
});

// GET /api/dashboard?giorni=&limite=
exports.dashboardGlobale = catchAsync(async (req, res) => {
  const { giorni, limite } = req.query;

  const dati = await dashboardService.dashboardGlobale({
    richiedente: req.user,
    opzioni: { giorni, limite },
  });

  res.status(200).json({ status: 'success', data: dati });
});
