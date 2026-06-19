'use strict';

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
  body('token')
    .trim()
    .notEmpty().withMessage('Il token è obbligatorio')
    .isHexadecimal().withMessage('Token non valido')
    .isLength({ min: 64, max: 64 }).withMessage('Token non valido'),

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
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Il refresh token è obbligatorio'),
];

module.exports = {
  validateRegistrazione,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangeEmail,
  validateRefreshToken,
};
