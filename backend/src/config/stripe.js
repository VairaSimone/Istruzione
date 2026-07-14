'use strict';

/**
 * CONFIGURAZIONE STRIPE (livello PIATTAFORMA).
 *
 * I pagamenti sono un servizio OPZIONALE della piattaforma: una scuola può
 * decidere di riscuotere le iscrizioni ai propri corsi tramite Stripe oppure di
 * gestirle da sé (invita gli studenti e si accorda con loro fuori piattaforma).
 * Questo file concentra tutto ciò che è legato all'ACCOUNT STRIPE DELLA
 * PIATTAFORMA (le chiavi API, il segreto del webhook), distinto dai dati del
 * singolo tenant (l'account Stripe Connect della scuola vive su `scuole`).
 *
 * ─────────────────────────────────────────────
 * MODELLO DI INCASSO: Stripe Connect — ADDEBITI DIRETTI
 * ─────────────────────────────────────────────
 * Ogni scuola che usa i pagamenti collega un proprio account Stripe (Connect,
 * tipo Express) tramite l'onboarding. Gli addebiti vengono creati DIRETTAMENTE
 * sull'account della scuola (`Stripe-Account`), quindi:
 *
 *   - la SCUOLA è l'esercente: riceve i soldi sul proprio saldo Stripe;
 *   - la COMMISSIONE DI STRIPE è trattenuta dal saldo della scuola;
 *   - la PIATTAFORMA trattiene una `application_fee_amount` pari alla percentuale
 *     decisa dall'admin per quella scuola (`scuole.commissione_piattaforma_percentuale`).
 *
 * Così il requisito «considera la percentuale di Stripe PIÙ una percentuale, a
 * scelta dell'admin, di quanto trattiene la piattaforma» è soddisfatto senza che
 * la piattaforma anticipi nulla: la scuola incassa il netto, Stripe e la
 * piattaforma trattengono ciascuna la propria quota.
 *
 * ─────────────────────────────────────────────
 * VARIABILI D'AMBIENTE
 * ─────────────────────────────────────────────
 *   STRIPE_SECRET_KEY        chiave segreta dell'account piattaforma (sk_...)
 *   STRIPE_WEBHOOK_SECRET    segreto per verificare la firma dei webhook (whsec_...)
 *   STRIPE_PUBLISHABLE_KEY   chiave pubblicabile (pk_...), esposta al frontend
 *   STRIPE_API_VERSION       versione API bloccata (opzionale)
 *   PAGAMENTI_VALUTA_DEFAULT valuta ISO-4217 predefinita per i nuovi corsi (default EUR)
 *
 * Se `STRIPE_SECRET_KEY` non è impostata, i pagamenti sono DISATTIVATI a livello
 * di piattaforma: gli endpoint rispondono in modo esplicito (fail-closed) e le
 * scuole non possono attivare l'incasso. Nessuna chiave finta viene mai usata.
 */

const stringaEnv = (chiave, predefinito = null) => {
  const v = process.env[chiave];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : predefinito;
};

// Chiavi/segreti dell'account PIATTAFORMA.
const SECRET_KEY = stringaEnv('STRIPE_SECRET_KEY', null);
const WEBHOOK_SECRET = stringaEnv('STRIPE_WEBHOOK_SECRET', null);
const PUBLISHABLE_KEY = stringaEnv('STRIPE_PUBLISHABLE_KEY', null);

// Versione API bloccata: evita che un aggiornamento lato Stripe cambi il
// comportamento senza un rilascio consapevole. Se non impostata, si usa quella
// predefinita dell'SDK installato.
const API_VERSION = stringaEnv('STRIPE_API_VERSION', null);

// Valuta predefinita per i nuovi corsi acquistabili. Sempre ISO-4217 minuscola
// lato Stripe; verso l'esterno la esponiamo in MAIUSCOLO (es. "EUR").
const VALUTA_DEFAULT = (stringaEnv('PAGAMENTI_VALUTA_DEFAULT', 'EUR') || 'EUR')
  .toUpperCase()
  .slice(0, 3);

// Valute supportate per la validazione dei prezzi dei corsi. Elenco volutamente
// contenuto (le più comuni per un ente di formazione europeo): estenderlo qui è
// l'unico punto da toccare.
const VALUTE_SUPPORTATE = ['EUR', 'USD', 'GBP', 'CHF'];

/**
 * True se la PIATTAFORMA è configurata per incassare (chiave segreta presente).
 * NON dice nulla sulla singola scuola: quella dipende dall'onboarding Connect e
 * dal flag `pagamenti_stripe_attivi` del tenant.
 */
const configurato = () => Boolean(SECRET_KEY);

/** True se anche la verifica dei webhook è configurabile. */
const webhookConfigurato = () => Boolean(WEBHOOK_SECRET);

// Istanza SDK memoizzata: si costruisce alla prima richiesta e solo se la
// piattaforma è configurata. Il `require` è lazy per non forzare la dipendenza
// quando i pagamenti non vengono usati.
let _client = null;

/**
 * Restituisce il client Stripe della piattaforma, o `null` se non configurato.
 * I service devono controllare `configurato()` prima di operare e non assumere
 * mai un client valido.
 *
 * @returns {import('stripe').Stripe|null}
 */
const client = () => {
  if (!SECRET_KEY) return null;
  if (_client) return _client;
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  _client = new Stripe(SECRET_KEY, API_VERSION ? { apiVersion: API_VERSION } : undefined);
  return _client;
};

module.exports = {
  SECRET_KEY,
  WEBHOOK_SECRET,
  PUBLISHABLE_KEY,
  API_VERSION,
  VALUTA_DEFAULT,
  VALUTE_SUPPORTATE,
  configurato,
  webhookConfigurato,
  client,
};
