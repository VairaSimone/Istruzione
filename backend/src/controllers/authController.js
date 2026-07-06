'use strict';

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const {
  baseCookieOptions,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} = require('../config/cookies');
const { setCsrfCookie } = require('../middleware/csrf');

/**
 * AuthController — livello sottile tra route e AuthService.
 * Responsabilità: autenticazione (register, login, logout, refresh,
 * verify email, resend verification, forgot/reset password, google auth).
 * NON contiene logica di business.
 */

const clearAuthCookies = (res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('csrf_token', { httpOnly: false });
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('access_token', accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refresh_token', refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  setCsrfCookie(res);
};

// ─────────────────────────────────────────────
// POST /api/auth/register-student
// Completamento registrazione studente tramite token di invito.
// Email e classe sono ereditate dall'invito; l'utente invia solo
// nome, cognome, età e password.
// ─────────────────────────────────────────────
exports.registerStudent = catchAsync(async (req, res) => {
  const { token, nome, cognome, eta, password } = req.body;

  // La validazione dell'invito (token_hash, stato, scadenza, ruolo) è gestita
  // in modo transazionale e atomico dentro il service, che eredita email e
  // classe dall'invito e — se l'invito è legato a un'aula — vi iscrive lo studente.
  const utente = await authService.registraStudenteDaInvito({
    token, nome, cognome, eta, password,
  });

  res.status(201).json({
    status: 'success',
    message: 'Registrazione completata. Ora puoi effettuare il login.',
    data: { utente: utente.toPublicJSON() },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/register-teacher
// Completamento registrazione insegnante tramite token di invito creato
// da un admin (onboarding diretto). Nessuna classe.
// ─────────────────────────────────────────────
exports.registerTeacher = catchAsync(async (req, res) => {
  const { token, nome, cognome, password } = req.body;

  const utente = await authService.registraInsegnanteDaInvito({
    token, nome, cognome, password,
  });

  res.status(201).json({
    status: 'success',
    message: 'Registrazione completata. Ora puoi effettuare il login.',
    data: { utente: utente.toPublicJSON() },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { accessToken, refreshToken } = await authService.loginUtente(email, password);

  setAuthCookies(res, accessToken, refreshToken);

  res.status(200).json({
    status: 'success',
    message: 'Login effettuato con successo',
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
exports.logout = catchAsync(async (req, res) => {
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
  const { id, nome, cognome, eta, email, ruolo, classe, stato, lingua, email_verificata, profilo_completo } = req.user;

  // Rinnova il cookie CSRF, così è disponibile dopo un refresh di pagina
  // anche per sessioni preesistenti.
  setCsrfCookie(res);

  res.status(200).json({
    status: 'success',
    data: {
      utente: { id, nome, cognome, eta, email, ruolo, classe, stato, lingua, email_verificata, profilo_completo },
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

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  res.status(200).json({
    status: 'success',
    data: { accessToken: tokens.accessToken },
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
// POST /api/auth/resend-verification
// Risposta SEMPRE generica (anti user-enumeration).
// ─────────────────────────────────────────────
exports.resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;

  const risultato = await authService.reinviaVerificaEmail(email);

  res.status(200).json({
    status: 'success',
    message: 'Se l\'indirizzo è registrato e non ancora verificato, riceverai una nuova email di verifica.',
    ...(risultato.tokenDebug && { _debug_token: risultato.tokenDebug }),
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
// GET /api/auth/google/callback
// La GoogleStrategy ha già popolato req.user con i token applicativi.
// Imposta i cookie e reindirizza al frontend.
// ─────────────────────────────────────────────
exports.googleCallback = catchAsync(async (req, res) => {
  const { accessToken, refreshToken } = req.user;

  setAuthCookies(res, accessToken, refreshToken);

  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  const successPath = process.env.GOOGLE_SUCCESS_REDIRECT || '/dashboard';
  res.redirect(`${base}${successPath}`);
});

// ─────────────────────────────────────────────
// Reindirizzamento in caso di fallimento OAuth Google
// ─────────────────────────────────────────────
exports.googleFailure = (req, res) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${base}/login?error=google`);
};
