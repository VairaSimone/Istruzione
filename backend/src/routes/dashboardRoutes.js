'use strict';

const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  validateDashboardQuery,
  validateDashboardAula,
} = require('../validators/dashboardValidators');

/**
 * Route della DASHBOARD DOCENTE — montate sotto `/api/dashboard`.
 *
 * Riservate a insegnante|admin: gli studenti non accedono alle statistiche
 * aggregate. Lo scope per aula (un insegnante vede solo le proprie aule) è
 * applicato nel service. Endpoint di SOLA LETTURA ⇒ niente CSRF.
 *
 *   GET /api/dashboard                    → cruscotto globale (mie aule / tutto per admin)
 *   GET /api/dashboard/aula/:classeId     → cruscotto di una singola aula
 *
 * Query facoltative: `giorni` (finestra, default 30) e `limite` (dimensione
 * delle liste top-N, default 10).
 */

router.use(authenticateJWT);
router.use(authorizeRoles('insegnante', 'admin'));

router.get('/', validateDashboardQuery, validate, dashboardController.dashboardGlobale);

router.get(
  '/aula/:classeId',
  validateDashboardAula,
  validate,
  dashboardController.dashboardAula
);

module.exports = router;
