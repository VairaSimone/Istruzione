'use strict';

const catchAsync = require('../utils/catchAsync');
const quizGestioneService = require('../services/quizGestioneService');

/**
 * QuizGestioneController — livello sottile tra route e QuizGestioneService.
 *
 * Gestione dei quiz delle SCUOLE: catalogo dei template installabili, CRUD dei
 * quiz (personalizzati o installati da un template), CRUD delle domande,
 * abilitazione presso le aule e vista dei quiz giocabili.
 *
 * Nessuna logica di dominio qui: estrazione input, delega al service,
 * formattazione della risposta.
 */

// ═════════════════════════════════════════════
// CATALOGO TEMPLATE
// ═════════════════════════════════════════════

// GET /api/quiz/templates
exports.elencoTemplate = catchAsync(async (req, res) => {
  const template = await quizGestioneService.elencoTemplate({
    richiedente: req.user,
    scuolaIdRichiesta: req.query.scuola,
  });

  res.status(200).json({
    status: 'success',
    results: template.length,
    data: { template },
  });
});

// ═════════════════════════════════════════════
// STAFF — CRUD QUIZ
// ═════════════════════════════════════════════

// POST /api/quiz/gestione
exports.creaQuiz = catchAsync(async (req, res) => {
  const {
    titolo,
    descrizione,
    materia,
    categoria,
    templateCodice,
    configurazione,
    stato,
    dimensioneRound,
    mescolaDomande,
    scuolaId,
    domande,
  } = req.body;

  const quiz = await quizGestioneService.creaQuiz({
    dati: {
      titolo,
      descrizione,
      materia,
    categoria,
      templateCodice,
      configurazione,
      stato,
      dimensioneRound,
      mescolaDomande,
      scuolaId,
    },
    domande,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Quiz creato con successo.',
    data: { quiz },
  });
});

// GET /api/quiz/gestione
exports.elencoQuiz = catchAsync(async (req, res) => {
  const { stato, materia, categoria, template, q, scuola, page, limit } = req.query;

  const { quiz, paginazione } = await quizGestioneService.elencoQuiz({
    richiedente: req.user,
    filtri: { stato, materia, categoria, template, q, scuola, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: quiz.length,
    data: { quiz },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/quiz/gestione/:id
exports.dettaglioQuiz = catchAsync(async (req, res) => {
  const quiz = await quizGestioneService.dettaglioQuiz({
    quizId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    data: { quiz },
  });
});

// PATCH /api/quiz/gestione/:id
exports.aggiornaQuiz = catchAsync(async (req, res) => {
  const {
    titolo,
    descrizione,
    materia,
    categoria,
    templateCodice,
    configurazione,
    stato,
    dimensioneRound,
    mescolaDomande,
  } = req.body;

  const quiz = await quizGestioneService.aggiornaQuiz({
    quizId: req.params.id,
    dati: {
      titolo,
      descrizione,
      materia,
    categoria,
      templateCodice,
      configurazione,
      stato,
      dimensioneRound,
      mescolaDomande,
    },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Quiz aggiornato con successo.',
    data: { quiz },
  });
});

// DELETE /api/quiz/gestione/:id
exports.eliminaQuiz = catchAsync(async (req, res) => {
  await quizGestioneService.eliminaQuiz({
    quizId: req.params.id,
    richiedente: req.user,
  });

  res.status(204).send();
});

// ═════════════════════════════════════════════
// STAFF — DOMANDE (solo quiz personalizzati)
// ═════════════════════════════════════════════

// POST /api/quiz/gestione/:id/domande
exports.aggiungiDomanda = catchAsync(async (req, res) => {
  const domanda = await quizGestioneService.aggiungiDomanda({
    quizId: req.params.id,
    dati: req.body,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Domanda aggiunta con successo.',
    data: { domanda },
  });
});

// PATCH /api/quiz/gestione/:id/domande/:domandaId
exports.aggiornaDomanda = catchAsync(async (req, res) => {
  const domanda = await quizGestioneService.aggiornaDomanda({
    quizId: req.params.id,
    domandaId: req.params.domandaId,
    dati: req.body,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Domanda aggiornata con successo.',
    data: { domanda },
  });
});

// DELETE /api/quiz/gestione/:id/domande/:domandaId
exports.eliminaDomanda = catchAsync(async (req, res) => {
  await quizGestioneService.eliminaDomanda({
    quizId: req.params.id,
    domandaId: req.params.domandaId,
    richiedente: req.user,
  });

  res.status(204).send();
});

// ═════════════════════════════════════════════
// STAFF — ABILITAZIONE PRESSO LE AULE
// ═════════════════════════════════════════════

// POST /api/quiz/gestione/:id/aule
exports.abilitaPerAula = catchAsync(async (req, res) => {
  const aula = await quizGestioneService.abilitaPerAula({
    quizId: req.params.id,
    classeId: req.body.classeId,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: "Quiz abilitato per l'aula.",
    data: { aula },
  });
});

// DELETE /api/quiz/gestione/:id/aule/:classeId
exports.disabilitaPerAula = catchAsync(async (req, res) => {
  await quizGestioneService.disabilitaPerAula({
    quizId: req.params.id,
    classeId: req.params.classeId,
    richiedente: req.user,
  });

  res.status(204).send();
});

// ═════════════════════════════════════════════
// VISTA GIOCATORE
// ═════════════════════════════════════════════

// GET /api/quiz/disponibili
exports.quizDisponibili = catchAsync(async (req, res) => {
  const { materia, categoria, scuola } = req.query;

  const { quiz } = await quizGestioneService.quizDisponibili({
    richiedente: req.user,
    filtri: { materia, categoria, scuola },
  });

  res.status(200).json({
    status: 'success',
    results: quiz.length,
    data: { quiz },
  });
});
