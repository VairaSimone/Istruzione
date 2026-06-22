'use strict';
const { cookie } = require('express-validator');
const { body } = require('express-validator');
const Utente = require('../models/Utente');

// ─────────────────────────────────────────────
// Regole di validazione riutilizzabili
// ─────────────────────────────────────────────

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const passwordRules = (fieldName = 'password') =>
  body(fieldName)
    .trim()
    .notEmpty().withMessage('La password è obbligatoria')
    .matches(passwordRegex)
    .withMessage(
      'La password deve contenere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale'
    );

const emailRules = (fieldName = 'email') =>
  body(fieldName)
    .trim()
    .notEmpty().withMessage("L'email è obbligatoria")
    .isEmail().withMessage('Formato email non valido')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage("L'email non può superare i 255 caratteri");

const tokenRules = (fieldName = 'token', message = 'Token non valido') =>
  body(fieldName)
    .trim()
    .notEmpty().withMessage(message)
    .isHexadecimal().withMessage(message)
    .isLength({ min: 64, max: 64 }).withMessage(message);

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
const validateRegistrazione = [
  body('nome')
    .trim()
    .notEmpty().withMessage('Il nome è obbligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Il nome deve avere tra 2 e 100 caratteri')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/).withMessage('Il nome contiene caratteri non validi'),

  body('cognome')
    .trim()
    .notEmpty().withMessage('Il cognome è obbligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Il cognome deve avere tra 2 e 100 caratteri')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/).withMessage('Il cognome contiene caratteri non validi'),

  body('eta')
    .notEmpty().withMessage("L'età è obbligatoria")
    .isInt({ min: 14, max: 99 }).withMessage("L'età deve essere un numero intero tra 14 e 99")
    .toInt(),

  emailRules('email'),

  passwordRules('password'),

  body('classe')
    .trim()
    .notEmpty().withMessage('La classe è obbligatoria')
    .isIn(Utente.CLASSI_VALIDE)
    .withMessage(`La classe deve essere una di: ${Utente.CLASSI_VALIDE.join(', ')}`),

  // `lingua` è OPZIONALE: il frontend la invia (lingua attiva nella UI) per
  // localizzare l'email di verifica. Se assente, il service usa il default.
  body('lingua')
    .optional()
    .isIn(['it', 'en'])
    .withMessage('La lingua deve essere una di: it, en'),
];

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
const validateLogin = [
  emailRules('email'),

  body('password')
    .trim()
    .notEmpty().withMessage('La password è obbligatoria'),
];

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
const validateForgotPassword = [
  emailRules('email'),
];

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
const validateResetPassword = [
  tokenRules('token', 'Token non valido'),
  passwordRules('nuovaPassword'),
];

// ─────────────────────────────────────────────
// PATCH /api/auth/change-email
// ─────────────────────────────────────────────
const validateChangeEmail = [
  emailRules('nuovaEmail'),
];

// ─────────────────────────────────────────────
// POST /api/auth/refresh-token
// ─────────────────────────────────────────────
const validateRefreshToken = [
  cookie('refresh_token')
    .notEmpty()
    .withMessage('auth.refresh_token_required'),
];

// ─────────────────────────────────────────────
// POST /api/auth/verify-email
// ─────────────────────────────────────────────
const validateVerifyEmail = [
  tokenRules('token', 'Token non valido'),
];

// ─────────────────────────────────────────────
// POST /api/auth/confirm-email-change
// ─────────────────────────────────────────────
const validateConfirmEmailChange = [
  tokenRules('token', 'Token non valido'),
];

module.exports = {
  validateRegistrazione,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangeEmail,
  validateRefreshToken,
  validateVerifyEmail,
  validateConfirmEmailChange,
};
