'use strict';

// Centralizza tutta la configurazione JWT con validazione fail-fast all'avvio.
const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret || !refreshSecret) {
  throw new Error(
    'Configurazione JWT mancante: definire JWT_ACCESS_SECRET e JWT_REFRESH_SECRET nelle variabili d\'ambiente.'
  );
}

if (accessSecret === refreshSecret) {
  throw new Error(
    'Configurazione JWT non sicura: JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devono essere diversi.'
  );
}

if (accessSecret.length < 32 || refreshSecret.length < 32) {
  throw new Error(
    'Configurazione JWT non sicura: i segreti JWT devono essere lunghi almeno 32 caratteri.'
  );
}

module.exports = {
  access: {
    secret: accessSecret,
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  },
  refresh: {
    secret: refreshSecret,
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  algorithm: 'HS256',
  issuer: 'auth-backend',
  audience: 'auth-backend-client',
};