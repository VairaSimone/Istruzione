'use strict';

const catchAsync = require('../utils/catchAsync');
const messaggiService = require('../services/messaggiService');

/**
 * MessaggiController — livello sottile tra route e MessaggiService.
 * Invio (docente), inbox/notifiche/lettura/risposte (docente e studente),
 * note private e feedback su compiti.
 */

// ═════════════════════════════ DOCENTE ═════════════════════════════

// POST /api/messaggi
exports.inviaMessaggio = catchAsync(async (req, res) => {
  const {
    tipo, oggetto, corpo, studenteId, classeId,
    compitoId, notaSuUtenteId, consentiRisposte,
  } = req.body;

  const messaggio = await messaggiService.inviaMessaggio({
    dati: { tipo, oggetto, corpo, studenteId, classeId, compitoId, notaSuUtenteId, consentiRisposte },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Messaggio inviato con successo.',
    data: { messaggio },
  });
});

// POST /api/messaggi/feedback-compito
exports.inviaFeedbackCompito = catchAsync(async (req, res) => {
  const { compitoId, studenteId, corpo, punteggio } = req.body;

  const dati = await messaggiService.inviaFeedbackCompito({
    compitoId,
    studenteId,
    corpo,
    punteggio,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Feedback inviato con successo.',
    data: dati,
  });
});

// GET /api/messaggi/inviati
exports.elencoInviati = catchAsync(async (req, res) => {
  const { page, limit } = req.query;

  const { messaggi, paginazione } = await messaggiService.elencoInviati({
    richiedente: req.user,
    filtri: { page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: messaggi.length,
    data: { messaggi },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/messaggi/note
exports.elencoNote = catchAsync(async (req, res) => {
  const { page, limit } = req.query;

  const { note, paginazione } = await messaggiService.elencoNote({
    richiedente: req.user,
    filtri: { page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: note.length,
    data: { note },
    ...(paginazione && { paginazione }),
  });
});

// ═════════════════════════════ CONDIVISE (docente + studente) ═════════════════════════════

// GET /api/messaggi/ricevuti?nonLetti=true
exports.elencoRicevuti = catchAsync(async (req, res) => {
  const { nonLetti, page, limit } = req.query;

  const { messaggi, paginazione } = await messaggiService.elencoRicevuti({
    utente: req.user,
    filtri: { nonLetti, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: messaggi.length,
    data: { messaggi },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/messaggi/notifiche
exports.notifiche = catchAsync(async (req, res) => {
  const dati = await messaggiService.contaNonLetti({ utente: req.user });
  res.status(200).json({ status: 'success', data: dati });
});

// GET /api/messaggi/:id
exports.dettaglioMessaggio = catchAsync(async (req, res) => {
  const messaggio = await messaggiService.dettaglioMessaggio({
    messaggioId: req.params.id,
    utente: req.user,
  });
  res.status(200).json({ status: 'success', data: { messaggio } });
});

// POST /api/messaggi/:id/letto
exports.segnaLetto = catchAsync(async (req, res) => {
  const destinatario = await messaggiService.segnaLetto({
    messaggioId: req.params.id,
    utente: req.user,
  });
  res.status(200).json({
    status: 'success',
    message: 'Messaggio segnato come letto.',
    data: { destinatario },
  });
});

// POST /api/messaggi/:id/rispondi
exports.rispondi = catchAsync(async (req, res) => {
  const { corpo } = req.body;

  const risposta = await messaggiService.rispondi({
    messaggioId: req.params.id,
    corpo,
    utente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Risposta inviata con successo.',
    data: { messaggio: risposta },
  });
});

// DELETE /api/messaggi/:id
exports.eliminaMessaggio = catchAsync(async (req, res) => {
  await messaggiService.eliminaMessaggio({
    messaggioId: req.params.id,
    richiedente: req.user,
  });
  res.status(200).json({ status: 'success', message: 'Messaggio eliminato con successo.' });
});
