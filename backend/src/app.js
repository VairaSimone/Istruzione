'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { middleware: i18nMiddleware, i18next } = require('./config/i18n');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
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
const { passport } = require('./config/passport');
const cookieParser = require('cookie-parser');
const piattaforma = require('./config/piattaforma');
const app = express();

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
  origin: (origin, callback) => {
    const originiConsentite = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

    // Permetti richieste senza origin (es. Postman, curl) solo in sviluppo
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (originiConsentite.includes(origin)) {
      return callback(null, true);
    }

    // Consenti anche le origini il cui host è un DOMINIO SCUOLA VERIFICATO: così
    // il frontend servito su un dominio personalizzato può chiamare l'API senza
    // doverlo aggiungere a mano a CORS_ORIGIN. La verifica è cache-ata
    // (impostazioniService.perDominio), quindi non pesa a ogni richiesta.
    (async () => {
      try {
        const host = origin ? new URL(origin).hostname : null;
        const scuola = host ? await impostazioniService.perDominio(host) : null;
        if (scuola) return callback(null, true);
      } catch (_) {
        /* origin non parsabile → trattata come non consentita */
      }
      callback(new Error(`Origine non consentita da CORS: ${origin}`));
    })();
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
// RATE LIMITING GLOBALE
// Prima linea di difesa contro flooding/DDoS
// ─────────────────────────────────────────────
app.set('trust proxy', 1);
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

// Endpoint di servizio (Caddy on-demand TLS): autorizza l'emissione del
// certificato solo per i domini scuola verificati e attivi. Pubblico.
app.use('/api/interno', internoRoutes);

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