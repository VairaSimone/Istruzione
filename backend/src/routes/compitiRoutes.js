'use strict';

const express = require('express');
const router = express.Router();

const compitiController = require('../controllers/compitiController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateCompitoIdParam,
  validateAssegnazioneParams,
  validateConsegnaParams,
  validateCreaCompito,
  validateAggiornaCompito,
  validateAssegna,
  validateValutaConsegna,
  validateConsegnaStudente,
  validateElencoCompiti,
  validateElencoStudente,
} = require('../validators/compitiValidators');

/**
 * Route dei COMPITI — montate sotto `/api/compiti`.
 *
 * Due gruppi con autorizzazioni diverse:
 *   - STUDENTE (`/studente/...`): riservate al ruolo studente; vede/consegna
 *     solo i compiti pubblicati a lui destinati.
 *   - DOCENTE (`/`, `/:id`, ...): riservate a insegnante|admin; ognuno gestisce
 *     solo i propri compiti e assegna solo alle proprie aule/studenti.
 *
 * Le route `/studente` sono dichiarate PRIMA di `/:id` così Express non fa
 * combaciare "studente" con il parametro `:id`.
 *
 *   ── Studente ──
 *   GET  /api/compiti/studente                 → elenco (?stato=assegnato|completato|in_scadenza|scaduto)
 *   GET  /api/compiti/studente/:id             → dettaglio compito destinato
 *   POST /api/compiti/studente/:id/consegna    → invia la consegna
 *
 *   ── Docente ──
 *   POST   /api/compiti                                  → crea compito
 *   GET    /api/compiti                                  → elenco compiti creati
 *   GET    /api/compiti/:id                              → dettaglio + statistiche
 *   PATCH  /api/compiti/:id                              → modifica
 *   DELETE /api/compiti/:id                              → elimina
 *   POST   /api/compiti/:id/assegnazioni                 → assegna a classe|studente
 *   DELETE /api/compiti/:id/assegnazioni/:assegnazioneId → rimuovi assegnazione
 *   GET    /api/compiti/:id/consegne                     → stato per studente
 *   PATCH  /api/compiti/:id/consegne/:utenteId           → valuta (punteggio/feedback)
 */

router.use(authenticateJWT);

// ── STUDENTE ──
router.get(
  '/studente',
  authorizeRoles('studente'),
  validateElencoStudente,
  validate,
  compitiController.elencoStudente
);

router.get(
  '/studente/:id',
  authorizeRoles('studente'),
  validateCompitoIdParam,
  validate,
  compitiController.dettaglioStudente
);

router.post(
  '/studente/:id/consegna',
  authorizeRoles('studente'),
  csrfProtection,
  validateConsegnaStudente,
  validate,
  compitiController.consegna
);

// ── DOCENTE / ADMIN ──
router.post(
  '/',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCreaCompito,
  validate,
  compitiController.creaCompito
);

router.get(
  '/',
  authorizeRoles('insegnante', 'admin'),
  validateElencoCompiti,
  validate,
  compitiController.elencoCompiti
);

router.get(
  '/:id',
  authorizeRoles('insegnante', 'admin'),
  validateCompitoIdParam,
  validate,
  compitiController.dettaglioCompito
);

router.patch(
  '/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiornaCompito,
  validate,
  compitiController.aggiornaCompito
);

router.delete(
  '/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCompitoIdParam,
  validate,
  compitiController.eliminaCompito
);

router.post(
  '/:id/assegnazioni',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAssegna,
  validate,
  compitiController.aggiungiAssegnazione
);

router.delete(
  '/:id/assegnazioni/:assegnazioneId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAssegnazioneParams,
  validate,
  compitiController.rimuoviAssegnazione
);

router.get(
  '/:id/consegne',
  authorizeRoles('insegnante', 'admin'),
  validateCompitoIdParam,
  validate,
  compitiController.elencoConsegne
);

router.patch(
  '/:id/consegne/:utenteId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateValutaConsegna,
  validate,
  compitiController.valutaConsegna
);

module.exports = router;
