'use strict';

// Centralizza tutta la configurazione JWT
// Così se domani cambia la struttura, si tocca solo qui
module.exports = {
  access: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
};
