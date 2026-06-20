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
      token_version: user.token_version,
    },
    jwtConfig.access.secret,
    {
      expiresIn: jwtConfig.access.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm,
    }
  );
};

/**
 * Genera un refresh token JWT.
 * Ha una scadenza più lunga dell'access token.
 * L'hash viene salvato nel DB per permettere l'invalidazione (logout).
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
    },
    jwtConfig.refresh.secret,
    {
      expiresIn: jwtConfig.refresh.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm,
    }
  );
};

/**
 * Verifica e decodifica un access token, applicando issuer/audience e
 * vincolando esplicitamente l'algoritmo a HS256.
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.access.secret, {
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithms: [jwtConfig.algorithm],
  });
};

/**
 * Verifica e decodifica un refresh token.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refresh.secret, {
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithms: [jwtConfig.algorithm],
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};