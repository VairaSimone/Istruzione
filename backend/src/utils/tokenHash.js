'use strict';

const crypto = require('crypto');

/**
 * Calcola l'hash SHA-256 (hex) di un token.
 * I token "segreti" (refresh, reset password, verifica email, cambio email)
 * vengono salvati nel DB SOLO come hash: un eventuale leak del database non
 * rende quindi i token direttamente utilizzabili. Il valore in chiaro viene
 * inviato esclusivamente all'utente (email / cookie).
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = { hashToken };