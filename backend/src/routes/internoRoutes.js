'use strict';

const express = require('express');
const router = express.Router();

const internoController = require('../controllers/internoController');

/**
 * Route di SERVIZIO/INFRASTRUTTURA — montate sotto `/api/interno`.
 *
 * Pubbliche (nessun cookie/JWT): sono pensate per essere chiamate da componenti
 * di sistema, non dal browser dell'utente. Coperte dal rate limiter globale.
 *
 *   GET /api/interno/dominio-consentito?domain=<host>
 *     → 200 se l'host è un dominio scuola verificato e attivo (Caddy on-demand TLS);
 *     → 403 altrimenti.
 */
router.get('/dominio-consentito', internoController.dominioConsentito);

module.exports = router;
