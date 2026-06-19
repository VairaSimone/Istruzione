'use strict';

const express = require('express');
const router = express.Router();

// Controller
const authController = require('../controllers/authController');

// Middleware
const { authenticateJWT } = require('../middleware/auth');
const { loginLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

// Validatori
const {
  validateRegistrazione,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangeEmail,
  validateRefreshToken,
  validateVerifyEmail,
} = require('../validators/authValidators');

/**
 * DOCUMENTAZIONE ROUTE
 *
 * POST /api/auth/register
 *   Middleware: validateRegistrazione, validate
 *   Body: { nome, cognome, eta, email, password, classe }
 *   Response 201: { status, message, data: { utente } }
 *   Response 409: email già usata
 *   Response 422: dati non validi
 *
 * POST /api/auth/login
 *   Middleware: loginLimiter, validateLogin, validate
 *   Body: { email, password }
 *   Response 200: { status, message, data: { accessToken, refreshToken, utente } }
 *   Response 401: credenziali errate
 *   Response 429: troppi tentativi
 *
 * POST /api/auth/logout
 *   Middleware: authenticateJWT
 *   Headers: Authorization: Bearer <accessToken>
 *   Response 200: { status, message }
 *   Response 401: non autenticato
 *
 * GET /api/auth/me
 *   Middleware: authenticateJWT
 *   Headers: Authorization: Bearer <accessToken>
 *   Response 200: { status, data: { utente: { id, nome, cognome, eta, email, ruolo, classe } } }
 *   Response 401: non autenticato
 *
 * POST /api/auth/refresh-token
 *   Middleware: validateRefreshToken, validate
 *   Body: { refreshToken }
 *   Response 200: { status, message, data: { accessToken } }
 *   Response 401: token non valido o scaduto
 *
 * POST /api/auth/forgot-password
 *   Middleware: forgotPasswordLimiter, validateForgotPassword, validate
 *   Body: { email }
 *   Response 200: { status, message } (sempre, per sicurezza)
 *   Response 422: email non valida
 *   Response 429: troppi tentativi
 *
 * POST /api/auth/reset-password
 *   Middleware: validateResetPassword, validate
 *   Body: { token, nuovaPassword }
 *   Response 200: { status, message }
 *   Response 400: token non valido o scaduto
 *   Response 422: dati non validi
 *
 * PATCH /api/auth/change-email
 *   Middleware: authenticateJWT, validateChangeEmail, validate
 *   Headers: Authorization: Bearer <accessToken>
 *   Body: { nuovaEmail }
 *   Response 200: { status, message, data: { utente } }
 *   Response 401: non autenticato
 *   Response 409: email già in uso
 *   Response 422: email non valida
 */

// Route pubbliche (non richiedono autenticazione)
router.post('/register', validateRegistrazione, validate, authController.register);
router.post('/login', loginLimiter, validateLogin, validate, authController.login);
router.post('/refresh-token', validateRefreshToken, validate, authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, validate, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, validate, authController.resetPassword);
router.post('/verify-email', validateVerifyEmail, validate, authController.verifyEmail);
// Route protette (richiedono access token valido)
router.post('/logout', authenticateJWT, authController.logout);
router.get('/me', authenticateJWT, authController.me);
router.patch('/change-email', authenticateJWT, validateChangeEmail, validate, authController.changeEmail);
router.post('/request-email-change', authenticateJWT, validate, authController.requestEmailChange);
router.get('/confirm-email-change', authController.confirmEmailChange);
module.exports = router;
