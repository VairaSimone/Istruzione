'use strict';

const express = require('express');
const router = express.Router();

const scuolaController = require('../controllers/scuolaController');
const dominiController = require('../controllers/dominiController');
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

const {
  validateDominioIdParam,
  validateAggiungiDominio,
  validateAggiornaDominio,
} = require('../validators/dominiValidators');

/**
 * Route delle SCUOLE (tenant) — montate sotto `/api/scuole`.
 *
 *   ── La propria scuola (qualsiasi utente autenticato) ──
 *   GET    /api/scuole/mia                 → scuola + impostazioni complete
 *   GET    /api/scuole/mia/impostazioni    → solo il blob delle impostazioni
 *   PATCH  /api/scuole/mia/impostazioni    → insegnante|admin: merge per sezione
 *   GET    /api/scuole/mia/domini          → domini della propria scuola
 *   POST   /api/scuole/mia/domini          → aggiunge un dominio (NON verificato)
 *   PATCH  /api/scuole/mia/domini/:id      → principale/note (verifica: solo admin)
 *   DELETE /api/scuole/mia/domini/:id      → rimuove un dominio
 *
 *   ── Amministrazione (solo admin) ──
 *   POST   /api/scuole                     → crea scuola
 *   GET    /api/scuole                     → elenco scuole
 *   GET    /api/scuole/:id                 → dettaglio scuola
 *   PATCH  /api/scuole/:id                 → anagrafica / impostazioni (sostituzione)
 *   PATCH  /api/scuole/:id/impostazioni    → merge impostazioni
 *   DELETE /api/scuole/:id                 → elimina scuola
 *   GET    /api/scuole/:id/domini          → domini della scuola
 *   POST   /api/scuole/:id/domini          → aggiunge un dominio (verificato)
 *   PATCH  /api/scuole/:id/domini/:domId   → verifica/principale/note
 *   DELETE /api/scuole/:id/domini/:domId   → rimuove un dominio
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

// ── Domini della PROPRIA scuola (staff) ──
// I domini aggiunti dallo staff nascono NON verificati: solo un admin può
// verificarli (via /api/scuole/:id/domini/:dominioId), rendendoli attivi.
router.get(
  '/mia/domini',
  authorizeRoles('insegnante', 'admin'),
  richiediScuolaPropria,
  dominiController.elencoDomini
);

router.post(
  '/mia/domini',
  authorizeRoles('insegnante', 'admin'),
  richiediScuolaPropria,
  csrfProtection,
  validateAggiungiDominio,
  validate,
  dominiController.aggiungiDominio
);

router.patch(
  '/mia/domini/:dominioId',
  authorizeRoles('insegnante', 'admin'),
  richiediScuolaPropria,
  csrfProtection,
  validateAggiornaDominio,
  validate,
  dominiController.aggiornaDominio
);

router.delete(
  '/mia/domini/:dominioId',
  authorizeRoles('insegnante', 'admin'),
  richiediScuolaPropria,
  csrfProtection,
  validateDominioIdParam,
  validate,
  dominiController.rimuoviDominio
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

// ── Domini di una scuola qualsiasi (admin): può anche VERIFICARE ──
router.get(
  '/:id/domini',
  authorizeRoles('admin'),
  validateScuolaIdParam,
  validate,
  dominiController.elencoDomini
);

router.post(
  '/:id/domini',
  authorizeRoles('admin'),
  csrfProtection,
  validateScuolaIdParam,
  validateAggiungiDominio,
  validate,
  dominiController.aggiungiDominio
);

router.patch(
  '/:id/domini/:dominioId',
  authorizeRoles('admin'),
  csrfProtection,
  validateScuolaIdParam,
  validateAggiornaDominio,
  validate,
  dominiController.aggiornaDominio
);

router.delete(
  '/:id/domini/:dominioId',
  authorizeRoles('admin'),
  csrfProtection,
  validateScuolaIdParam,
  validateDominioIdParam,
  validate,
  dominiController.rimuoviDominio
);

module.exports = router;
