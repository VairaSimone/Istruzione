'use strict';

const catchAsync = require('../utils/catchAsync');
const userService = require('../services/userService');

/**
 * UserController — livello sottile tra route e UserService.
 * Responsabilità: gestione utenti e account (cambio email, eliminazione
 * account, lingua, operazioni amministrative dell'insegnante).
 */

const clearAuthCookies = (res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('csrf_token', { httpOnly: false });
};

// ─────────────────────────────────────────────
// POST /api/auth/request-email-change
// ─────────────────────────────────────────────
exports.requestEmailChange = catchAsync(async (req, res) => {
  const { nuovaEmail } = req.body;
  const userId = req.user.id;

  const tokenVerifica = await userService.richiediCambioEmail(userId, nuovaEmail);

  res.status(200).json({
    status: 'success',
    message: 'Richiesta di cambio email presa in carico. Controlla la tua NUOVA casella postale.',
    ...(process.env.NODE_ENV !== 'production' && { _debug_token: tokenVerifica }),
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/confirm-email-change
// ─────────────────────────────────────────────
exports.confirmEmailChange = catchAsync(async (req, res) => {
  const { token } = req.body;

  await userService.confermaCambioEmail(token);

  res.status(200).json({
    status: 'success',
    message: 'Indirizzo email aggiornato con successo.',
  });
});

// ─────────────────────────────────────────────
// PATCH /api/auth/me/lingua
// ─────────────────────────────────────────────
exports.updateLanguage = catchAsync(async (req, res) => {
  const { lingua } = req.body;

  const utente = await userService.aggiornaLingua(req.user.id, lingua);

  res.status(200).json({
    status: 'success',
    message: req.t('messages.langChanged'),
    data: { utente: utente.toPublicJSON() },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/auth/me
// ─────────────────────────────────────────────
exports.deleteMe = catchAsync(async (req, res) => {
  await userService.eliminaAccount(req.user.id);

  clearAuthCookies(res);

  res.status(204).send();
});

// ─────────────────────────────────────────────
// GET /api/auth/gestione/utenti (Solo Insegnanti)
// ─────────────────────────────────────────────
exports.getAllUsers = catchAsync(async (req, res) => {
  const { ruolo, classe, nome, scuola, page, limit } = req.query;

  const { utenti, paginazione } = await userService.getUtentiPerInsegnante(
    req.user,
    { ruolo, classe, nome, scuola, page, limit }
  );

  res.status(200).json({
    status: 'success',
    results: utenti.length,
    data: { utenti },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// PATCH /api/auth/gestione/utenti/:id/ruolo (Solo Insegnanti)
// ─────────────────────────────────────────────
exports.updateUserRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { ruolo } = req.body;

  const utenteAggiornato = await userService.aggiornaRuoloUtente(req.user, id, ruolo);

  res.status(200).json({
    status: 'success',
    message: 'Ruolo dell\'utente aggiornato con successo.',
    data: { utente: utenteAggiornato },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/auth/gestione/utenti/:id (Solo Insegnanti)
// ─────────────────────────────────────────────
exports.deleteUserByTeacher = catchAsync(async (req, res) => {
  const { id } = req.params;

  await userService.eliminaUtenteComeInsegnante(req.user, id);

  res.status(200).json({
    status: 'success',
    message: 'L\'account dell\'utente è stato eliminato definitivamente dall\'insegnante.',
  });
});
