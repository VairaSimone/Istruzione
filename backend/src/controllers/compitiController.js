'use strict';

const catchAsync = require('../utils/catchAsync');
const compitiService = require('../services/compitiService');

/**
 * CompitiController — livello sottile tra route e CompitiService.
 * Due gruppi di azioni: gestione docente (CRUD, assegnazioni, valutazione) e
 * vista studente (elenco per stato, dettaglio, consegna).
 */

// ═════════════════════════════ DOCENTE ═════════════════════════════

// POST /api/compiti
exports.creaCompito = catchAsync(async (req, res) => {
  const {
    titolo, descrizione, tipoAttivita, configurazione,
    dataScadenza, tempoLimiteMinuti, punteggioMassimo, stato, assegnazioni,
  } = req.body;

  const compito = await compitiService.creaCompito({
    dati: {
      titolo, descrizione, tipoAttivita, configurazione,
      dataScadenza, tempoLimiteMinuti, punteggioMassimo, stato,
    },
    assegnazioni,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Compito creato con successo.',
    data: { compito },
  });
});

// GET /api/compiti
exports.elencoCompiti = catchAsync(async (req, res) => {
  const { stato, tipo, q, page, limit } = req.query;

  const { compiti, paginazione } = await compitiService.elencoCompiti({
    richiedente: req.user,
    filtri: { stato, tipo, q, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: compiti.length,
    data: { compiti },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/compiti/:id
exports.dettaglioCompito = catchAsync(async (req, res) => {
  const compito = await compitiService.dettaglioCompito({
    compitoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', data: { compito } });
});

// PATCH /api/compiti/:id
exports.aggiornaCompito = catchAsync(async (req, res) => {
  const {
    titolo, descrizione, tipoAttivita, configurazione,
    dataScadenza, tempoLimiteMinuti, punteggioMassimo, stato,
  } = req.body;

  const compito = await compitiService.aggiornaCompito({
    compitoId: req.params.id,
    dati: {
      titolo, descrizione, tipoAttivita, configurazione,
      dataScadenza, tempoLimiteMinuti, punteggioMassimo, stato,
    },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Compito aggiornato con successo.',
    data: { compito },
  });
});

// DELETE /api/compiti/:id
exports.eliminaCompito = catchAsync(async (req, res) => {
  await compitiService.eliminaCompito({
    compitoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', message: 'Compito eliminato con successo.' });
});

// POST /api/compiti/:id/assegnazioni
exports.aggiungiAssegnazione = catchAsync(async (req, res) => {
  const { classeId, utenteId } = req.body;

  const assegnazione = await compitiService.aggiungiAssegnazione({
    compitoId: req.params.id,
    bersaglio: { classeId, utenteId },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Compito assegnato con successo.',
    data: { assegnazione },
  });
});

// DELETE /api/compiti/:id/assegnazioni/:assegnazioneId
exports.rimuoviAssegnazione = catchAsync(async (req, res) => {
  await compitiService.rimuoviAssegnazione({
    compitoId: req.params.id,
    assegnazioneId: req.params.assegnazioneId,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', message: 'Assegnazione rimossa con successo.' });
});

// GET /api/compiti/:id/consegne
exports.elencoConsegne = catchAsync(async (req, res) => {
  const dati = await compitiService.elencoConsegne({
    compitoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    results: dati.consegne.length,
    data: dati,
  });
});

// PATCH /api/compiti/:id/consegne/:utenteId
exports.valutaConsegna = catchAsync(async (req, res) => {
  const { punteggioOttenuto, feedback } = req.body;

  const consegna = await compitiService.valutaConsegna({
    compitoId: req.params.id,
    utenteId: req.params.utenteId,
    dati: { punteggioOttenuto, feedback },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Consegna valutata con successo.',
    data: { consegna },
  });
});

// ═════════════════════════════ STUDENTE ═════════════════════════════

// GET /api/compiti/studente
exports.elencoStudente = catchAsync(async (req, res) => {
  const { stato, page, limit } = req.query;

  const { compiti, paginazione } = await compitiService.elencoCompitiStudente({
    studente: req.user,
    filtri: { stato, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: compiti.length,
    data: { compiti },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/compiti/studente/:id
exports.dettaglioStudente = catchAsync(async (req, res) => {
  const compito = await compitiService.dettaglioCompitoStudente({
    compitoId: req.params.id,
    studente: req.user,
  });

  res.status(200).json({ status: 'success', data: { compito } });
});

// POST /api/compiti/studente/:id/consegna
exports.consegna = catchAsync(async (req, res) => {
  const { punteggioOttenuto, tempoImpiegatoSecondi } = req.body;

  const consegna = await compitiService.consegnaCompito({
    compitoId: req.params.id,
    studente: req.user,
    dati: { punteggioOttenuto, tempoImpiegatoSecondi },
  });

  res.status(201).json({
    status: 'success',
    message: 'Compito consegnato con successo.',
    data: { consegna },
  });
});
