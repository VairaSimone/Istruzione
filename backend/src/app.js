'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { middleware: i18nMiddleware, i18next } = require('./config/i18n');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter, internoLimiter } = require('./middleware/rateLimiter');
const AppError = require('./utils/AppError');
const configRoutes = require('./routes/configRoutes');
const contattiRoutes = require('./routes/contattiRoutes');
const internoRoutes = require('./routes/internoRoutes');
const impostazioniService = require('./services/impostazioniService');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const scuolaRoutes = require('./routes/scuolaRoutes');
const quizRoutes = require('./routes/quizRoutes');
const statisticheRoutes = require('./routes/statisticheRoutes');
const auleRoutes = require('./routes/auleRoutes');
const compitiRoutes = require('./routes/compitiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const messaggiRoutes = require('./routes/messaggiRoutes');
const corsiRoutes = require('./routes/corsiRoutes');
const calendarioRoutes = require('./routes/calendarioRoutes');
const certificatoRoutes = require('./routes/certificatoRoutes');
const pagamentiRoutes = require('./routes/pagamentiRoutes');
const pagamentiController = require('./controllers/pagamentiController');
const { passport } = require('./config/passport');
const cookieParser = require('cookie-parser');
const piattaforma = require('./config/piattaforma');
const app = express();

// ─────────────────────────────────────────────
// WEBHOOK STRIPE (corpo GREZZO) — PRIMA di tutto
// ─────────────────────────────────────────────
// La verifica della firma dei webhook Stripe richiede il corpo RAW, non parsato:
// va quindi registrato PRIMA di express.json (che lo trasformerebbe in oggetto),
// di CORS (è una chiamata server-to-server senza Origin) e del CSRF (non è una
// richiesta del browser). `express.raw` popola `req.body` come Buffer.
app.post(
  '/api/pagamenti/webhook',
  express.raw({ type: 'application/json' }),
  pagamentiController.webhook
);

// ─────────────────────────────────────────────
// SICUREZZA: Helmet
// Header HTTP di sicurezza + CSP esplicita (API) + Referrer-Policy
// ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

// ─────────────────────────────────────────────
// CORS
// Permette richieste solo dall'origine configurata
// ─────────────────────────────────────────────
const corsOptions = {
  origin: async (origin, callback) => {
    const originiConsentite = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    // ── Richiesta SENZA header `Origin` ──
    //
    // Non è un browser: è curl, un uptime monitor, l'health check, una chiamata
    // server-to-server. CORS non la riguarda proprio — è un meccanismo che
    // protegge il browser da sé stesso, e senza Origin non c'è nulla da
    // proteggere.
    //
    // `callback(null, false)` significa «nessun header CORS in risposta», NON
    // «richiesta respinta»: la richiesta prosegue normalmente. Prima queste
    // richieste finivano nel ramo asincrono qui sotto, dove `new URL(null)`
    // dava host `null`, nessuna scuola, e si chiudeva con un `Error` generico —
    // che non essendo un `AppError` arrivava all'errorHandler con
    // `isOperational` undefined e diventava un **500 «errore interno»**.
    // Health check e monitoring erano rotti in produzione.
    if (!origin) return callback(null, false);

    if (originiConsentite.includes(origin)) return callback(null, true);

    // Consenti anche le origini il cui host è un DOMINIO SCUOLA VERIFICATO: così
    // il frontend servito su un dominio personalizzato può chiamare l'API senza
    // doverlo aggiungere a mano a CORS_ORIGIN. La verifica è cache-ata
    // (impostazioniService.perDominio), quindi non pesa a ogni richiesta.
    try {
      const host = new URL(origin).hostname;
      const scuola = await impostazioniService.perDominio(host);
      if (scuola) return callback(null, true);
    } catch (_) {
      /* origin non parsabile → trattata come non consentita */
    }

    // Rifiuto LEGITTIMO di un'origine reale: è un errore operativo, non un bug.
    // Come `AppError` produce un 403 con un codice leggibile, invece del 500
    // indistinguibile da un crash che restituiva prima.
    return callback(
      new AppError(`Origine non consentita da CORS: ${origin}`, 403, 'CORS_ORIGIN_NON_CONSENTITA')
    );
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  // `X-Scuola` consente al frontend di indicare il tenant sulle richieste non
  // autenticate (deploy multi-scuola su un unico host).
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Scuola'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ─────────────────────────────────────────────
// COMPRESSIONE HTTP (opzionale)
// Da attivare (COMPRESSIONE_HTTP=true) SOLO se Node è esposto direttamente a
// Internet. Dietro un reverse proxy (Nginx) o una CDN (Cloudflare) la
// compressione è già gestita a monte: abilitarla anche qui sarebbe ridondante
// e sprecherebbe CPU. Disattivata per default; il require è protetto così
// l'assenza del pacchetto non blocca l'avvio.
// ─────────────────────────────────────────────
if (process.env.COMPRESSIONE_HTTP === 'true') {
  try {
    const compression = require('compression');
    app.use(compression());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[APP] COMPRESSIONE_HTTP=true ma il pacchetto "compression" non è installato: compressione disattivata. Esegui `npm install`.'
    );
  }
}

// ─────────────────────────────────────────────
// ENDPOINT DI SERVIZIO (Caddy on-demand TLS) — PRIMA del limiter globale
// ─────────────────────────────────────────────
// `GET /api/interno/dominio-consentito` è l'endpoint «ask» con cui Caddy chiede
// il permesso di emettere un certificato Let's Encrypt per un host mai visto.
//
// Stava DOPO `globalLimiter` (1000 richieste / 15 min per IP). Ma Caddy
// interroga sempre dallo stesso IP — quello del proxy — e condivide quel budget
// con tutto il resto del traffico che passa di lì. Quando il limite scattava
// l'endpoint rispondeva 429, Caddy leggeva «non autorizzato» e NON emetteva il
// certificato: il dominio nuovo restava irraggiungibile in HTTPS, in modo
// intermittente e senza un errore che lo spiegasse.
//
// Montato qui è fuori dal limiter globale, con un limitatore proprio molto più
// generoso: resta protetto dall'abuso, senza che il traffico applicativo possa
// spegnere l'emissione dei certificati.
app.set('trust proxy', 1);
app.use('/api/interno', internoLimiter, internoRoutes);

// ─────────────────────────────────────────────
// RATE LIMITING GLOBALE
// Prima linea di difesa contro flooding/DDoS
// ─────────────────────────────────────────────
app.use(globalLimiter);

// ─────────────────────────────────────────────
// PARSING REQUEST
// ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));        // Limita payload JSON a 10KB
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(i18nMiddleware.handle(i18next));
app.use(cookieParser());

// ─────────────────────────────────────────────
// PASSPORT (Google OAuth 2.0) — stateless, nessuna sessione
// ─────────────────────────────────────────────
app.use(passport.initialize());
// ─────────────────────────────────────────────
// LOGGING HTTP
// ─────────────────────────────────────────────
app.use(requestLogger);

// ─────────────────────────────────────────────
// ROUTE DI HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: piattaforma.VERSIONE,
  });
});

