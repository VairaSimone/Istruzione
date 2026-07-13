'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter globale: applicato a tutte le route.
 * Protegge da attacchi DDoS generici.
 *
 * NOTA: lo store di default è in-memory (per-istanza). In deploy
 * multi-istanza configurare uno store condiviso (es. Redis) tramite
 * l'opzione `store`, per garantire conteggi coerenti tra le istanze.
 */
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe richieste. Riprova tra qualche minuto.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    status: 'fail',
    code: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppi tentativi di reset password. Riprova tra un\'ora.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita la registrazione: previene email bombing (invio massivo di email
 * di verifica verso indirizzi arbitrari) e scritture DB di massa.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe registrazioni da questo indirizzo. Riprova più tardi.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita le richieste di refresh token, per evitare abusi sul rinnovo
 * sessione.
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: parseInt(process.env.REFRESH_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe richieste di rinnovo sessione. Riprova tra qualche minuto.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita il re-invio dell'email di verifica: previene email bombing verso
 * un account non ancora verificato. Limite dedicato e severo (anche perché
 * la risposta è generica per l'anti user-enumeration).
 */
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: parseInt(process.env.RESEND_VERIFICATION_RATE_LIMIT_MAX) || 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe richieste di re-invio. Riprova tra un\'ora.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita la creazione di inviti da parte di insegnanti/admin: previene
 * l'invio massivo di email di invito (email bombing) tramite un account
 * autenticato compromesso o abusato.
 */
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: parseInt(process.env.INVITE_RATE_LIMIT_MAX) || 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppi inviti inviati. Riprova più tardi.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita l'invio dei risultati del quiz: evita che un client abusi
 * dell'endpoint per gonfiare XP/streak con invii massivi automatizzati.
 */
const quizSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: parseInt(process.env.QUIZ_SUBMIT_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppi invii di quiz. Riprova tra qualche minuto.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita la registrazione delle sessioni di scrittura su canvas: evita che un
 * client abusi dell'endpoint per gonfiare XP/badge tramite invii massivi. Più
 * permissivo del submit (le sessioni di scrittura sono frequenti e leggere).
 */
const quizScritturaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: parseInt(process.env.QUIZ_SCRITTURA_RATE_LIMIT_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe registrazioni di scrittura. Riprova tra qualche minuto.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Limita l'invio del form di contatto della homepage pubblica: previene lo
 * spam massivo verso le scuole (email bombing dei lead) e la scrittura di massa
 * su `richieste_contatto` da un singolo IP. Volutamente severo: un visitatore
 * legittimo invia pochissime richieste.
 */
const contactLimiter = rateLimit({
  windowMs: parseInt(process.env.CONTACT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 ora
  max: parseInt(process.env.CONTACT_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe richieste inviate da questo indirizzo. Riprova più tardi.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = {
  globalLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  registerLimiter,
  refreshLimiter,
  resendVerificationLimiter,
  inviteLimiter,
  quizSubmitLimiter,
  quizScritturaLimiter,
  contactLimiter,
};