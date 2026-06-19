'use strict';

const { verifyAccessToken } = require('../utils/jwtHelpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Utente = require('../models/Utente');

/**
 * Middleware di autenticazione JWT.
 *
 * Funzionamento:
 * 1. Legge il Bearer token dall'header Authorization
 * 2. Verifica la firma e la scadenza
 * 3. Cerca l'utente nel DB per assicurarsi che esista ancora
 * 4. Inietta l'utente in req.user per i controller successivi
 */
const authenticateJWT = catchAsync(async (req, res, next) => {
  // 1. Estrai il token dall'header
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // Rimuovi "Bearer "
  }

  if (!token) {
    return next(new AppError('Accesso negato. Autenticazione richiesta.', 401, 'NO_TOKEN'));
  }

  // 2. Verifica il token (firma + scadenza)
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token scaduto. Effettua il refresh.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Token non valido.', 401, 'INVALID_TOKEN'));
  }

  // 3. Verifica che l'utente esista ancora nel DB
  // (es: account eliminato dopo l'emissione del token)
  const utente = await Utente.findByPk(decoded.id, {
    attributes: { exclude: ['password', 'refresh_token', 'reset_password_token', 'reset_password_expire'] },
  });

  if (!utente) {
    return next(new AppError('Utente non trovato. Token non più valido.', 401, 'USER_NOT_FOUND'));
  }

  // 4. Inietta l'utente nella request per i controller successivi
  req.user = utente;
  next();
});

/**
 * Middleware di autorizzazione basato sui ruoli.
 * Da usare DOPO authenticateJWT.
 *
 * Uso: authorizeRoles('insegnante', 'admin')
 */
const authorizeRoles = (...ruoliConsentiti) => {
  return (req, res, next) => {
    if (!ruoliConsentiti.includes(req.user.ruolo)) {
      return next(
        new AppError(
          `Accesso negato. Ruolo '${req.user.ruolo}' non autorizzato per questa operazione.`,
          403,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
};

module.exports = { authenticateJWT, authorizeRoles };
