'use strict';

const stripeCfg = require('../config/stripe');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * stripeService — ADATTATORE sottile verso l'SDK Stripe.
 *
 * Concentra QUI ogni chiamata alle API Stripe, così il resto del dominio
 * (`pagamentiService`) non dipende mai direttamente dall'SDK e resta testabile.
 * Nessuna logica di business: solo traduzione dei nostri concetti in chiamate
 * Stripe e viceversa.
 *
 * MODELLO: Stripe Connect con ADDEBITI DIRETTI. Le operazioni di incasso vengono
 * eseguite "per conto" dell'account della scuola passando l'opzione
 * `{ stripeAccount }` (header `Stripe-Account`). Così la scuola è l'esercente,
 * incassa sul proprio saldo e sostiene la commissione di Stripe; la piattaforma
 * preleva la propria quota tramite `application_fee_amount`.
 */

/** True se la piattaforma è configurata per operare con Stripe. */
const disponibile = () => stripeCfg.configurato();

/**
 * Restituisce il client Stripe o lancia 503 se la piattaforma non è configurata.
 * Fail-closed: nessuna chiamata parte senza chiave reale.
 */
const client = () => {
  const c = stripeCfg.client();
  if (!c) {
    throw new AppError(
      'I pagamenti non sono configurati su questa piattaforma.',
      503,
      'PAGAMENTI_NON_CONFIGURATI'
    );
  }
  return c;
};

/**
 * Crea un ACCOUNT CONNESSO (Express) per una scuola. È l'account su cui
 * confluiranno gli incassi. L'onboarding vero (dati bancari, verifica identità)
 * avviene poi su Stripe tramite l'Account Link.
 *
 * @param {Object} opz
 * @param {string} [opz.email]      email di contatto della scuola
 * @param {string} [opz.nomeScuola] nome mostrato (business_profile.name)
 * @param {string} [opz.paese='IT'] codice paese ISO-3166 alpha-2
 * @returns {Promise<string>} id dell'account (acct_...)
 */
