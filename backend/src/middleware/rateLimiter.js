'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter globale: applicato a tutte le route.
 * Protegge da attacchi DDoS generici.
 */
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,  // Invia header X-RateLimit-* standard
  legacyHeaders: false,   // Disabilita header X-RateLimit-* vecchi
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppe richieste. Riprova tra qualche minuto.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Rate limiter specifico per il login.
 * Più restrittivo: protegge da brute force sulle credenziali.
 * 5 tentativi ogni 15 minuti per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Non conta i login riusciti (reset al successo)
  message: {
    status: 'fail',
    code: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Rate limiter per le richieste di reset password.
 * Molto restrittivo per prevenire enumerazione email.
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3,
  message: {
    status: 'fail',
    code: 'TOO_MANY_REQUESTS',
    message: 'Troppi tentativi di reset password. Riprova tra un\'ora.',
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { globalLimiter, loginLimiter, forgotPasswordLimiter };
