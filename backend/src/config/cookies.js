'use strict';

/**
 * Configurazione centralizzata dei cookie di sessione.
 *
 * `COOKIE_SAMESITE` permette di passare a 'none' nei deploy cross-site
 * (frontend e backend su domini diversi). In quel caso il flag `secure`
 * è forzato a true, come richiesto dai browser per SameSite=None.
 */
const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const secure = process.env.NODE_ENV === 'production' || sameSite === 'none';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minuti
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 giorni

const baseCookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
};

module.exports = {
  baseCookieOptions,
  secure,
  sameSite,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
};