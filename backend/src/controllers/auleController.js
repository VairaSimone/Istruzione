'use strict';

const catchAsync = require('../utils/catchAsync');
const auleService = require('../services/auleService');

/**
 * AuleController — livello sottile tra route e AuleService.
 * Gestione delle aule virtuali: CRUD, membership (studenti/insegnanti),
 * inviti in aula. Nessuna logica di dominio qui: solo estrazione input,
 * delega al service e formattazione della risposta.
 */

// ─────────────────────────────────────────────
// POST /api/aule
// ─────────────────────────────────────────────
exports.creaClasse = catchAsync(async (req, res) => {
  const { nome, descrizione, annoScolastico, livelloJLPT, colore, icona } = req.body;

  const classe = await auleService.creaClasse({
    dati: { nome, descrizione, annoScolastico, livelloJLPT, colore, icona },
    creatore: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Aula creata con successo.',
    data: { classe },
  });
});

// ─────────────────────────────────────────────
// GET /api/aule
// ─────────────────────────────────────────────
exports.elencoClassi = catchAsync(async (req, res) => {
  const { livello, anno, archiviata, q, page, limit } = req.query;

  const { classi, paginazione } = await auleService.elencoClassi({
    richiedente: req.user,
    filtri: { livello, anno, archiviata, q, page, limit },
  });

  res.status(200).json({
    status: 'success',
    results: classi.length,
    data: { classi },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// GET /api/aule/:id
// ─────────────────────────────────────────────
exports.dettaglioClasse = catchAsync(async (req, res) => {
  const classe = await auleService.dettaglioClasse({
    classeId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    data: { classe },
  });
});

// ─────────────────────────────────────────────
// PATCH /api/aule/:id
// ─────────────────────────────────────────────
exports.aggiornaClasse = catchAsync(async (req, res) => {
  const { nome, descrizione, annoScolastico, livelloJLPT, colore, icona, archiviata } = req.body;

  const classe = await auleService.aggiornaClasse({
    classeId: req.params.id,
    dati: { nome, descrizione, annoScolastico, livelloJLPT, colore, icona, archiviata },
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Aula aggiornata con successo.',
    data: { classe },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/aule/:id
// ─────────────────────────────────────────────
exports.eliminaClasse = catchAsync(async (req, res) => {
  await auleService.eliminaClasse({
    classeId: req.params.id,
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Aula eliminata con successo.',
  });
});

// ─────────────────────────────────────────────
// POST /api/aule/:id/studenti   (aggiungi studente già registrato)
// ─────────────────────────────────────────────
exports.aggiungiStudente = catchAsync(async (req, res) => {
  const { utenteId, email } = req.body;

  const membro = await auleService.aggiungiMembro({
    classeId: req.params.id,
    riferimento: { utenteId, email },
    ruoloNellaClasse: 'studente',
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Studente aggiunto all\'aula.',
    data: { membro },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/aule/:id/studenti/:utenteId
// ─────────────────────────────────────────────
exports.rimuoviStudente = catchAsync(async (req, res) => {
  await auleService.rimuoviMembro({
    classeId: req.params.id,
    utenteId: req.params.utenteId,
    ruoloNellaClasse: 'studente',
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Studente rimosso dall\'aula.',
  });
});

// ─────────────────────────────────────────────
// POST /api/aule/:id/insegnanti   (aggiungi co-insegnante già registrato)
// ─────────────────────────────────────────────
exports.aggiungiInsegnante = catchAsync(async (req, res) => {
  const { utenteId, email } = req.body;

  const membro = await auleService.aggiungiMembro({
    classeId: req.params.id,
    riferimento: { utenteId, email },
    ruoloNellaClasse: 'insegnante',
    richiedente: req.user,
  });

  res.status(201).json({
    status: 'success',
    message: 'Insegnante aggiunto all\'aula.',
    data: { membro },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/aule/:id/insegnanti/:utenteId
// ─────────────────────────────────────────────
exports.rimuoviInsegnante = catchAsync(async (req, res) => {
  await auleService.rimuoviMembro({
    classeId: req.params.id,
    utenteId: req.params.utenteId,
    ruoloNellaClasse: 'insegnante',
    richiedente: req.user,
  });

  res.status(200).json({
    status: 'success',
    message: 'Insegnante rimosso dall\'aula.',
  });
});

// ─────────────────────────────────────────────
// POST /api/aule/:id/inviti   (invita studente via email nell'aula)
// ─────────────────────────────────────────────
exports.invitaStudente = catchAsync(async (req, res) => {
  const { email } = req.body;

  const { invito, tokenDebug } = await auleService.invitaStudente({
    classeId: req.params.id,
    email,
    richiedente: req.user,
    lingua: req.user.lingua,
  });

  res.status(201).json({
    status: 'success',
    message: 'Invito studente creato e inviato via email.',
    data: { invito },
    ...(tokenDebug && { _debug_token: tokenDebug }),
  });
});
