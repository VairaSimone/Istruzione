'use strict';

const catchAsync = require('../utils/catchAsync');
const quizService = require('../services/quizService');
const strokeService = require('../services/strokeService');

/**
 * QuizController — livello sottile tra route e QuizService.
 * Quiz Kana: dashboard, generazione sessione, invio risultati.
 */

// ─────────────────────────────────────────────
// GET /api/quiz/dashboard
// Statistiche utente + mastered + peggiori kana.
// ─────────────────────────────────────────────
exports.dashboard = catchAsync(async (req, res) => {
  const dati = await quizService.getDashboard(req.user.id);

  res.status(200).json({
    status: 'success',
    data: dati,
  });
});

// ─────────────────────────────────────────────
// POST /api/quiz/generate
// Riceve i filtri di gioco e restituisce la sessione di quiz generata.
// ─────────────────────────────────────────────
exports.generaQuiz = catchAsync(async (req, res) => {
  const { alfabeto, gruppi, includiDakuon, includiYoon } = req.body;

  const sessione = await quizService.generateQuizPool(req.user.id, {
    alfabeto,
    gruppi,
    includiDakuon,
    includiYoon,
  });

  res.status(200).json({
    status: 'success',
    data: { sessione },
  });
});

// ─────────────────────────────────────────────
// POST /api/quiz/submit
// Riceve l'esito della partita, aggiorna il DB e restituisce le statistiche
// aggiornate insieme agli XP/livelli guadagnati nel round.
// ─────────────────────────────────────────────
exports.inviaRisultati = catchAsync(async (req, res) => {
  const { risposte, datiBonus } = req.body;

  const esito = await quizService.submitQuizResults(req.user.id, risposte, datiBonus || {});

  res.status(200).json({
    status: 'success',
    message: 'Risultati salvati con successo.',
    data: esito,
  });
});

// ─────────────────────────────────────────────
// GET /api/quiz/stroke/:alfabeto
// Ordine dei tratti (dati statici KanjiVG) di tutti i kana dell'alfabeto:
// alimenta la visualizzazione animata e gli esercizi di scrittura su canvas.
// Sola lettura, non dipende dall'utente ⇒ cacheabile a lungo lato client.
// ─────────────────────────────────────────────
exports.ordineTratti = catchAsync(async (req, res) => {
  const { alfabeto } = req.params;

  const ordineTratti = strokeService.getStrokeOrderByAlfabeto(alfabeto);

  res.status(200).json({
    status: 'success',
    data: { ordineTratti },
  });
});
