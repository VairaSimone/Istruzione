'use strict';

const express = require('express');
const router = express.Router();

const scuolaController = require('../controllers/scuolaController');
const AppError = require('../utils/AppError');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateScuolaIdParam,
  validateCreaScuola,
  validateAggiornaScuola,
  validateAggiornaImpostazioni,
  validateAggiornaMieImpostazioni,
  validateElencoScuole,
} = require('../validators/scuolaValidators');

/**
 * Route delle SCUOLE (tenant) — montate sotto `/api/scuole`.
 *
 *   ── La propria scuola (qualsiasi utente autenticato) ──
 *   GET    /api/scuole/mia                 → scuola + impostazioni complete
 *   GET    /api/scuole/mia/impostazioni    → solo il blob delle impostazioni
 *   PATCH  /api/scuole/mia/impostazioni    → insegnante|admin: merge per sezione
 *
 *   ── Amministrazione (solo admin) ──
 *   POST   /api/scuole                     → crea scuola
 *   GET    /api/scuole                     → elenco scuole
 *   GET    /api/scuole/:id                 → dettaglio scuola
 *   PATCH  /api/scuole/:id                 → anagrafica / impostazioni (sostituzione)
 *   PATCH  /api/scuole/:id/impostazioni    → merge impostazioni
 *   DELETE /api/scuole/:id                 → elimina scuola
 *
 * La lettura delle impostazioni è aperta a tutti i ruoli autenticati: il
 * frontend ne ha bisogno per applicare tema, colori e menu dell'utente loggato.
 * Il branding PRE-login vive invece su `GET /api/config` (pubblico).
 *
 * Le rotte `/mia*` sono dichiarate PRIMA di `/:id` così Express non fa combaciare
 * "mia" con il parametro `:id`. Le mutazioni sono protette da CSRF.
 */

router.use(authenticateJWT);

// ── La propria scuola ──
router.get('/mia', scuolaController.miaScuola);
router.get('/mia/impostazioni', scuolaController.mieImpostazioni);

/**
 * Guardia: un insegnante deve avere una scuola per poterne modificare le
 * impostazioni. L'admin non ne ha una: deve usare `PATCH /api/scuole/:id/impostazioni`
 * indicando esplicitamente il tenant, per non modificare "a caso".
 */
const richiediScuolaPropria = (req, res, next) => {
  if (!req.user.scuola_id) {
    return next(
      new AppError(
        'Il tuo account non è associato ad alcuna scuola. Un amministratore deve usare /api/scuole/:id/impostazioni.',
        403,
        'NO_SCUOLA'
      )
    );
  }
  next();
};

router.patch(
  '/mia/impostazioni',
  authorizeRoles('insegnante', 'admin'),
  richiediScuolaPropria,
  csrfProtection,
  validateAggiornaMieImpostazioni,
  validate,
  scuolaController.aggiornaMieImpostazioni
);

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
