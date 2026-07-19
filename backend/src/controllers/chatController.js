'use strict';

const catchAsync = require('../utils/catchAsync');
const chatService = require('../services/chatService');
const fileService = require('../services/fileService');

/**
 * ChatController — livello sottile tra route e ChatService per la CHAT D'AULA.
 * Estrae l'input, delega al service e formatta la risposta. Autorizzazione,
 * tenant e regole di dominio vivono nel service.
 */

// GET /api/chat/aule
exports.elencoAule = catchAsync(async (req, res) => {
  const aule = await chatService.elencoAule({ richiedente: req.user });
  res.status(200).json({
    status: 'success',
    results: aule.length,
    data: { aule },
  });
});

// GET /api/chat/notifiche
exports.notifiche = catchAsync(async (req, res) => {
  const dati = await chatService.contaNonLetti({ richiedente: req.user });
  res.status(200).json({ status: 'success', data: dati });
});

// GET /api/chat/:classeId/messaggi?primaDi=...&limit=...
exports.elencoMessaggi = catchAsync(async (req, res) => {
  const { primaDi, limit } = req.query;

  const dati = await chatService.elencoMessaggi({
    classeId: req.params.classeId,
    richiedente: req.user,
    filtri: { primaDi, limit },
  });

  res.status(200).json({
    status: 'success',
    results: dati.messaggi.length,
    data: dati,
  });
});

// POST /api/chat/:classeId/messaggi
exports.inviaMessaggio = catchAsync(async (req, res) => {
  const { corpo } = req.body;

  const messaggio = await chatService.inviaMessaggio({
    classeId: req.params.classeId,
    corpo,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Messaggio inviato con successo.',
    data: { messaggio },
  });
});

// POST /api/chat/:classeId/messaggi/allegato/:tipo
exports.inviaMessaggioConAllegato = catchAsync(async (req, res) => {
  const { corpo } = req.body;

  const messaggio = await chatService.inviaMessaggioConAllegato({
    classeId: req.params.classeId,
    tipo: req.params.tipo,
    corpo,
    file: req.file,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Messaggio inviato con successo.',
    data: { messaggio },
  });
});

// POST /api/chat/:classeId/letto
exports.segnaLetto = catchAsync(async (req, res) => {
  const dati = await chatService.segnaLetto({
    classeId: req.params.classeId,
    richiedente: req.user,
  });
  res.status(200).json({
    status: 'success',
    message: 'Chat segnata come letta.',
    data: dati,
  });
});

// DELETE /api/chat/:classeId/messaggi/:messaggioId
exports.eliminaMessaggio = catchAsync(async (req, res) => {
  await chatService.eliminaMessaggio({
    classeId: req.params.classeId,
    messaggioId: req.params.messaggioId,
    richiedente: req.user,
  });
  res.status(200).json({ status: 'success', message: 'Messaggio eliminato con successo.' });
});

// GET /api/chat/:classeId/file/:fileId
// Streaming protetto dell'allegato: l'accesso (membro dell'aula) è deciso da
// chatService.risolviAccessoFile.
exports.serviFile = catchAsync(async (req, res) => {
  const { file } = await chatService.risolviAccessoFile({
    classeId: req.params.classeId,
    fileId: req.params.fileId,
    richiedente: req.user,
  });

  return fileService.inviaFile(req, res, file);
});