// ─────────────────────────────────────────────
// ROUTE PRINCIPALI
// ─────────────────────────────────────────────
// Configurazione PUBBLICA: branding e funzionalità della scuola. Il frontend la
// interroga al bootstrap, prima del login, per personalizzarsi. Nessun dato
// riservato: la vista è filtrata dallo schema delle impostazioni.
app.use('/api/config', configRoutes);
// Form di contatto/iscrizione della HOMEPAGE pubblica. L'invio (POST) è
// pubblico: la scuola destinataria è risolta dal dominio o da `?scuola=`. La
// gestione dei lead è riservata allo staff (autenticata).
app.use('/api/contatti', contattiRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/auth', userRoutes);
// Alias degli endpoint di gestione utente/account anche sotto /api/utenti.
// Serve a esporre gli endpoint dei diritti dell'interessato al percorso
// canonico /api/utenti/me/* (es. /api/utenti/me/esporta-dati) mantenendo la
// piena compatibilità con i percorsi /api/auth/* già usati dal frontend.
app.use('/api/utenti', userRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/scuole', scuolaRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/statistiche', statisticheRoutes);
app.use('/api/aule', auleRoutes);
app.use('/api/compiti', compitiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messaggi', messaggiRoutes);
app.use('/api/corsi', corsiRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/certificati', certificatoRoutes);
app.use('/api/pagamenti', pagamentiRoutes);

// ─────────────────────────────────────────────
// GESTIONE ROUTE NON TROVATE (404)
// ─────────────────────────────────────────────
app.all('*', (req, res, next) => {
  next(new AppError(`Route non trovata: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// ─────────────────────────────────────────────
// GESTIONE ERRORI GLOBALE
// Deve essere l'ULTIMO middleware (4 parametri)
// ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;