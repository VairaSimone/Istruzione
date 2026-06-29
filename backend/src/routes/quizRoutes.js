'use strict';

const express = require('express');
const router = express.Router();

const quizController = require('../controllers/quizController');

const { authenticateJWT } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { quizSubmitLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const { validateGenerateQuiz, validateSubmitQuiz, validateStrokeOrder } = require('../validators/quizValidators');

/**
 * Route del QUIZ KANA — montate sotto `/api/quiz`.
 * Accessibili a qualsiasi utente autenticato e attivo (studenti, insegnanti,
 * admin): la difesa sullo stato dell'account è già in `authenticateJWT`.
 *
 *   GET  /api/quiz/dashboard  → statistiche + mastered + peggiori kana
 *   GET  /api/quiz/stroke/:alfabeto → ordine dei tratti dei kana (statico)
 *   POST /api/quiz/generate   → genera la sessione di quiz (sola lettura)
 *   POST /api/quiz/submit     → invia l'esito della partita (muta lo stato)
 */

router.use(authenticateJWT);

// Sola lettura: nessuna mutazione di stato ⇒ niente CSRF.
router.get('/dashboard', quizController.dashboard);

// Sola lettura: dati statici dell'ordine dei tratti (animazione + scrittura).
router.get('/stroke/:alfabeto', validateStrokeOrder, validate, quizController.ordineTratti);

// Sola lettura (POST per via dei filtri nel body): nessuna mutazione ⇒ niente CSRF.
router.post('/generate', validateGenerateQuiz, validate, quizController.generaQuiz);

// Mutazione di stato: protetto da CSRF (double-submit cookie) e rate limiter.
router.post(
  '/submit',
  csrfProtection,
  quizSubmitLimiter,
  validateSubmitQuiz,
  validate,
  quizController.inviaRisultati
);

module.exports = router;
