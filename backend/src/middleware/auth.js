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

  // Recupera SOLO le colonne effettivamente usate qui sotto (validazione della
  // sessione + costruzione di `req.user`), evitando il SELECT * che a ogni
  // richiesta trascinerebbe hash password, token, contatori di gamification e
  // il blob JSON delle preferenze notifiche.
  const utente = await Utente.findByPk(decoded.id, {
    attributes: [
      // Necessari alle verifiche di sessione:
      'token_version',
      'stato',
      'bloccato_fino_al',
      // Necessari a comporre req.user:
      'id',
      'nome',
      'cognome',
      'eta',
      'email',
      'ruolo',
      'classe',
      'scuola_id',
      'lingua',
      'email_verificata',
      'profilo_completo',
    ],
  });

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

  // Difesa in profondità: un account non più 'attivo' (insegnante sospeso/
  // rifiutato dopo l'emissione di un token) non può usare sessioni esistenti.
  if (utente.stato !== 'attivo') {
    return next(new AppError('Account non abilitato ad accedere.', 403, 'ACCOUNT_NOT_ACTIVE'));
  }

  req.user = {
    id: utente.id,
    nome: utente.nome,
    cognome: utente.cognome,
    eta: utente.eta,
    email: utente.email,
    ruolo: utente.ruolo,
    classe: utente.classe,
    stato: utente.stato,
    scuola_id: utente.scuola_id,
    lingua: utente.lingua,
    email_verificata: utente.email_verificata,
    profilo_completo: utente.profilo_completo
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