'use strict';

const express = require('express');
const router = express.Router();

const messaggiController = require('../controllers/messaggiController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateMessaggioIdParam,
  validateInviaMessaggio,
  validateFeedbackCompito,
  validateRispondi,
  validateElencoRicevuti,
  validateElencoPaginato,
} = require('../validators/messaggiValidators');

/**
 * Route della MESSAGGISTICA — montate sotto `/api/messaggi`.
 *
 *   ── Docente (insegnante|admin) ──
 *   POST /api/messaggi                    → invia a studente|aula, incoraggiamento, nota privata
 *   POST /api/messaggi/feedback-compito   → feedback su compito (scrive la consegna + notifica)
 *   GET  /api/messaggi/inviati            → posta inviata (con conteggi lettura)
 *   GET  /api/messaggi/note               → note private
 *
 *   ── Condivise (docente + studente) ──
 *   GET    /api/messaggi/ricevuti         → inbox (?nonLetti=true)
 *   GET    /api/messaggi/notifiche        → conteggio non letti
 *   GET    /api/messaggi/:id              → dettaglio + thread (marca come letto)
 *   POST   /api/messaggi/:id/letto        → segna come letto
 *   POST   /api/messaggi/:id/rispondi     → rispondi (se consentito e destinatario)
 *   DELETE /api/messaggi/:id              → elimina (solo autore|admin)
 *
 * Le route letterali sono dichiarate PRIMA di `/:id` per evitare collisioni col
 * parametro. Le mutazioni sono protette da CSRF.
 */

router.use(authenticateJWT);

// ── DOCENTE ──
router.post(
  '/',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateInviaMessaggio,
  validate,
  messaggiController.inviaMessaggio
);

router.post(
  '/feedback-compito',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateFeedbackCompito,
  validate,
  messaggiController.inviaFeedbackCompito
);

router.get(
  '/inviati',
  authorizeRoles('insegnante', 'admin'),
  validateElencoPaginato,
  validate,
  messaggiController.elencoInviati
);

router.get(
  '/note',
  authorizeRoles('insegnante', 'admin'),
  validateElencoPaginato,
  validate,
  messaggiController.elencoNote
);

// ── CONDIVISE (qualsiasi utente autenticato e attivo) ──
router.get('/ricevuti', validateElencoRicevuti, validate, messaggiController.elencoRicevuti);

router.get('/notifiche', messaggiController.notifiche);

router.post(
  '/:id/letto',
  csrfProtection,
  validateMessaggioIdParam,
  validate,
  messaggiController.segnaLetto
);

router.post(
  '/:id/rispondi',
  csrfProtection,
  validateRispondi,
  validate,
  messaggiController.rispondi
);

router.get('/:id', validateMessaggioIdParam, validate, messaggiController.dettaglioMessaggio);

router.delete(
  '/:id',
  csrfProtection,
  validateMessaggioIdParam,
  validate,
  messaggiController.eliminaMessaggio
);

module.exports = router;
