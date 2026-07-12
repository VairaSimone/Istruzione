'use strict';
const { cookie, param } = require('express-validator');
const { body } = require('express-validator');
const Utente = require('../models/Utente');

// ─────────────────────────────────────────────
// Regole di validazione riutilizzabili
// ─────────────────────────────────────────────

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const nameRegex = /^[\p{L}\p{M}\s'-]+$/u;
const passwordRules = (fieldName = 'password') =>
  body(fieldName)
    .trim()
    .notEmpty().withMessage('La password è obbligatoria')
    .matches(passwordRegex)
    .withMessage(
      'La password deve contenere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale'
    );

const nomeRules = (fieldName = 'nome', label = 'Il nome') =>
  body(fieldName)
    .trim()
    .notEmpty().withMessage(`${label} è obbligatorio`)
    .isLength({ min: 2, max: 100 }).withMessage(`${label} deve avere tra 2 e 100 caratteri`)
    .matches(nameRegex).withMessage(`${label} contiene caratteri non validi`);

const etaRules = (fieldName = 'eta') =>
  body(fieldName)
    .notEmpty().withMessage("L'età è obbligatoria")
    .isInt({ min: 14, max: 99 }).withMessage("L'età deve essere un numero intero tra 14 e 99")
    .toInt();

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

// Accettazione OBBLIGATORIA dei Termini e della Privacy alla registrazione.
// Accetta booleano true o le stringhe 'true'/'on' inviate dai form; qualsiasi
// altro valore (incluso false) fa fallire la validazione. Serve a raccogliere
// e provare il consenso (art. 7 GDPR).
const accettaTerminiRules = (fieldName = 'accettaTermini') =>
  body(fieldName)
    .customSanitizer((v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1')
    .custom((v) => v === true)
    .withMessage('Devi accettare i Termini e la Privacy Policy per registrarti');

// ─────────────────────────────────────────────
// POST /api/invites/student  (insegnante / admin)
// `scuolaId` è facoltativo: ignorato per l'insegnante (usa la propria scuola),
// OBBLIGATORIO per l'admin (indica la scuola di destinazione). Il vincolo
// "obbligatorio per admin" è applicato nel service (dipende dal ruolo).
// ─────────────────────────────────────────────
const validateInvitoStudente = [
  emailRules('email'),
  // La classe è TESTO LIBERO: il vocabolario ammesso è una impostazione della
  // scuola (`impostazioni.didattica.classiDisponibili`), verificata nel service
  // che conosce il tenant di destinazione.
  body('classe')
    .trim()
    .notEmpty().withMessage('La classe è obbligatoria')
    .bail()
    .isLength({ max: Utente.CLASSE_MAX })
    .withMessage(`La classe non può superare i ${Utente.CLASSE_MAX} caratteri`),
  body('scuolaId')
    .optional({ nullable: true })
    .isUUID(4).withMessage("L'identificativo della scuola non è valido"),
];

// ─────────────────────────────────────────────
// POST /api/invites/teacher  (admin)
// `scuolaId` OBBLIGATORIO: l'insegnante invitato viene iscritto a quella scuola.
// ─────────────────────────────────────────────
const validateInvitoInsegnante = [
  emailRules('email'),
  body('scuolaId')
    .trim()
    .notEmpty().withMessage('La scuola di destinazione è obbligatoria')
    .bail()
    .isUUID(4).withMessage("L'identificativo della scuola non è valido"),
];

// ─────────────────────────────────────────────
// GET /api/invites/validate/:token  (pubblica)
// ─────────────────────────────────────────────
const validateInviteTokenParam = [
  param('token')
    .trim()
    .notEmpty().withMessage('Token non valido')
    .isHexadecimal().withMessage('Token non valido')
    .isLength({ min: 64, max: 64 }).withMessage('Token non valido'),
];

// ─────────────────────────────────────────────
// POST /api/auth/register-student
// Email e classe NON sono accettate dal client: derivano dall'invito.
// ─────────────────────────────────────────────
const validateRegisterStudent = [
  tokenRules('token', 'Token non valido'),
  nomeRules('nome', 'Il nome'),
  nomeRules('cognome', 'Il cognome'),
  etaRules('eta'),
  passwordRules('password'),
  accettaTerminiRules('accettaTermini'),
];

// ─────────────────────────────────────────────
// POST /api/auth/register-teacher
// Nessuna classe, nessuna età.
// ─────────────────────────────────────────────
const validateRegisterTeacher = [
  tokenRules('token', 'Token non valido'),
  nomeRules('nome', 'Il nome'),
  nomeRules('cognome', 'Il cognome'),
  passwordRules('password'),
  accettaTerminiRules('accettaTermini'),
];

// ─────────────────────────────────────────────
// Validazione generica di un :id UUID nei parametri
// ─────────────────────────────────────────────
const validateIdParam = [
  param('id').isUUID().withMessage('ID non valido'),
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

// ─────────────────────────────────────────────
// POST /api/auth/resend-verification
// ─────────────────────────────────────────────
const validateResendVerification = [
  emailRules('email'),
];

module.exports = {
  validateInvitoStudente,
  validateInvitoInsegnante,
  validateInviteTokenParam,
  validateRegisterStudent,
  validateRegisterTeacher,
  validateIdParam,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangeEmail,
  validateRefreshToken,
  validateVerifyEmail,
  validateConfirmEmailChange,
  validateResendVerification,
};
