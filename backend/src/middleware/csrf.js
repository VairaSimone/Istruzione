'use strict';

const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { secure, sameSite, REFRESH_TOKEN_MAX_AGE } = require('../config/cookies');

const CSRF_COOKIE_NAME = 'csrf_token';

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Imposta (o rinnova) il cookie CSRF. NON è httpOnly di proposito: deve
 * essere leggibile dal JS del frontend per essere rispedito nell'header
 * X-CSRF-Token (pattern double-submit cookie).
 */
const setCsrfCookie = (res, token = generateCsrfToken()) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure,
    sameSite,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  return token;
};

/**
 * Verifica anti-CSRF per le richieste mutative autenticate: confronta in
 * tempo costante il valore del cookie CSRF con quello dell'header
 * X-CSRF-Token. Un attaccante cross-site non può né leggere il cookie né
 * impostare l'header personalizzato, quindi la verifica fallisce.
 */
const csrfProtection = (req, res, next) => {
  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE_NAME] : undefined;
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken || !headerToken) {
    return next(new AppError('Token CSRF mancante o non valido.', 403, 'CSRF_TOKEN_INVALID'));
  }

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    return next(new AppError('Token CSRF mancante o non valido.', 403, 'CSRF_TOKEN_INVALID'));
  }

  next();
};

module.exports = { csrfProtection, setCsrfCookie, generateCsrfToken, CSRF_COOKIE_NAME };