'use strict';

const { verifyAccessToken } = require('../utils/jwtHelpers');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Utente = require('../models/Utente');

const authenticateJWT = catchAsync(async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Non sei autenticato. Effettua il login per accedere.', 401, 'INVALID_TOKEN'));
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Il tuo token è scaduto. Effettua nuovamente il login.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Token non valido. Autenticazione fallita.', 401, 'INVALID_TOKEN'));
  }

  const utente = await Utente.findByPk(decoded.id);

  if (!utente) {
    return next(new AppError('Utente non trovato. Autenticazione fallita.', 401, 'INVALID_TOKEN'));
  }

  if (utente.token_version !== decoded.token_version) {
    return next(new AppError('La tua sessione non è più valida. Effettua nuovamente il login.', 401, 'TOKEN_EXPIRED'));
  }

  // Il lockout non deve agire solo sul login: un account bloccato non può
  // continuare ad usare sessioni già attive durante il periodo di blocco.
  if (utente.bloccato_fino_al && new Date(utente.bloccato_fino_al) > new Date()) {
    return next(new AppError('Account temporaneamente bloccato. Riprova più tardi.', 403, 'ACCOUNT_LOCKED'));
  }

  req.user = {
    id: utente.id,
    nome: utente.nome,
    cognome: utente.cognome,
    eta: utente.eta,
    email: utente.email,
    ruolo: utente.ruolo,
    classe: utente.classe,
    lingua: utente.lingua,
    email_verificata: utente.email_verificata,
  };

  next();
});

const authorizeRoles = (...ruoliConsentiti) => {
  return (req, res, next) => {
    if (!ruoliConsentiti.includes(req.user.ruolo)) {
      return next(
        new AppError(
          'Non disponi dei permessi necessari per questa operazione.',
          403,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
};

module.exports = { authenticateJWT, authorizeRoles };