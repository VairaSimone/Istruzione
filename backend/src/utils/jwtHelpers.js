'use strict';

const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

/**
 * Genera un access token JWT.
 * Payload minimale: solo l'id e il ruolo (principio del minimo privilegio).
 * NON includere dati sensibili (password, email) nel payload.
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      ruolo: user.ruolo,
    },
    jwtConfig.access.secret,
    {
      expiresIn: jwtConfig.access.expiresIn,
      issuer: 'auth-backend',
      audience: 'auth-backend-client',
    }
  );
};

/**
 * Genera un refresh token JWT.
 * Ha una scadenza più lunga dell'access token.
 * Viene anche salvato nel DB per permettere l'invalidazione (logout).
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
    },
    jwtConfig.refresh.secret,
    {
      expiresIn: jwtConfig.refresh.expiresIn,
      issuer: 'auth-backend',
      audience: 'auth-backend-client',
    }
  );
};

/**
 * Verifica e decodifica un access token.
 * @throws {JsonWebTokenError} se il token non è valido
 * @throws {TokenExpiredError} se il token è scaduto
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.access.secret, {
    issuer: 'auth-backend',
    audience: 'auth-backend-client',
  });
};

/**
 * Verifica e decodifica un refresh token.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refresh.secret, {
    issuer: 'auth-backend',
    audience: 'auth-backend-client',
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
