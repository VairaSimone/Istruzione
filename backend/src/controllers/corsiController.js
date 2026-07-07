'use strict';

const catchAsync = require('../utils/catchAsync');
const corsiService = require('../services/corsiService');

/**
 * CorsiController — livello sottile tra route e CorsiService.
 * Videolezioni on-demand: CRUD corsi/capitoli/documenti, disponibilità presso
 * le aule e viste studente. Nessuna logica di dominio qui: solo estrazione
 * input, delega al service e formattazione della risposta.
 */

// ═════════════════════════════════════════════
// STAFF (insegnante | admin)
// ═════════════════════════════════════════════

// POST /api/corsi
exports.creaCorso = catchAsync(async (req, res) => {
  const { titolo, descrizione, copertinaUrl, livelloJLPT, stato, videoScaricabile, scuolaId, capitoli } = req.body;

  const corso = await corsiService.creaCorso({
    dati: { titolo, descrizione, copertinaUrl, livelloJLPT, stato, videoScaricabile, scuolaId },
    capitoli,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Corso creato con successo.',
    data: { corso },
  });
});

// GET /api/corsi
exports.elencoCorsi = catchAsync(async (req, res) => {
  const { stato, livello, q, scuola, page, limit } = req.query;

  const { corsi, paginazione } = await corsiService.elencoCorsi({
    richiedente: req.user,
    filtri: { stato, livello, q, scuola, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: corsi.length,
    data: { corsi },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/corsi/:id
exports.dettaglioCorso = catchAsync(async (req, res) => {
  const corso = await corsiService.dettaglioCorso({
    corsoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    data: { corso },
  });
});

// PATCH /api/corsi/:id
exports.aggiornaCorso = catchAsync(async (req, res) => {
  const { titolo, descrizione, copertinaUrl, livelloJLPT, stato, videoScaricabile } = req.body;

  const corso = await corsiService.aggiornaCorso({
    corsoId: req.params.id,
    dati: { titolo, descrizione, copertinaUrl, livelloJLPT, stato, videoScaricabile },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Corso aggiornato con successo.',
    data: { corso },
  });
});

// DELETE /api/corsi/:id
exports.eliminaCorso = catchAsync(async (req, res) => {
  await corsiService.eliminaCorso({
    corsoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Corso eliminato con successo.',
  });
});

// POST /api/corsi/:id/capitoli
exports.aggiungiCapitolo = catchAsync(async (req, res) => {
  const { titolo, descrizione, videoUrl, videoDurataSecondi, scaricabile, ordine } = req.body;

  const capitolo = await corsiService.aggiungiCapitolo({
    corsoId: req.params.id,
    dati: { titolo, descrizione, videoUrl, videoDurataSecondi, scaricabile, ordine },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Capitolo aggiunto con successo.',
    data: { capitolo },
  });
});

// PATCH /api/corsi/:id/capitoli/:capitoloId
exports.aggiornaCapitolo = catchAsync(async (req, res) => {
  const { titolo, descrizione, videoUrl, videoDurataSecondi, scaricabile, ordine } = req.body;

  const capitolo = await corsiService.aggiornaCapitolo({
    corsoId: req.params.id,
    capitoloId: req.params.capitoloId,
    dati: { titolo, descrizione, videoUrl, videoDurataSecondi, scaricabile, ordine },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Capitolo aggiornato con successo.',
    data: { capitolo },
  });
});

// DELETE /api/corsi/:id/capitoli/:capitoloId
exports.eliminaCapitolo = catchAsync(async (req, res) => {
  await corsiService.eliminaCapitolo({
    corsoId: req.params.id,
    capitoloId: req.params.capitoloId,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Capitolo eliminato con successo.',
  });
});

// POST /api/corsi/:id/capitoli/:capitoloId/documenti
exports.aggiungiDocumento = catchAsync(async (req, res) => {
  const { titolo, url, ordine } = req.body;

  const documento = await corsiService.aggiungiDocumento({
    corsoId: req.params.id,
    capitoloId: req.params.capitoloId,
    dati: { titolo, url, ordine },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Documento aggiunto con successo.',
    data: { documento },
  });
});

// DELETE /api/corsi/:id/capitoli/:capitoloId/documenti/:documentoId
exports.eliminaDocumento = catchAsync(async (req, res) => {
  await corsiService.eliminaDocumento({
    corsoId: req.params.id,
    capitoloId: req.params.capitoloId,
    documentoId: req.params.documentoId,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Documento eliminato con successo.',
  });
});

// POST /api/corsi/:id/disponibilita   (rendi disponibile a un'aula)
exports.rendiDisponibile = catchAsync(async (req, res) => {
  const { classeId } = req.body;

  const aula = await corsiService.rendiDisponibile({
    corsoId: req.params.id,
    classeId,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: "Corso reso disponibile all'aula.",
    data: { aula },
  });
});

// DELETE /api/corsi/:id/disponibilita/:classeId   (revoca disponibilità)
exports.revocaDisponibilita = catchAsync(async (req, res) => {
  await corsiService.revocaDisponibilita({
    corsoId: req.params.id,
    classeId: req.params.classeId,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: "Disponibilità del corso revocata per l'aula.",
  });
});

// ═════════════════════════════════════════════
// STUDENTE
// ═════════════════════════════════════════════

// GET /api/corsi/studente
exports.elencoCorsiStudente = catchAsync(async (req, res) => {
  const { livello, q, page, limit } = req.query;

  const { corsi, paginazione } = await corsiService.elencoCorsiStudente({
    studente: req.user,
    filtri: { livello, q, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: corsi.length,
    data: { corsi },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/corsi/studente/:id
exports.dettaglioCorsoStudente = catchAsync(async (req, res) => {
  const corso = await corsiService.dettaglioCorsoStudente({
    corsoId: req.params.id,
    studente: req.user,
  });

  res.status(200).json({
    status: 'success',
    data: { corso },
  });
});
