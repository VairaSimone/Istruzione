'use strict';

const catchAsync = require('../utils/catchAsync');
const pagamentiService = require('../services/pagamentiService');
const stripeService = require('../services/stripeService');
const logger = require('../utils/logger');

/**
 * PagamentiController — livello sottile tra route e pagamentiService.
 * Nessuna logica di dominio: estrae input, delega, formatta la risposta.
 */

// ═════════════════════════════════════════════
// CONFIGURAZIONE (staff | admin)
// ═════════════════════════════════════════════

// GET /api/pagamenti/config
exports.config = catchAsync(async (req, res) => {
  const config = await pagamentiService.configScuola(req.user, req.query.scuolaId);
  res.status(200).json({ status: 'success', data: { config } });
});

// PATCH /api/pagamenti/config
exports.aggiornaConfig = catchAsync(async (req, res) => {
  const config = await pagamentiService.aggiornaConfigScuola(
    req.user,
    { attivi: req.body.attivi },
    req.body.scuolaId
  );
  res.status(200).json({
    status: 'success',
    message: 'Configurazione pagamenti aggiornata.',
    data: { config },
  });
});

// POST /api/pagamenti/onboarding
exports.onboarding = catchAsync(async (req, res) => {
  const { url } = await pagamentiService.avviaOnboarding(req.user, req.body.scuolaId);
  res.status(200).json({ status: 'success', data: { url } });
});

// GET /api/pagamenti/onboarding/stato
exports.statoOnboarding = catchAsync(async (req, res) => {
  const config = await pagamentiService.statoOnboarding(req.user, req.query.scuolaId);
  res.status(200).json({ status: 'success', data: { config } });
});

// ═════════════════════════════════════════════
// CATALOGO & CHECKOUT (studente)
// ═════════════════════════════════════════════

// GET /api/pagamenti/catalogo
exports.catalogo = catchAsync(async (req, res) => {
  const dati = await pagamentiService.catalogo(req.user);
  res.status(200).json({ status: 'success', data: dati });
});

// POST /api/pagamenti/checkout
exports.checkout = catchAsync(async (req, res) => {
  const { url, pagamentoId } = await pagamentiService.creaCheckout({
    richiedente: req.user,
    corsoId: req.body.corsoId,
  });
  res.status(201).json({
    status: 'success',
    message: 'Sessione di pagamento creata.',
    data: { url, pagamentoId },
  });
});

// ═════════════════════════════════════════════
// ELENCHI
// ═════════════════════════════════════════════

// GET /api/pagamenti/miei
exports.miei = catchAsync(async (req, res) => {
  const pagamenti = await pagamentiService.elencoMiei(req.user);
  res.status(200).json({ status: 'success', data: { pagamenti } });
});

// GET /api/pagamenti/scuola
exports.scuola = catchAsync(async (req, res) => {
  const pagamenti = await pagamentiService.elencoScuola(req.user, {
    stato: req.query.stato,
    scuolaId: req.query.scuolaId,
  });
  res.status(200).json({ status: 'success', data: { pagamenti } });
});

// ═════════════════════════════════════════════
// WEBHOOK (pubblico, corpo RAW)
// ═════════════════════════════════════════════
// Montato in app.js PRIMA di express.json/CORS/CSRF: riceve `req.body` come
// Buffer grezzo, indispensabile per verificare la firma. Risponde SEMPRE 200
// dopo una verifica riuscita, così Stripe non ritenta all'infinito; gli errori
// di elaborazione sono loggati ma non propagati come 5xx (che causerebbero
// retry inutili quando il problema è nostro e non transitorio).
exports.webhook = catchAsync(async (req, res) => {
  const firma = req.get('stripe-signature');
  // `verificaWebhook` lancia 400 se la firma non è valida (gestito dall'handler
  // errori globale): in quel caso NON confermiamo la ricezione.
  const evento = stripeService.verificaWebhook(req.body, firma);

  try {
    await pagamentiService.gestisciEvento(evento);
  } catch (err) {
    // Un errore nostro non deve trasformarsi in un retry perpetuo di Stripe:
    // logghiamo e confermiamo comunque la ricezione dell'evento.
    logger.error(`[PAGAMENTI] Elaborazione webhook ${evento.type} fallita: ${err.message}`);
  }

  res.status(200).json({ received: true });
});
