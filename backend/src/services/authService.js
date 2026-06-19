'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwtHelpers');
const logger = require('../utils/logger');
const emailService = require('./emailService');
// ─────────────────────────────────────────────
// REGISTRAZIONE
// ─────────────────────────────────────────────

const registraUtente = async ({ nome, cognome, eta, email, password, classe }) => {
  const esistente = await Utente.findOne({ where: { email: email.toLowerCase() } });
  if (esistente) {
    throw new AppError('Email già registrata. Usa un\'altra email.', 409, 'EMAIL_TAKEN');
  }

  // Genera un token sicuro per la verifica email
  const tokenVerifica = crypto.randomBytes(32).toString('hex');
  const scadenzaVerifica = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore di validità

  const nuovoUtente = await Utente.create({
    nome: nome.trim(),
    cognome: cognome.trim(),
    eta,
    email: email.toLowerCase().trim(),
    password, 
    ruolo: 'studente', 
    classe,
    email_verificata: false,
    email_verification_token: tokenVerifica,
    email_verification_expire: scadenzaVerifica,
  });

  // Invia l'email in modo asincrono per non bloccare la risposta HTTP del server
  try {
    await emailService.sendVerificationEmail(nuovoUtente.email, tokenVerifica);
  } catch (err) {
    logger.error(`Errore nell'invio dell'email di verifica a ${nuovoUtente.email}: ${err.message}`);
    // Non lanciamo l'errore per evitare che l'utente veda un fallimento di sistema, 
    // l'utente potrà eventualmente richiedere un nuovo invio.
  }

  logger.info(`Nuovo utente registrato: ${nuovoUtente.email} (ID: ${nuovoUtente.id})`);
  return nuovoUtente;
};


// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

const loginUtente = async (email, password) => {
  const utente = await Utente.findOne({
    where: { email: email.toLowerCase().trim() },
    attributes: { include: ['password'] },
  });

  const passwordValida = utente
    ? await utente.verificaPassword(password)
    : await fakeHashCompare();

  if (!utente || !passwordValida) {
    throw new AppError('Credenziali non valide.', 401, 'INVALID_CREDENTIALS');
  }

  // CONTROLLO DI SICUREZZA DI INPUT: L'email deve essere verificata
  if (!utente.email_verificata) {
    throw new AppError('Devi verificare il tuo indirizzo email prima di effettuare il login.', 403, 'EMAIL_NOT_VERIFIED');
  }

  const accessToken = generateAccessToken(utente);
  const refreshToken = generateRefreshToken(utente);

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

  if (!utente) {
    logger.info(`Reset password richiesto per email inesistente: ${email}`);
    return { emailInviata: false };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const oreScadenza = parseInt(process.env.RESET_PASSWORD_EXPIRES_HOURS) || 1;
  const scadenza = new Date(Date.now() + oreScadenza * 60 * 60 * 1000);

  await utente.update({
    reset_password_token: token,
    reset_password_expire: scadenza,
  });

  // INVIO REALE DELL'EMAIL DI RESET
  try {
    await emailService.sendPasswordResetEmail(utente.email, token);
  } catch (err) {
    logger.error(`Errore nell'invio dell'email di reset a ${utente.email}: ${err.message}`);
    throw new AppError('Impossibile inviare l\'email di ripristino. Riprova più tardi.', 500, 'EMAIL_SEND_FAILED');
  }

  return {
    emailInviata: true,
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
    },
    attributes: { include: ['password'] },
  });

  if (!utente) {
    throw new AppError('Token non valido o scaduto.', 400, 'INVALID_RESET_TOKEN');
  }