const creaAccountConnesso = async ({ email, nomeScuola, paese = 'IT' } = {}) => {
  const account = await client().accounts.create({
    type: 'express',
    country: paese,
    email: email || undefined,
    business_profile: nomeScuola ? { name: String(nomeScuola).slice(0, 255) } : undefined,
    capabilities: {
      // Necessaria per incassare pagamenti con carta tramite Checkout.
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { piattaforma: 'istruzione' },
  });
  return account.id;
};

/**
 * Crea un Account Link: l'URL a cui inviare la scuola per completare (o
 * riprendere) l'onboarding Connect. Scade dopo pochi minuti: va rigenerato a
 * ogni tentativo.
 *
 * @param {Object} opz
 * @param {string} opz.accountId
 * @param {string} opz.refreshUrl  dove tornare se il link scade
 * @param {string} opz.returnUrl   dove tornare a onboarding concluso
 * @returns {Promise<string>} URL dell'onboarding
 */
const creaAccountLink = async ({ accountId, refreshUrl, returnUrl }) => {
  const link = await client().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link.url;
};

/**
 * Recupera un account connesso. Usato per sapere se può incassare
 * (`charges_enabled`) e aggiornare di conseguenza `stripe_onboarding_completato`.
 *
 * @param {string} accountId
 * @returns {Promise<import('stripe').Stripe.Account>}
 */
const recuperaAccount = async (accountId) => client().accounts.retrieve(accountId);

/**
 * Crea un link al pannello Express (dashboard della scuola su Stripe), per
 * consultare incassi e bonifici. Best effort: se l'account non è ancora
 * abilitato Stripe può rifiutare, in tal caso il chiamante gestisce l'errore.
 *
 * @param {string} accountId
 * @returns {Promise<string>} URL del pannello
 */
const creaLinkDashboard = async (accountId) => {
  const link = await client().accounts.createLoginLink(accountId);
  return link.url;
};

/**
 * Crea una SESSIONE DI CHECKOUT (addebito diretto sull'account della scuola).
 *
 * @param {Object} opz
 * @param {string} opz.accountId               account connesso della scuola
 * @param {number} opz.importoCentesimi        prezzo totale (centesimi)
 * @param {string} opz.valuta                  ISO-4217 (es. "EUR")
 * @param {number} opz.applicationFeeCentesimi commissione della piattaforma (centesimi)
 * @param {string} opz.nomeProdotto            nome mostrato nel checkout (titolo corso)
 * @param {string} [opz.descrizione]           descrizione mostrata
 * @param {string} opz.successUrl              URL di ritorno a pagamento riuscito
 * @param {string} opz.cancelUrl               URL di ritorno se annullato
 * @param {string} [opz.clientReferenceId]     id interno del pagamento
 * @param {string} [opz.emailCliente]          email precompilata
 * @param {Object} [opz.metadata]              metadati (id nostri) sulla sessione
 * @returns {Promise<{id:string, url:string}>}
 */
const creaSessioneCheckout = async ({
  accountId,
  importoCentesimi,
  valuta,
  applicationFeeCentesimi,
  nomeProdotto,
  descrizione,
  successUrl,
  cancelUrl,
  clientReferenceId,
  emailCliente,
  metadata = {},
}) => {
  const params = {
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: String(valuta || 'EUR').toLowerCase(),
          unit_amount: importoCentesimi,
          product_data: {
            name: String(nomeProdotto || 'Iscrizione al corso').slice(0, 250),
            ...(descrizione
              ? { description: String(descrizione).slice(0, 250) }
              : {}),
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: clientReferenceId || undefined,
    customer_email: emailCliente || undefined,
    metadata,
    // La commissione della piattaforma viene prelevata dall'importo incassato
    // dalla scuola. `metadata` è replicato sul PaymentIntent per ritrovarlo.
    payment_intent_data: {
      application_fee_amount:
        Number.isFinite(applicationFeeCentesimi) && applicationFeeCentesimi > 0
          ? applicationFeeCentesimi
          : undefined,
      metadata,
    },
  };

  const session = await client().checkout.sessions.create(params, {
    stripeAccount: accountId,
  });
  return { id: session.id, url: session.url };
};

/**
 * Recupera una sessione di checkout dall'account della scuola.
 *
 * @param {string} sessionId
 * @param {string} accountId
 * @returns {Promise<import('stripe').Stripe.Checkout.Session>}
 */
const recuperaSessione = async (sessionId, accountId) =>
  client().checkout.sessions.retrieve(sessionId, { stripeAccount: accountId });

/**
 * Verifica la firma di un webhook e restituisce l'evento tipizzato. Lancia
 * 400 se la firma non è valida (payload manomesso o segreto errato).
 *
 * @param {Buffer|string} corpoGrezzo  corpo RAW della richiesta (non parsato)
 * @param {string} firma               header `stripe-signature`
 * @returns {import('stripe').Stripe.Event}
 * @throws {AppError} 400 WEBHOOK_FIRMA_NON_VALIDA | 503 se non configurato
 */
const verificaWebhook = (corpoGrezzo, firma) => {
  if (!stripeCfg.webhookConfigurato()) {
    throw new AppError(
      'La verifica dei webhook non è configurata (STRIPE_WEBHOOK_SECRET assente).',
      503,
      'WEBHOOK_NON_CONFIGURATO'
    );
  }
  try {
    return client().webhooks.constructEvent(corpoGrezzo, firma, stripeCfg.WEBHOOK_SECRET);
  } catch (err) {
    logger.warn(`[STRIPE] Firma webhook non valida: ${err.message}`);
    throw new AppError('Firma del webhook non valida.', 400, 'WEBHOOK_FIRMA_NON_VALIDA');
  }
};

module.exports = {
  disponibile,
  creaAccountConnesso,
  creaAccountLink,
  recuperaAccount,
  creaLinkDashboard,
  creaSessioneCheckout,
  recuperaSessione,
  verificaWebhook,
};
