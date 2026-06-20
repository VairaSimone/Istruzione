'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { middleware: i18nMiddleware, i18next } = require('./config/i18n');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const AppError = require('./utils/AppError');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
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
      callback(null, true);
    } else {
      callback(new Error(`Origine non consentita da CORS: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

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
    version: '1.0.0',
  });
});

// ─────────────────────────────────────────────
// ROUTE PRINCIPALI
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);

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