'use strict';

const catchAsync = require('../utils/catchAsync');
const calendarioService = require('../services/calendarioService');

/**
 * CalendarioController — livello sottile tra route e CalendarioService.
 * Due gruppi di azioni: FEED (studenti + insegnanti) e gestione eventi
 * (insegnante|admin: CRUD e destinatari).
 */

// ═════════════════════════════ FEED (tutti i ruoli) ═════════════════════════════

// GET /api/calendario
exports.feed = catchAsync(async (req, res) => {
  const { da, a, tipoVoce } = req.query;

  // Le scadenze dei compiti entrano nel feed solo se la scuola ha la sezione
  // Compiti attiva. `req.funzionalita` è valorizzato dal gate per i non-admin;
  // l'admin è trasversale e le vede sempre.
  const includiCompiti =
    req.user.ruolo === 'admin' ? true : Boolean(req.funzionalita && req.funzionalita.compiti);

  const dati = await calendarioService.feedCalendario({
    richiedente: req.user,
    filtri: { da, a, tipoVoce },
    includiCompiti,
  });

  res.status(200).json({
    status: 'success',
    results: dati.voci.length,
    data: dati,
  });
});

// ═════════════════════════════ GESTIONE EVENTI ═════════════════════════════

// POST /api/calendario/eventi
exports.creaEvento = catchAsync(async (req, res) => {
  const {
    titolo, descrizione, tipo, dataInizio, dataFine, tuttoIlGiorno,
    luogo, linkVideochiamata, colore, destinatari,
  } = req.body;

  const evento = await calendarioService.creaEvento({
    dati: {
      titolo, descrizione, tipo, dataInizio, dataFine, tuttoIlGiorno,
      luogo, linkVideochiamata, colore,
    },
    destinatari,
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Evento creato con successo.',
    data: { evento },
  });
});

// GET /api/calendario/eventi
exports.elencoEventi = catchAsync(async (req, res) => {
  const { tipo, q, da, a, page, limit } = req.query;

  const { eventi, paginazione } = await calendarioService.elencoEventi({
    richiedente: req.user,
    filtri: { tipo, q, da, a, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: eventi.length,
    data: { eventi },
    ...(paginazione && { paginazione }),
  });
});

// GET /api/calendario/eventi/:id
exports.dettaglioEvento = catchAsync(async (req, res) => {
  const evento = await calendarioService.dettaglioEvento({
    eventoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', data: { evento } });
});

// PATCH /api/calendario/eventi/:id
exports.aggiornaEvento = catchAsync(async (req, res) => {
  const {
    titolo, descrizione, tipo, dataInizio, dataFine, tuttoIlGiorno,
    luogo, linkVideochiamata, colore,
  } = req.body;

  const evento = await calendarioService.aggiornaEvento({
    eventoId: req.params.id,
    dati: {
      titolo, descrizione, tipo, dataInizio, dataFine, tuttoIlGiorno,
      luogo, linkVideochiamata, colore,
    },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Evento aggiornato con successo.',
    data: { evento },
  });
});

// DELETE /api/calendario/eventi/:id
exports.eliminaEvento = catchAsync(async (req, res) => {
  await calendarioService.eliminaEvento({
    eventoId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', message: 'Evento eliminato con successo.' });
});

// POST /api/calendario/eventi/:id/destinatari
exports.aggiungiDestinatario = catchAsync(async (req, res) => {
  const { classeId, utenteId } = req.body;

  const destinatario = await calendarioService.aggiungiDestinatario({
    eventoId: req.params.id,
    bersaglio: { classeId, utenteId },
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Destinatario aggiunto con successo.',
    data: { destinatario },
  });
});

// DELETE /api/calendario/eventi/:id/destinatari/:destinatarioId
exports.rimuoviDestinatario = catchAsync(async (req, res) => {
  await calendarioService.rimuoviDestinatario({
    eventoId: req.params.id,
    destinatarioId: req.params.destinatarioId,
    richiedente: req.user,
  });

  res.status(200).json({ status: 'success', message: 'Destinatario rimosso con successo.' });
});
