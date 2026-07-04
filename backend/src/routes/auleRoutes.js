'use strict';

const express = require('express');
const router = express.Router();

const auleController = require('../controllers/auleController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { inviteLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const {
  validateClasseIdParam,
  validateMembroParams,
  validateCreaClasse,
  validateAggiornaClasse,
  validateAggiungiMembro,
  validateInvitoStudenteAula,
  validateElencoClassi,
} = require('../validators/auleValidators');

/**
 * Route delle AULE VIRTUALI — montate sotto `/api/aule`.
 *
 * TUTTE le route sono riservate a insegnante|admin: gli studenti NON possono
 * accedere ai dati delle aule (requisito di autorizzazione). Lo scope per
 * singola aula (un insegnante opera solo sulle proprie) è applicato nel service.
 *
 *   POST   /api/aule                          → crea aula
 *   GET    /api/aule                          → elenco aule (con conteggio membri)
 *   GET    /api/aule/:id                      → dettaglio aula + membri
 *   PATCH  /api/aule/:id                      → modifica aula
 *   DELETE /api/aule/:id                      → elimina aula
 *   POST   /api/aule/:id/studenti             → aggiungi studente registrato
 *   DELETE /api/aule/:id/studenti/:utenteId   → rimuovi studente
 *   POST   /api/aule/:id/insegnanti           → aggiungi co-insegnante
 *   DELETE /api/aule/:id/insegnanti/:utenteId → rimuovi co-insegnante
 *   POST   /api/aule/:id/inviti               → invita studente via email in aula
 *
 * Le mutazioni sono protette da CSRF (double-submit cookie). Le letture no.
 */

router.use(authenticateJWT);
router.use(authorizeRoles('insegnante', 'admin'));

// ── Letture ──
router.get('/', validateElencoClassi, validate, auleController.elencoClassi);
router.get('/:id', validateClasseIdParam, validate, auleController.dettaglioClasse);

// ── Creazione / modifica / eliminazione aula ──
router.post('/', csrfProtection, validateCreaClasse, validate, auleController.creaClasse);
router.patch('/:id', csrfProtection, validateAggiornaClasse, validate, auleController.aggiornaClasse);
router.delete('/:id', csrfProtection, validateClasseIdParam, validate, auleController.eliminaClasse);

// ── Membership studenti ──
router.post(
  '/:id/studenti',
  csrfProtection,
  validateAggiungiMembro,
  validate,
  auleController.aggiungiStudente
);
router.delete(
  '/:id/studenti/:utenteId',
  csrfProtection,
  validateMembroParams,
  validate,
  auleController.rimuoviStudente
);

// ── Membership insegnanti ──
router.post(
  '/:id/insegnanti',
  csrfProtection,
  validateAggiungiMembro,
  validate,
  auleController.aggiungiInsegnante
);
router.delete(
  '/:id/insegnanti/:utenteId',
  csrfProtection,
  validateMembroParams,
  validate,
  auleController.rimuoviInsegnante
);

// ── Invito studente via email nell'aula (rate-limitato come gli altri inviti) ──
router.post(
  '/:id/inviti',
  csrfProtection,
  inviteLimiter,
  validateInvitoStudenteAula,
  validate,
  auleController.invitaStudente
);

module.exports = router;
