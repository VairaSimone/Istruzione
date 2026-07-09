'use strict';

const express = require('express');
const router = express.Router();

const quizController = require('../controllers/quizController');
const quizGestioneController = require('../controllers/quizGestioneController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { quizSubmitLimiter, quizScritturaLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const {
  validateGenerateQuiz,
  validateSubmitQuiz,
  validateStrokeOrder,
  validateStrokeOrderKanji,
  validateRegistraScrittura,
} = require('../validators/quizValidators');

const {
  validateQuizIdParam,
  validateDomandaParams,
  validateAbilitazioneParams,
  validateCreaQuiz,
  validateAggiornaQuiz,
  validateCreaDomanda,
  validateAggiornaDomanda,
  validateAbilitaPerAula,
  validateElencoQuiz,
  validateCatalogoTemplate,
  validateQuizDisponibili,
} = require('../validators/quizGestioneValidators');

/**
 * Route del QUIZ (Kana e Kanji) — montate sotto `/api/quiz`.
 * Accessibili a qualsiasi utente autenticato e attivo (studenti, insegnanti,
 * admin): la difesa sullo stato dell'account è già in `authenticateJWT`.
 *
 * Il dominio (kana|kanji) viaggia nel body di generate/submit; le route non si
 * duplicano. L'unica route aggiuntiva è quella dei tratti dei kanji, che ha una
 * chiave diversa (livello JLPT anziché alfabeto).
 *
 *   GET  /api/quiz/dashboard          → statistiche + mastered + peggiori kana + badge
 *   GET  /api/quiz/badge              → catalogo badge + stato di sblocco (profilo)
 *   GET  /api/quiz/stroke/:alfabeto   → ordine dei tratti dei kana (statico)
 *   GET  /api/quiz/stroke/kanji/:livello → ordine dei tratti dei kanji (statico)
 *   POST /api/quiz/generate           → genera la sessione di quiz (sola lettura)
 *   POST /api/quiz/submit             → invia l'esito della partita (muta lo stato)
 *   POST /api/quiz/scrittura          → registra i tratti validati sul canvas (muta)
 *
 * ── Quiz delle scuole ──
 * Un quiz è o l'installazione di un TEMPLATE di piattaforma (kana, kanji, …) o
 * un quiz PERSONALIZZATO con domande scritte dagli insegnanti, su qualsiasi
 * materia. `generate`/`submit` accettano `quizId` per giocarlo.
 *
 *   GET    /api/quiz/templates                              → catalogo template (staff)
 *   GET    /api/quiz/disponibili                            → quiz giocabili dal richiedente
 *   POST   /api/quiz/gestione                               → crea quiz (staff)
 *   GET    /api/quiz/gestione                               → elenco quiz della scuola (staff)
 *   GET    /api/quiz/gestione/:id                           → dettaglio con domande e aule (staff)
 *   PATCH  /api/quiz/gestione/:id                           → modifica quiz (staff)
 *   DELETE /api/quiz/gestione/:id                           → elimina quiz (staff)
 *   POST   /api/quiz/gestione/:id/domande                   → aggiungi domanda (staff)
 *   PATCH  /api/quiz/gestione/:id/domande/:domandaId        → modifica domanda (staff)
 *   DELETE /api/quiz/gestione/:id/domande/:domandaId        → elimina domanda (staff)
 *   POST   /api/quiz/gestione/:id/aule                      → abilita per un'aula (staff)
 *   DELETE /api/quiz/gestione/:id/aule/:classeId            → disabilita per un'aula (staff)
 *
 * Ogni insegnante gestisce TUTTI i quiz della propria scuola; l'admin è
 * trasversale. Le mutazioni sono protette da CSRF.
 */

router.use(authenticateJWT);

// Sola lettura: nessuna mutazione di stato ⇒ niente CSRF.
router.get('/dashboard', quizController.dashboard);

// Sola lettura: catalogo badge + stato di sblocco dell'utente.
router.get('/badge', quizController.profiloBadge);

// Sola lettura: dati statici dell'ordine dei tratti dei KANJI (per livello JLPT).
// Registrata prima della route kana per chiarezza; i percorsi non collidono
// (segmenti diversi), ma la più specifica resta in testa.
router.get(
  '/stroke/kanji/:livello',
  validateStrokeOrderKanji,
  validate,
  quizController.ordineTrattiKanji
);

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

// Mutazione di stato (XP/badge di scrittura): CSRF + rate limiter dedicato.
router.post(
  '/scrittura',
  csrfProtection,
  quizScritturaLimiter,
  validateRegistraScrittura,
  validate,
  quizController.registraScrittura
);

// ═════════════════════════════════════════════
// QUIZ DELLE SCUOLE
// ═════════════════════════════════════════════

// Sola lettura: quiz che il richiedente può giocare (studente: solo pubblicati
// e abilitati per una sua aula; staff: quelli della propria scuola).
router.get('/disponibili', validateQuizDisponibili, validate, quizGestioneController.quizDisponibili);

// ── Staff (insegnante | admin) ──
const soloStaff = authorizeRoles('insegnante', 'admin');

// Sola lettura: catalogo dei template installabili + numero di installazioni.
router.get(
  '/templates',
  soloStaff,
  validateCatalogoTemplate,
  validate,
  quizGestioneController.elencoTemplate
);

router
  .route('/gestione')
  .post(soloStaff, csrfProtection, validateCreaQuiz, validate, quizGestioneController.creaQuiz)
  .get(soloStaff, validateElencoQuiz, validate, quizGestioneController.elencoQuiz);

router
  .route('/gestione/:id')
  .get(soloStaff, validateQuizIdParam, validate, quizGestioneController.dettaglioQuiz)
  .patch(soloStaff, csrfProtection, validateAggiornaQuiz, validate, quizGestioneController.aggiornaQuiz)
  .delete(soloStaff, csrfProtection, validateQuizIdParam, validate, quizGestioneController.eliminaQuiz);

// Domande (solo quiz personalizzati: i quiz da template le generano da sé).
router.post(
  '/gestione/:id/domande',
  soloStaff,
  csrfProtection,
  validateCreaDomanda,
  validate,
  quizGestioneController.aggiungiDomanda
);

router
  .route('/gestione/:id/domande/:domandaId')
  .patch(
    soloStaff,
    csrfProtection,
    validateAggiornaDomanda,
    validate,
    quizGestioneController.aggiornaDomanda
  )
  .delete(
    soloStaff,
    csrfProtection,
    validateDomandaParams,
    validate,
    quizGestioneController.eliminaDomanda
  );

// Abilitazione presso le aule.
router.post(
  '/gestione/:id/aule',
  soloStaff,
  csrfProtection,
  validateAbilitaPerAula,
  validate,
  quizGestioneController.abilitaPerAula
);

router.delete(
  '/gestione/:id/aule/:classeId',
  soloStaff,
  csrfProtection,
  validateAbilitazioneParams,
  validate,
  quizGestioneController.disabilitaPerAula
);

module.exports = router;
