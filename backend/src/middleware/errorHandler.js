'use strict';

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// ─────────────────────────────────────────────
// Gestori specifici per errori di terze parti
// ─────────────────────────────────────────────

/** Sequelize: violazione di unique constraint (es. email duplicata) */
const handleSequelizeUniqueError = (err) => {
  const field = err.errors?.[0]?.path || 'campo';
  return new AppError(`Valore duplicato per: ${field}`, 409, 'DUPLICATE_VALUE');
};

/** Sequelize: errore di validazione del modello */
const handleSequelizeValidationError = (err) => {
  const messages = err.errors.map((e) => e.message).join('. ');
  return new AppError(`Dati non validi: ${messages}`, 400, 'VALIDATION_ERROR');
};

/** JWT: token malformato */
const handleJWTError = () =>
  new AppError('Token non valido.', 401, 'INVALID_TOKEN');

/** JWT: token scaduto */
const handleJWTExpiredError = () =>
  new AppError('Token scaduto. Effettua il refresh.', 401, 'TOKEN_EXPIRED');

// ─────────────────────────────────────────────
// Formattatori di risposta
// ─────────────────────────────────────────────

/** In sviluppo: mostra stack trace e tutti i dettagli */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    code: err.code,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

/** In produzione: solo informazioni sicure da esporre al client */
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    // Errore atteso: possiamo dire qualcosa di utile al client
    return res.status(err.statusCode).json({
      status: err.status,
      code: err.code,
      message: err.message,
    });
  }

  // Errore di programmazione (bug): non esporre dettagli interni
  logger.error('ERRORE NON OPERAZIONALE:', err);

  return res.status(500).json({
    status: 'error',
    message: 'Si è verificato un errore interno. Riprova più tardi.',
  });
};

// ─────────────────────────────────────────────
// Middleware principale (deve avere 4 parametri!)
// ─────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  // Imposta valori di default se mancanti
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log dell'errore (sempre, indipendentemente dall'ambiente)
  if (err.statusCode >= 500) {
    logger.error(`${err.statusCode} ${err.message}`, {
      path: req.path,
      method: req.method,
      stack: err.stack,
    });
  } else {
    logger.warn(`${err.statusCode} ${err.message}`, {
      path: req.path,
      method: req.method,
    });
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // In produzione, trasforma certi errori di librerie in AppError
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);

    if (error.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueError(error);
    if (error.name === 'SequelizeValidationError') error = handleSequelizeValidationError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
