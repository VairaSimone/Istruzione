'use strict';

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const {
  baseCookieOptions,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} = require('../config/cookies');
const { setCsrfCookie } = require('../middleware/csrf');

/**
 * Controller Auth — livello sottile tra route e service.
 * NON contiene logica di business: solo estrazione parametri dalla request
 * e formattazione della response.
 */

const clearAuthCookies = (res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('csrf_token', { httpOnly: false });
};

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
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const { accessToken, refreshToken } = await authService.loginUtente(email, password);

  res.cookie('access_token', accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie('refresh_token', refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  setCsrfCookie(res);

  res.status(200).json({
    status: 'success',
    message: 'Login effettuato con successo',
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
exports.logout = catchAsync(async (req, res, next) => {
  await authService.logoutUtente(req.user.id);

  clearAuthCookies(res);

  res.status(200).json({
    status: 'success',
    message: 'Logout completato con successo',
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
exports.me = catchAsync(async (req, res) => {
  const { id, nome, cognome, eta, email, ruolo, classe, lingua, email_verificata } = req.user;

  // Rinnova il cookie CSRF, così è disponibile dopo un refresh di pagina
  // anche per sessioni preesistenti.
  setCsrfCookie(res);

  res.status(200).json({
    status: 'success',
    data: {
      utente: { id, nome, cognome, eta, email, ruolo, classe, lingua, email_verificata },
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/refresh-token
// ─────────────────────────────────────────────
exports.refreshToken = catchAsync(async (req, res, next) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return next(new AppError('Refresh token mancante.', 401, 'NO_REFRESH_TOKEN'));
  }

  const tokens = await authService.refreshAccessToken(refreshToken);

  res.cookie('access_token', tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  setCsrfCookie(res);

  res.status(200).json({
    status: 'success',
    data: {
      accessToken: tokens.accessToken,
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const risultato = await authService.forgotPassword(email);
  res.status(200).json({
    status: 'success',
    message: 'Se l\'email è registrata, riceverai le istruzioni per il reset della password.',
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
// POST /api/auth/verify-email
// ─────────────────────────────────────────────
exports.verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  await authService.verificaEmail(token);

  res.status(200).json({
    status: 'success',
    message: 'Email verificata con successo! Ora puoi effettuare il login.',
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/request-email-change
// ─────────────────────────────────────────────
exports.requestEmailChange = catchAsync(async (req, res) => {
  const { nuovaEmail } = req.body;
  const userId = req.user.id;

  const tokenVerifica = await authService.richiediCambioEmail(userId, nuovaEmail);

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

  await authService.confermaCambioEmail(token);

  res.status(200).json({
    status: 'success',
    message: 'Indirizzo email aggiornato con successo.',
  });
});

// ─────────────────────────────────────────────
// DELETE /api/auth/me
// ─────────────────────────────────────────────
exports.deleteMe = catchAsync(async (req, res) => {
  await authService.eliminaAccount(req.user.id);

  clearAuthCookies(res);

  res.status(204).send();
});

// ─────────────────────────────────────────────
// GET /api/auth/gestione/utenti (Solo Insegnanti)
// ─────────────────────────────────────────────
exports.getAllUsers = catchAsync(async (req, res) => {
  const { ruolo, classe, nome, page, limit } = req.query;

  const { utenti, paginazione } = await authService.getUtentiPerInsegnante({ ruolo, classe, nome, page, limit });

  res.status(200).json({
    status: 'success',
    results: utenti.length,
    data: {
      utenti,
    },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// PATCH /api/auth/gestione/utenti/:id/ruolo (Solo Insegnanti)
// ─────────────────────────────────────────────
exports.updateUserRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { ruolo } = req.body;

  const utenteAggiornato = await authService.aggiornaRuoloUtente(req.user.id, id, ruolo);

  res.status(200).json({
    status: 'success',
    message: 'Ruolo dell\'utente aggiornato con successo.',
    data: {
      utente: utenteAggiornato,
    },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/auth/gestione/utenti/:id (Solo Insegnanti)
// ─────────────────────────────────────────────
exports.deleteUserByTeacher = catchAsync(async (req, res) => {
  const { id } = req.params;

  await authService.eliminaUtenteComeInsegnante(req.user.id, id);

  res.status(200).json({
    status: 'success',
    message: 'L\'account dell\'utente è stato eliminato definitivamente dall\'insegnante.',
  });
});

// ─────────────────────────────────────────────
// PATCH /api/auth/me/lingua
// ─────────────────────────────────────────────
exports.updateLanguage = catchAsync(async (req, res) => {
  const { lingua } = req.body;

  if (!['it', 'en'].includes(lingua)) {
    return res.status(400).json({ status: 'fail', message: 'Lingua non supportata.' });
  }

  const utente = await Utente.findByPk(req.user.id);
  utente.lingua = lingua;
  await utente.save();

  res.status(200).json({
    status: 'success',
    message: req.t('messages.langChanged'),
    data: { utente: utente.toPublicJSON() },
  });
});