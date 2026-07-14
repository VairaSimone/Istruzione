'use strict';

const express = require('express');
const router = express.Router();

const pagamentiController = require('../controllers/pagamentiController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateConfigQuery,
  validateAggiornaConfig,
  validateOnboarding,
  validateStatoOnboarding,
  validateCheckout,
  validateElencoScuola,
} = require('../validators/pagamentiValidators');

/**
 * Route del modulo PAGAMENTI — montate sotto `/api/pagamenti`.
 *
 * NOTA: il WEBHOOK Stripe (`POST /api/pagamenti/webhook`) NON è qui: è montato
 * direttamente in `app.js` PRIMA di express.json/CORS/CSRF, perché deve ricevere
 * il corpo GREZZO per la verifica della firma ed è pubblico (chiamato da Stripe,
 * non dal browser).
 *
 *   ── Studente ──
 *   GET  /api/pagamenti/catalogo            → corsi acquistabili con prezzi
 *   POST /api/pagamenti/checkout            → avvia il pagamento di un corso
 *   GET  /api/pagamenti/miei                → i miei acquisti
 *
 *   ── Staff (insegnante | admin) ──
 *   GET   /api/pagamenti/config             → stato pagamenti della scuola
 *   PATCH /api/pagamenti/config             → attiva/disattiva Stripe
 *   POST  /api/pagamenti/onboarding         → avvia/riprendi onboarding Connect
 *   GET   /api/pagamenti/onboarding/stato   → sincronizza stato onboarding
 *   GET   /api/pagamenti/scuola             → incassi della scuola
 *
 * Tutte le route richiedono autenticazione e la funzionalità `pagamenti` attiva
 * per la scuola. Le mutazioni sono protette da CSRF.
 */

router.use(authenticateJWT);
// Gate di sezione: se la scuola ha disattivato i pagamenti, l'intero modulo è 403.
router.use(richiediFunzionalita('pagamenti'));

// ═════════════════════════════════════════════
// STUDENTE
// ═════════════════════════════════════════════
router.get('/catalogo', authorizeRoles('studente'), pagamentiController.catalogo);

router.post(
  '/checkout',
  authorizeRoles('studente'),
  csrfProtection,
  validateCheckout,
  validate,
  pagamentiController.checkout
);

router.get('/miei', authorizeRoles('studente'), pagamentiController.miei);

// ═════════════════════════════════════════════
// STAFF (insegnante | admin)
// ═════════════════════════════════════════════
router.get(
  '/config',
  authorizeRoles('insegnante', 'admin'),
  validateConfigQuery,
  validate,
  pagamentiController.config
);

router.patch(
  '/config',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiornaConfig,
  validate,
  pagamentiController.aggiornaConfig
);

router.post(
  '/onboarding',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateOnboarding,
  validate,
  pagamentiController.onboarding
);

router.get(
  '/onboarding/stato',
  authorizeRoles('insegnante', 'admin'),
  validateStatoOnboarding,
  validate,
  pagamentiController.statoOnboarding
);

router.get(
  '/scuola',
  authorizeRoles('insegnante', 'admin'),
  validateElencoScuola,
  validate,
  pagamentiController.scuola
);

module.exports = router;