const adesso = new Date();
  if (utente.reset_password_expire && utente.reset_password_expire < adesso) {
    throw new AppError('Token di verifica scaduto.', 400, 'EXPIRED_VERIFICATION_TOKEN');
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



const verificaEmail = async (token) => {
  const utente = await Utente.findOne({
    where: {
      email_verification_token: token,
    },
  });

  if (!utente) {
    throw new AppError('Token di verifica non valido o scaduto.', 400, 'INVALID_VERIFICATION_TOKEN');
  }
const adesso = new Date();
  if (utente.email_verification_expire && utente.email_verification_expire < adesso) {
    throw new AppError('Token di verifica scaduto.', 400, 'EXPIRED_VERIFICATION_TOKEN');
  }
  await utente.update({
    email_verificata: true,
    email_verification_token: null,
    email_verification_expire: null,
  });

  logger.info(`Email verificata con successo per l'utente ID: ${utente.id}`);
};

const richiediCambioEmail = async (userId, nuovaEmail) => {
  const emailFormattata = nuovaEmail.toLowerCase().trim();

  // Controlla se la nuova email è già usata da qualcun altro
  const giaEsistente = await Utente.findOne({ where: { email: emailFormattata } });
  if (giaEsistente) {
    throw new AppError('Questa email è già associata a un altro account.', 409, 'EMAIL_TAKEN');
  }

  // Genera token sicuro
  const tokenVerifica = crypto.randomBytes(32).toString('hex');
  const scadenzaVerifica = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 ore

  // Salva i dati sull'utente (incluso il campo temporaneo per la nuova email)
  await Utente.update({
    email_verification_token: tokenVerifica,
    email_verification_expire: scadenzaVerifica,
    nuova_email_pendente: emailFormattata // <- Campo fondamentale!
  }, { where: { id: userId } });

  // Invia l'email alla nuova casella
  try {
await emailService.sendEmailChangeEmail(emailFormattata, tokenVerifica);  } catch (err) {
    logger.error(`Errore invio email cambio indirizzo a ${emailFormattata}: ${err.message}`);
  }

  return tokenVerifica;
};

const confermaCambioEmail = async (token) => {
  // Cerca l'utente che possiede questo token E che ha una richiesta di cambio in sospeso
  const utente = await Utente.findOne({
    where: { 
      email_verification_token: token,
      nuova_email_pendente: { [Op.ne]: null } // Deve avere una nuova email in sospeso!
    }
  });

  if (!utente) {
    // Se non lo trovi qui, magari il token è quello di registrazione, non di cambio
    throw new AppError('Token di verifica non valido o non associato a un cambio email.', 400, 'INVALID_TOKEN');
  }

  // Controlla scadenza
  if (utente.email_verification_expire && utente.email_verification_expire < new Date()) {
    throw new AppError('Il token di verifica è scaduto. Richiedi un nuovo cambio email.', 400, 'EXPIRED_TOKEN');
  }

  // Aggiorna l'email reale con quella pendente e pulisci i campi
  await utente.update({
    email: utente.nuova_email_pendente,
    nuova_email_pendente: null,
    email_verification_token: null,
    email_verification_expire: null
  });

  logger.info(`Email aggiornata con successo per utente ID: ${utente.id}`);
  return utente;
};

const eliminaAccount = async (userId) => {
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  // Sequelize gestirà l'eliminazione del record. 
  // Se ci sono tabelle correlate, assicurati che abbiano il vincolo ON DELETE CASCADE nel DB.
  await utente.destroy();
  
  logger.info(`Account eliminato definitivamente. ID Utente: ${userId}`);
};

// ─────────────────────────────────────────────
// VISTA GESTIONALE UTENTI (Per Insegnanti)
// ─────────────────────────────────────────────
const getUtentiPerInsegnante = async (filtri) => {
  const { ruolo, classe, nome } = filtri;
  const where = {};

  // Filtro esatto per ruolo
  if (ruolo) {
    where.ruolo = ruolo;
  }

  // Filtro esatto per classe
  if (classe) {
    where.classe = classe;
  }

  // Filtro parziale per nome o cognome (Case Insensitive su gran parte dei DB)
  if (nome) {
    where[Op.or] = [
      { nome: { [Op.like]: `%${nome}%` } },
      { cognome: { [Op.like]: `%${nome}%` } }
    ];
  }

  // Recupera gli utenti escludendo i campi sensibili
  const utenti = await Utente.findAll({
    where,
    attributes: { 
      exclude: [
        'password', 
        'refresh_token', 
        'reset_password_token', 
        'reset_password_expire', 
        'email_verification_token', 
        'email_verification_expire'
      ] 
    },
    order: [['cognome', 'ASC'], ['nome', 'ASC']]
  });

  return utenti;
};

// ─────────────────────────────────────────────
// CAMBIO RUOLO UTENTE (Per Insegnanti)
// ─────────────────────────────────────────────
const aggiornaRuoloUtente = async (userId, nuovoRuolo) => {
  if (!Utente.RUOLI_VALIDI.includes(nuovoRuolo)) {
    throw new AppError('Ruolo non valido.', 422, 'INVALID_ROLE');
  }

  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  await utente.update({ ruolo: nuovoRuolo });
  logger.info(`Ruolo aggiornato per utente ID: ${userId} -> Nuovo Ruolo: ${nuovoRuolo}`);
  
  return utente.toPublicJSON();
};
module.exports = {
  registraUtente,
  loginUtente,
  logoutUtente,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  verificaEmail,
  richiediCambioEmail,
  confermaCambioEmail,
  eliminaAccount,      
  getUtentiPerInsegnante, 
  aggiornaRuoloUtente
};
