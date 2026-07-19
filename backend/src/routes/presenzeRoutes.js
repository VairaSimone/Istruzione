'use strict';

const express = require('express');
const router = express.Router();

const presenzeController = require('../controllers/presenzeController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateRegistroIdParam,
  validateClasseIdParam,
  validateCreaRegistro,
  validateAggiornaRegistro,
  validateSalvaVoci,
  validateElencoRegistri,
  validateMiePresenze,
} = require('../validators/presenzeValidators');

/**
 * Route del REGISTRO PRESENZE — montate sotto `/api/presenze`.
 *
 * Due gruppi:
 *   - VISTA STUDENTE (`GET /mie`): lo studente vede solo le proprie presenze e
 *     il proprio conteggio rispetto al limite di scuola.
 *   - GESTIONE (`/registri...`, `/riepilogo/...`): riservata a insegnante|admin.
 *     Un insegnante opera solo sulle proprie aule (enforced nel service).
 *
 * Le rotte letterali `/mie` e `/riepilogo` sono distinte da `/registri`, quindi
 * non c'è ambiguità di matching con `/registri/:id`.
 *
 *   ── Studente ──
 *   GET    /api/presenze/mie                         → proprie presenze + conteggio
 *
 *   ── Gestione (docente/admin) ──
 *   GET    /api/presenze/riepilogo/:classeId         → riepilogo assenze aula
 *   POST   /api/presenze/registri                    → apri appello (roster precompilato)
 *   GET    /api/presenze/registri                    → elenco appelli
 *   GET    /api/presenze/registri/:id                → dettaglio + voci
 *   PATCH  /api/presenze/registri/:id                → modifica argomento/note
 *   DELETE /api/presenze/registri/:id                → elimina appello
 *   PUT    /api/presenze/registri/:id/voci           → salva presenze (upsert)
 */

router.use(authenticateJWT);
router.use(richiediFunzionalita('presenze'));

// ── VISTA STUDENTE (tutti i ruoli autenticati; per il docente sarà vuota) ──
router.get('/mie', validateMiePresenze, validate, presenzeController.miePresenze);

// ── RIEPILOGO AULA (docente/admin) ──
router.get(
  '/riepilogo/:classeId',
  authorizeRoles('insegnante', 'admin'),
  validateClasseIdParam,
  validate,
  presenzeController.riepilogoAula
);

// ── GESTIONE APPELLO (docente/admin) ──
router.post(
  '/registri',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCreaRegistro,
  validate,
  presenzeController.creaRegistro
);

router.get(
  '/registri',
  authorizeRoles('insegnante', 'admin'),
  validateElencoRegistri,
  validate,
  presenzeController.elencoRegistri
);

router.get(
  '/registri/:id',
  authorizeRoles('insegnante', 'admin'),
  validateRegistroIdParam,
  validate,
  presenzeController.dettaglioRegistro
);

router.patch(
  '/registri/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiornaRegistro,
  validate,
  presenzeController.aggiornaRegistro
);

router.delete(
  '/registri/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateRegistroIdParam,
  validate,
  presenzeController.eliminaRegistro
);

router.put(
  '/registri/:id/voci',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateSalvaVoci,
  validate,
  presenzeController.salvaVoci
);

module.exports = router;
