'use strict';

const express = require('express');
const router = express.Router();

const scuolaController = require('../controllers/scuolaController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateScuolaIdParam,
  validateCreaScuola,
  validateAggiornaScuola,
  validateAggiornaImpostazioni,
  validateElencoScuole,
} = require('../validators/scuolaValidators');

/**
 * Route delle SCUOLE (tenant) — montate sotto `/api/scuole`.
 *
 *   GET    /api/scuole/mia                 → insegnante|admin: la propria scuola
 *   POST   /api/scuole                     → admin: crea scuola
 *   GET    /api/scuole                     → admin: elenco scuole
 *   GET    /api/scuole/:id                 → admin: dettaglio scuola
 *   PATCH  /api/scuole/:id                 → admin: modifica nome/impostazioni
 *   PATCH  /api/scuole/:id/impostazioni    → admin: merge impostazioni
 *   DELETE /api/scuole/:id                 → admin: elimina scuola
 *
 * Tutte richiedono autenticazione. La creazione/modifica/eliminazione è
 * riservata all'admin; la lettura della PROPRIA scuola è accessibile anche
 * agli insegnanti. Le mutazioni sono protette da CSRF (double-submit cookie).
 */

router.use(authenticateJWT);

// ── Lettura della propria scuola (insegnante + admin) ──
router.get('/mia', authorizeRoles('insegnante', 'admin'), scuolaController.miaScuola);

// ── Amministrazione scuole (solo admin) ──
router.get('/', authorizeRoles('admin'), validateElencoScuole, validate, scuolaController.elencoScuole);

router.post(
  '/',
  authorizeRoles('admin'),
  csrfProtection,
  validateCreaScuola,
  validate,
  scuolaController.creaScuola
);

router.get(
  '/:id',
  authorizeRoles('admin'),
  validateScuolaIdParam,
  validate,
  scuolaController.dettaglioScuola
);

router.patch(
  '/:id',
  authorizeRoles('admin'),
  csrfProtection,
  validateAggiornaScuola,
  validate,
  scuolaController.aggiornaScuola
);

router.patch(
  '/:id/impostazioni',
  authorizeRoles('admin'),
  csrfProtection,
  validateAggiornaImpostazioni,
  validate,
  scuolaController.aggiornaImpostazioni
);

router.delete(
  '/:id',
  authorizeRoles('admin'),
  csrfProtection,
  validateScuolaIdParam,
  validate,
  scuolaController.eliminaScuola
);

module.exports = router;
