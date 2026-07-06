'use strict';

const catchAsync = require('../utils/catchAsync');
const inviteService = require('../services/inviteService');

/**
 * InviteController — livello sottile tra route e InviteService.
 * Gestione degli inviti: creazione (studente/insegnante), validazione token
 * pubblica, elenco, revoca.
 */

// ─────────────────────────────────────────────
// POST /api/invites/student  (insegnante / admin)
// ─────────────────────────────────────────────
exports.creaInvitoStudente = catchAsync(async (req, res) => {
  const { email, classe, scuolaId } = req.body;

  const { invito, tokenDebug } = await inviteService.creaInvitoStudente({
    email,
    classe,
    scuolaId,
    richiedente: req.user,
    lingua: req.user.lingua,
  });

  res.status(201).json({
    status: 'success',
    message: 'Invito studente creato e inviato via email.',
    data: { invito: invito.toPublicJSON() },
    ...(tokenDebug && { _debug_token: tokenDebug }),
  });
});

// ─────────────────────────────────────────────
// POST /api/invites/teacher  (solo admin — onboarding diretto)
// ─────────────────────────────────────────────
exports.creaInvitoInsegnante = catchAsync(async (req, res) => {
  const { email, scuolaId } = req.body;

  const { invito, tokenDebug } = await inviteService.creaInvitoInsegnante({
    email,
    scuolaId,
    richiedente: req.user,
    lingua: req.user.lingua,
  });

  res.status(201).json({
    status: 'success',
    message: 'Invito insegnante creato e inviato via email.',
    data: { invito: invito.toPublicJSON() },
    ...(tokenDebug && { _debug_token: tokenDebug }),
  });
});

// ─────────────────────────────────────────────
// GET /api/invites/validate/:token  (PUBBLICA)
// Usata dal frontend per pre-compilare/validare il form di registrazione.
// ─────────────────────────────────────────────
exports.validaToken = catchAsync(async (req, res) => {
  const { token } = req.params;

  const dati = await inviteService.validaTokenInvito(token);

  res.status(200).json({
    status: 'success',
    data: { invito: dati },
  });
});

// ─────────────────────────────────────────────
// GET /api/invites  (insegnante / admin)
// ─────────────────────────────────────────────
exports.elencoInviti = catchAsync(async (req, res) => {
  const { stato, ruolo, email, page, limit } = req.query;

  const { inviti, paginazione } = await inviteService.elencoInviti({
    richiedente: req.user,
    stato, ruolo, email, page, limit,
  });

  res.status(200).json({
    status: 'success',
    results: inviti.length,
    data: { inviti: inviti.map((i) => i.toPublicJSON()) },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// DELETE /api/invites/:id  (autore / admin)
// ─────────────────────────────────────────────
exports.revocaInvito = catchAsync(async (req, res) => {
  const { id } = req.params;

  const invito = await inviteService.revocaInvito(req.user, id);

  res.status(200).json({
    status: 'success',
    message: 'Invito revocato con successo.',
    data: { invito },
  });
});
