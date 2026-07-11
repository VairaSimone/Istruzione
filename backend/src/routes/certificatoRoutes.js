'use strict';

const express = require('express');
const router = express.Router();

const certificatoController = require('../controllers/certificatoController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const { csrfProtection } = require('../middleware/csrf');
const { uploadImmagine } = require('../middleware/upload');
const validate = require('../middleware/validate');

const {
  validateCertificatoIdParam,
  validateFileIdParam,
  validateVerificaCodice,
  validateEmetti,
  validateRevoca,
  validateElenco,
} = require('../validators/certificatoValidators');

/**
 * Route delle CERTIFICAZIONI — montate sotto `/api/certificati`.
 *
 *   ── Verifica pubblica (NESSUNA autenticazione) ──
 *   GET  /api/certificati/verifica/:codice   → validità + dati non sensibili
 *
 *   ── Letture (studente + staff) ──
 *   GET  /api/certificati                     → elenco (studente: i propri;
 *                                               staff: quelli della scuola)
 *   GET  /api/certificati/:id                 → dettaglio
 *   GET  /api/certificati/:id/pdf             → download PDF (rigenerato on-demand)
 *
 *   ── Gestione (insegnante/admin) ──
 *   POST   /api/certificati                   → rilascia un certificato
 *   POST   /api/certificati/:id/revoca        → revoca
 *   POST   /api/certificati/risorse           → carica logo/firma (PNG/JPEG)
 *   GET    /api/certificati/risorse/:fileId   → anteprima logo/firma (staff)
 *
 * La verifica pubblica è dichiarata PRIMA del gate di autenticazione: dev'essere
 * raggiungibile da chiunque, anche esternamente, per attestare l'autenticità.
 * Tutto il resto richiede login + funzionalità "certificazioni" attiva.
 *
 * Le rotte letterali `/verifica` e `/risorse` sono dichiarate prima di `/:id`
 * così non vengono catturate dal parametro dinamico.
 */

// ── VERIFICA PUBBLICA (senza auth, senza gate) ──
router.get('/verifica/:codice', validateVerificaCodice, validate, certificatoController.verifica);

// ── Da qui in poi: autenticazione + funzionalità attiva ──
router.use(authenticateJWT);
router.use(richiediFunzionalita('certificazioni'));

// ── RISORSE DEL MODELLO (logo/firma) — solo staff ──
router.post(
  '/risorse',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  uploadImmagine,
  certificatoController.caricaRisorsa
);

router.get(
  '/risorse/:fileId',
  authorizeRoles('insegnante', 'admin'),
  validateFileIdParam,
  validate,
  certificatoController.serviRisorsa
);

// ── LETTURE (studente + staff) ──
router.get('/', validateElenco, validate, certificatoController.elenco);

// ── RILASCIO (insegnante/admin) ──
router.post(
  '/',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateEmetti,
  validate,
  certificatoController.emetti
);

// ── Dettaglio + PDF (studente proprietario o staff della scuola) ──
router.get('/:id', validateCertificatoIdParam, validate, certificatoController.dettaglio);
router.get('/:id/pdf', validateCertificatoIdParam, validate, certificatoController.scaricaPdf);

// ── REVOCA (insegnante/admin) ──
router.post(
  '/:id/revoca',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateRevoca,
  validate,
  certificatoController.revoca
);

module.exports = router;
