'use strict';

const catchAsync = require('../utils/catchAsync');
const contattiService = require('../services/contattiService');
const impostazioniService = require('../services/impostazioniService');

/**
 * ContattiController — form pubblico della homepage + gestione dei lead.
 *
 *   - INVIO (pubblico): la scuola destinataria è risolta dal DOMINIO della
 *     richiesta o, sul dominio globale, da `?scuola=`/`X-Scuola`. Nessuna
 *     autenticazione, ma rate limiting e honeypot anti-bot nelle route.
 *   - GESTIONE (staff/admin): elenco, dettaglio, aggiornamento stato, rimozione.
 */

// ─────────────────────────────────────────────
// POST /api/contatti  (pubblico)
// ─────────────────────────────────────────────
exports.inviaRichiesta = catchAsync(async (req, res) => {
  // Honeypot: un campo nascosto che un umano lascia vuoto. Se valorizzato è un
  // bot: rispondiamo 200 senza fare nulla, per non dare segnali all'attaccante.
  if (req.body && typeof req.body.website === 'string' && req.body.website.trim() !== '') {
    return res.status(200).json({
      status: 'success',
      message: 'Richiesta inviata. La scuola ti risponderà al più presto.',
      data: { messaggioConferma: null },
    });
  }

  const scuola = await impostazioniService.risolviTenantRichiesta(req);
  const { tipo, nome, email, telefono, messaggio } = req.body;

  const esito = await contattiService.creaRichiesta(
    scuola,
    { tipo, nome, email, telefono, messaggio },
    { origine: 'homepage', dominio: impostazioniService.estraiHost(req) }
  );

  res.status(201).json({
    status: 'success',
    message: 'Richiesta inviata. La scuola ti risponderà al più presto.',
    data: { id: esito.id, messaggioConferma: esito.messaggioConferma },
  });
});

// ─────────────────────────────────────────────
// GET /api/contatti  (staff/admin)
// ─────────────────────────────────────────────
exports.elencoRichieste = catchAsync(async (req, res) => {
  const { scuolaId, stato, tipo, q, page, limit } = req.query;

  const { richieste, paginazione } = await contattiService.elencoRichieste(req.user, {
    scuolaId,
    stato,
    tipo,
    q,
    page,
    limit,
  });

  res.status(200).json({
    status: 'success',
    results: richieste.length,
    data: { richieste },
    ...(paginazione && { paginazione }),
  });
});

// ─────────────────────────────────────────────
// GET /api/contatti/:id  (staff/admin)
// ─────────────────────────────────────────────
exports.dettaglioRichiesta = catchAsync(async (req, res) => {
  const richiesta = await contattiService.dettaglioRichiesta(req.user, req.params.id);
  res.status(200).json({ status: 'success', data: { richiesta } });
});

// ─────────────────────────────────────────────
// PATCH /api/contatti/:id  (staff/admin)
// ─────────────────────────────────────────────
exports.aggiornaRichiesta = catchAsync(async (req, res) => {
  const { stato, noteInterne, prendiInCarico } = req.body;
  const richiesta = await contattiService.aggiornaRichiesta(req.user, req.params.id, {
    stato,
    noteInterne,
    prendiInCarico,
  });
  res.status(200).json({
    status: 'success',
    message: 'Richiesta aggiornata con successo.',
    data: { richiesta },
  });
});

// ─────────────────────────────────────────────
// DELETE /api/contatti/:id  (staff/admin)
// ─────────────────────────────────────────────
exports.rimuoviRichiesta = catchAsync(async (req, res) => {
  await contattiService.rimuoviRichiesta(req.user, req.params.id);
  res.status(200).json({ status: 'success', message: 'Richiesta eliminata con successo.' });
});
