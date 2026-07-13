'use strict';

const catchAsync = require('../utils/catchAsync');
const quizService = require('../services/quizService');
const strokeService = require('../services/strokeService');
const gamificationService = require('../services/gamificationService');

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
//
// Supporta due domini tramite lo stesso endpoint (nessuna duplicazione):
//   - dominio='kana'  (default): usa alfabeto/gruppi/includiDakuon/includiYoon;
//   - dominio='kanji':           usa livello (JLPT), tipoQuiz, lingua.
// L'assenza di `dominio` mantiene il comportamento storico (retrocompatibilità
// con il frontend esistente, che invia solo i filtri kana).
//
// Con `quizId` la partita nasce invece da un quiz della scuola: il motore, la
// configurazione e la dimensione del round li decide il quiz, e i filtri del
// client valgono solo sui campi che la scuola non ha fissato.
// ─────────────────────────────────────────────
exports.generaQuiz = catchAsync(async (req, res) => {
  const {
    quizId,
    dominio,
    alfabeto,
    gruppi,
    includiDakuon,
    includiYoon,
    livello,
    tipoQuiz,
    lingua,
    bancaCodice,
    modalita,
    sezioni,
  } = req.body;

  const sessione = await quizService.generateQuizPool(req.user, {
    // quiz della scuola (template installato o quiz personalizzato)
    quizId,
    // dominio kana (default)
    dominio,
    alfabeto,
    gruppi,
    includiDakuon,
    includiYoon,
    // dominio kanji
    livello,
    tipoQuiz,
    lingua: lingua || req.language || 'it',
    // motore banca (esercizio libero o override modalità/sezioni)
    bancaCodice,
    modalita,
    sezioni,
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
//
// `dominio` (default 'kana') instrada l'aggiornamento SRS verso il modello
// corretto (ProgressoKana | ProgressoKanji); la parte utente (XP/streak/record)
// è condivisa. L'assenza del campo preserva il comportamento storico.
//
// Con `quizId` il motore lo determina il quiz; per i quiz personalizzati la
// correzione avviene lato server (il client invia la risposta, non l'esito).
// ─────────────────────────────────────────────
exports.inviaRisultati = catchAsync(async (req, res) => {
  const { risposte, datiBonus, dominio, quizId } = req.body;

  const esito = await quizService.submitQuizResults(
    req.user,
    risposte,
    datiBonus || {},
    dominio || 'kana',
    quizId || null
  );

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

// ─────────────────────────────────────────────
// GET /api/quiz/stroke/kanji/:livello
// Ordine dei tratti (dati statici KanjiVG) di tutti i kanji di un livello JLPT:
// alimenta la stessa visualizzazione animata / esercizi di scrittura dei kana,
// tramite l'interfaccia unica dello strokeService. Sola lettura, cacheabile.
// La lingua dei significati arriva da `?lingua=` o dalla lingua della richiesta.
// ─────────────────────────────────────────────
exports.ordineTrattiKanji = catchAsync(async (req, res) => {
  const { livello } = req.params;
  const lingua = req.query.lingua || req.language || 'it';

  const ordineTratti = strokeService.getStrokeOrderKanji(livello, lingua);

  res.status(200).json({
    status: 'success',
    data: { ordineTratti },
  });
});
// Registra una sessione di scrittura su canvas (numero di tratti validati
// lato client), assegna gli XP relativi e valuta i badge. Muta lo stato.
// ─────────────────────────────────────────────
exports.registraScrittura = catchAsync(async (req, res) => {
  const { trattiValidati, caratteriErrati } = req.body;

  const esito = await gamificationService.registraScrittura(
    req.user.id,
    trattiValidati,
    caratteriErrati || []
  );

  res.status(200).json({
    status: 'success',
    message: 'Progresso di scrittura registrato.',
    data: esito,
  });
});

// ─────────────────────────────────────────────
// GET /api/quiz/badge
// Catalogo completo dei badge con lo stato di sblocco dell'utente, le
// statistiche di gioco e i totali per le barre di progresso. Sola lettura.
// ─────────────────────────────────────────────
exports.profiloBadge = catchAsync(async (req, res) => {
  const dati = await gamificationService.getProfiloBadge(req.user.id);

  res.status(200).json({
    status: 'success',
    data: dati,
  });
});
