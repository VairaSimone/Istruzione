'use strict';

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');

/**
 * Controller Auth — livello sottile tra route e service.
 * NON contiene logica di business: solo estrazione parametri dalla request
 * e formattazione della response.
 */

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
exports.register = catchAsync(async (req, res) => {
  const { nome, cognome, eta, email, password, classe } = req.body;

  const utente = await authService.registraUtente({ nome, cognome, eta, email, password, classe });

  res.status(201).json({
    status: 'success',
    message: 'Registrazione completata. Puoi effettuare il login.',
    data: {
      utente: utente.toPublicJSON(),
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const risultato = await authService.loginUtente(email, password);

  res.status(200).json({
    status: 'success',
    message: 'Login effettuato con successo.',
    data: risultato,
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
exports.logout = catchAsync(async (req, res) => {
  // req.user è stato iniettato da authenticateJWT
  await authService.logoutUtente(req.user.id);

  res.status(200).json({
    status: 'success',
    message: 'Logout effettuato con successo.',
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
exports.me = catchAsync(async (req, res) => {
  // req.user è già stato caricato e sanitizzato dal middleware authenticateJWT
  const { id, nome, cognome, eta, email, ruolo, classe } = req.user;

  res.status(200).json({
    status: 'success',
    data: {
      utente: { id, nome, cognome, eta, email, ruolo, classe },
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/refresh-token
// ─────────────────────────────────────────────
exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  const risultato = await authService.refreshAccessToken(refreshToken);

  res.status(200).json({
    status: 'success',
    message: 'Access token rinnovato.',
    data: risultato,
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const risultato = await authService.forgotPassword(email);

  // Risposta sempre 200 per non rivelare se l'email esiste
  res.status(200).json({
    status: 'success',
    message: 'Se l\'email è registrata, riceverai le istruzioni per il reset della password.',
    // tokenDebug presente solo in sviluppo (viene da authService)
    ...(risultato.tokenDebug && { _debug_token: risultato.tokenDebug }),
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
exports.resetPassword = catchAsync(async (req, res) => {
  const { token, nuovaPassword } = req.body;

  await authService.resetPassword(token, nuovaPassword);

  res.status(200).json({
    status: 'success',
    message: 'Password aggiornata con successo. Puoi effettuare il login.',
  });
});

// ─────────────────────────────────────────────
// PATCH /api/auth/change-email
// ─────────────────────────────────────────────
exports.changeEmail = catchAsync(async (req, res) => {
  const { nuovaEmail } = req.body;
  const userId = req.user.id;

  const utenteAggiornato = await authService.changeEmail(userId, nuovaEmail);

  res.status(200).json({
    status: 'success',
    message: 'Email aggiornata con successo.',
    data: {
      utente: utenteAggiornato,
    },
  });
});
