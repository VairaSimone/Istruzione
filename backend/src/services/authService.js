'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwtHelpers');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────
// REGISTRAZIONE
// ─────────────────────────────────────────────

const registraUtente = async ({ nome, cognome, eta, email, password, classe }) => {
  // Controlla se l'email è già usata (doppio controllo: DB ha unique constraint,
  // ma così diamo un messaggio personalizzato prima di tentare l'INSERT)
  const esistente = await Utente.findOne({ where: { email: email.toLowerCase() } });
  if (esistente) {
    throw new AppError('Email già registrata. Usa un\'altra email.', 409, 'EMAIL_TAKEN');
  }

  // Crea l'utente. Il ruolo è forzato a 'studente' qui nel service,
  // NON si usa quello eventualmente passato dal client.
  const nuovoUtente = await Utente.create({
    nome: nome.trim(),
    cognome: cognome.trim(),
    eta,
    email: email.toLowerCase().trim(),
    password, // L'hook beforeSave del modello farà l'hash
    ruolo: 'studente', // SEMPRE studente in fase di registrazione
    classe,
    email_verificata: false,
  });

  logger.info(`Nuovo utente registrato: ${nuovoUtente.email} (ID: ${nuovoUtente.id})`);
  return nuovoUtente;
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

const loginUtente = async (email, password) => {
  // Carica l'utente includendo la password (normalmente esclusa)
  const utente = await Utente.findOne({
    where: { email: email.toLowerCase().trim() },
    // Devi includere esplicitamente la password per la verifica
    attributes: { include: ['password'] },
  });

  // Verifica utente e password in un'unica operazione.
  // IMPORTANTE: verifica sempre la password anche se l'utente non esiste
  // (timing attack prevention: così il tempo di risposta è simile nei due casi)
  const passwordValida = utente
    ? await utente.verificaPassword(password)
    : await fakeHashCompare();

  if (!utente || !passwordValida) {
    throw new AppError('Credenziali non valide.', 401, 'INVALID_CREDENTIALS');
  }

  // Genera i token
  const accessToken = generateAccessToken(utente);
  const refreshToken = generateRefreshToken(utente);

  // Salva il refresh token nel DB (per poterlo invalidare al logout)
  await utente.update({ refresh_token: refreshToken });

  logger.info(`Login effettuato: ${utente.email} (ID: ${utente.id})`);

  return {
    accessToken,
    refreshToken,
    utente: utente.toPublicJSON(),
  };
};

/**
 * Simula un hash compare per prevenire timing attacks.
 * Se l'utente non esiste, facciamo comunque un bcrypt.compare
 * per non far emergere la differenza di tempo.
 */
const fakeHashCompare = async () => {
  const bcrypt = require('bcryptjs');
  await bcrypt.compare('fake_password', '$2a$12$fakehashfakehashfakehashfakehashfakehashfakeha');
  return false;
};

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

const logoutUtente = async (userId) => {
  // Invalida il refresh token nel DB impostandolo a null
  await Utente.update(
    { refresh_token: null },
    { where: { id: userId } }
  );

  logger.info(`Logout effettuato per utente ID: ${userId}`);
};

// ─────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token mancante.', 401, 'NO_REFRESH_TOKEN');
  }

  // 1. Verifica la firma del refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Sessione scaduta. Effettua nuovamente il login.', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Refresh token non valido.', 401, 'INVALID_REFRESH_TOKEN');
  }

  // 2. Verifica che il token corrisponda a quello salvato nel DB
  // (se l'utente ha fatto logout, il token nel DB è null → accesso negato)
  const utente = await Utente.findOne({
    where: {
      id: decoded.id,
      refresh_token: refreshToken, // Deve combaciare esattamente
    },
  });

  if (!utente) {
    throw new AppError('Refresh token non valido o sessione terminata.', 401, 'INVALID_REFRESH_TOKEN');
  }

  // 3. Genera nuovo access token
  const nuovoAccessToken = generateAccessToken(utente);

  return { accessToken: nuovoAccessToken };
};

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────

const forgotPassword = async (email) => {
  const utente = await Utente.findOne({ where: { email: email.toLowerCase() } });

  // SICUREZZA: rispondi sempre con successo, anche se l'email non esiste.
  // Questo previene l'enumerazione degli account registrati.
  if (!utente) {
    logger.info(`Reset password richiesto per email inesistente: ${email}`);
    return { emailInviata: false };
  }

  // Genera un token casuale crittograficamente sicuro (32 byte = 64 hex chars)
  const token = crypto.randomBytes(32).toString('hex');

  // Calcola la scadenza (default: 1 ora da adesso)
  const oreScadenza = parseInt(process.env.RESET_PASSWORD_EXPIRES_HOURS) || 1;
  const scadenza = new Date(Date.now() + oreScadenza * 60 * 60 * 1000);

  // Salva token e scadenza nel DB
  await utente.update({
    reset_password_token: token,
    reset_password_expire: scadenza,
  });

  logger.info(`Token reset password generato per: ${utente.email} (scade: ${scadenza.toISOString()})`);

  // In un'applicazione reale, qui invieresti l'email con il link di reset.
  // Esempio: await emailService.sendPasswordResetEmail(utente.email, token);
  // Per ora restituiamo il token (solo in sviluppo, NON in produzione!)
  return {
    emailInviata: true,
    // Rimuovi questo in produzione! Il token va solo nell'email.
    tokenDebug: process.env.NODE_ENV !== 'production' ? token : undefined,
  };
};

// ─────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────

const resetPassword = async (token, nuovaPassword) => {
  // Cerca l'utente con questo token E verifica che non sia scaduto
  const utente = await Utente.findOne({
    where: {
      reset_password_token: token,
      reset_password_expire: {
        [Op.gt]: new Date(), // Il token deve scadere DOPO adesso
      },
    },
    attributes: { include: ['password'] },
  });

  if (!utente) {
    throw new AppError('Token non valido o scaduto.', 400, 'INVALID_RESET_TOKEN');
  }

  // Aggiorna la password e pulisci i campi del token
  await utente.update({
    password: nuovaPassword, // L'hook beforeSave farà l'hash
    reset_password_token: null,
    reset_password_expire: null,
    refresh_token: null, // Invalida tutte le sessioni esistenti per sicurezza
  });

  logger.info(`Password reimpostata per utente: ${utente.email}`);
};

// ─────────────────────────────────────────────
// CHANGE EMAIL
// ─────────────────────────────────────────────

const changeEmail = async (userId, nuovaEmail) => {
  nuovaEmail = nuovaEmail.toLowerCase().trim();

  // Verifica che la nuova email non sia già usata da qualcun altro
  const emailEsistente = await Utente.findOne({
    where: {
      email: nuovaEmail,
      id: { [Op.ne]: userId }, // Escludi l'utente corrente
    },
  });

  if (emailEsistente) {
    throw new AppError('Email già in uso da un altro account.', 409, 'EMAIL_TAKEN');
  }

  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  await utente.update({
    email: nuovaEmail,
    email_verificata: false, // Reset verifica con la nuova email
  });

  logger.info(`Email cambiata per utente ID ${userId}: ${nuovaEmail}`);
  return utente.toPublicJSON();
};

module.exports = {
  registraUtente,
  loginUtente,
  logoutUtente,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changeEmail,
};
