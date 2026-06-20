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
const MAX_TENTATIVI_FALLITI = 5;
const TEMPO_BLOCCO_MINUTI = 15;
const registraUtente = async ({ nome, cognome, eta, email, password, classe, lingua = 'it' }) => {

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
    lingua,
    email_verificata: false,
    email_verification_token: tokenVerifica,
    email_verification_expire: scadenzaVerifica,
  });

  try {
    await emailService.sendVerificationEmail(nuovoUtente.email, tokenVerifica, nuovoUtente.lingua);
  } catch (err) {
    logger.error(`Errore nell'invio dell'email di verifica a ${nuovoUtente.email}: ${err.message}`);
  }

  logger.info(`Nuovo utente registrato: ${nuovoUtente.email} (ID: ${nuovoUtente.id})`);
  return nuovoUtente;
};


// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

const loginUtente = async (email, password) => {
  const utente = await Utente.findOne({ where: { email } });

  if (!utente) {
    await fakeHashCompare();
    throw new AppError('Credenziali non valide', 401);
  }

  if (utente.bloccato_fino_al && utente.bloccato_fino_al > new Date()) {
    const millisecondiRimanenti = utente.bloccato_fino_al.getTime() - new Date().getTime();
    const minutiRimanenti = Math.ceil(millisecondiRimanenti / 60000);
    throw new AppError(`Account bloccato per troppi tentativi. Riprova tra ${minutiRimanenti} minuti.`, 403);
  }

  const isPasswordValid = await utente.verificaPassword(password);

  if (!isPasswordValid) {
    utente.tentativi_falliti += 1;

    if (utente.tentativi_falliti >= MAX_TENTATIVI_FALLITI) {
      const dataSblocco = new Date();
      dataSblocco.setMinutes(dataSblocco.getMinutes() + TEMPO_BLOCCO_MINUTI);
      utente.bloccato_fino_al = dataSblocco;

      await utente.save();
      throw new AppError(`Troppi tentativi falliti. Account bloccato per ${TEMPO_BLOCCO_MINUTI} minuti.`, 403);
    } else {
      await utente.save();
      throw new AppError('Credenziali non valide', 401);
    }
  }

  if (!utente.email_verificata) {
    throw new AppError('auth.email_not_verified', 401);
  }

  if (utente.tentativi_falliti > 0 || utente.bloccato_fino_al !== null) {
    utente.tentativi_falliti = 0;
    utente.bloccato_fino_al = null;
    await utente.save();
  }

  const accessToken = generateAccessToken(utente);
  const refreshToken = generateRefreshToken(utente);

  utente.refresh_token = refreshToken;
  await utente.save();

  return { utente, accessToken, refreshToken };
};

const fakeHashCompare = async () => {
  const bcrypt = require('bcryptjs');
  await bcrypt.compare('fake_password', '$2a$12$fakehashfakehashfakehashfakehashfakehashfakeha');
  return false;
};

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

const logoutUtente = async (userId) => {
  const utente = await Utente.findByPk(userId);

  if (utente) {
    utente.token_version += 1;
    utente.refresh_token = null; 
    await utente.save();
  }
};

// ─────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token mancante.', 401, 'NO_REFRESH_TOKEN');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Sessione scaduta. Effettua nuovamente il login.', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Refresh token non valido.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const utente = await Utente.findOne({
    where: {
      id: decoded.id,
      refresh_token: refreshToken,
    },
  });

  if (!utente) {
    throw new AppError('Refresh token non valido o sessione terminata.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const nuovoAccessToken = generateAccessToken(utente);

  const nuovoRefreshToken = generateRefreshToken(utente);
  utente.refresh_token = nuovoRefreshToken;
  await utente.save();

  return { accessToken: nuovoAccessToken, refreshToken: nuovoRefreshToken };
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

  try {
    await emailService.sendPasswordResetEmail(utente.email, token, utente.lingua);
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

  await utente.update({
    password: nuovaPassword,
    reset_password_token: null,
    reset_password_expire: null,
    refresh_token: null,
  });

  logger.info(`Password reimpostata per utente: ${utente.email}`);
};

// ─────────────────────────────────────────────
// VERIFICA EMAIL
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// RICHIESTA CAMBIO EMAIL
// ─────────────────────────────────────────────

const richiediCambioEmail = async (userId, nuovaEmail) => {
  const emailFormattata = nuovaEmail.toLowerCase().trim();

  // Recuperiamo tutto il record utente per avere accesso anche alla lingua impostata nel DB
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  const giaEsistente = await Utente.findOne({ where: { email: emailFormattata } });
  if (giaEsistente) {
    throw new AppError('Questa email è già associata a un altro account.', 409, 'EMAIL_TAKEN');
  }

  const tokenVerifica = crypto.randomBytes(32).toString('hex');
  const scadenzaVerifica = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 ore

  await utente.update({
    email_verification_token: tokenVerifica,
    email_verification_expire: scadenzaVerifica,
    nuova_email_pendente: emailFormattata
  });

  try {
    await emailService.sendEmailChangeEmail(emailFormattata, tokenVerifica, utente.lingua);
  } catch (err) {
    logger.error(`Errore invio email cambio indirizzo a ${emailFormattata}: ${err.message}`);
  }

  return tokenVerifica;
};

// ─────────────────────────────────────────────
// CONFERMA CAMBIO EMAIL
// ─────────────────────────────────────────────

const confermaCambioEmail = async (token) => {
  const utente = await Utente.findOne({
    where: {
      email_verification_token: token,
      nuova_email_pendente: { [Op.ne]: null }
    }
  });

  if (!utente) {
    throw new AppError('Token di verifica non valido o non associato a un cambio email.', 400, 'INVALID_TOKEN');
  }

  if (utente.email_verification_expire && utente.email_verification_expire < new Date()) {
    throw new AppError('Il token di verifica è scaduto. Richiedi un nuovo cambio email.', 400, 'EXPIRED_TOKEN');
  }

  await utente.update({
    email: utente.nuova_email_pendente,
    nuova_email_pendente: null,
    email_verification_token: null,
    email_verification_expire: null
  });

  logger.info(`Email aggiornata con successo per utente ID: ${utente.id}`);
  return utente;
};

// ─────────────────────────────────────────────
// ELIMINA ACCOUNT
// ─────────────────────────────────────────────

const eliminaAccount = async (userId) => {
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  await utente.destroy();
  logger.info(`Account eliminato definitivamente. ID Utente: ${userId}`);
};

// ─────────────────────────────────────────────
// VISTA GESTIONALE UTENTI (Per Insegnanti)
// ─────────────────────────────────────────────

const getUtentiPerInsegnante = async (filtri) => {
  const { ruolo, classe, nome, page, limit } = filtri;
  const where = {};

  if (ruolo) {
    where.ruolo = ruolo;
  }

  if (classe) {
    where.classe = classe;
  }

  if (nome) {
    where[Op.or] = [
      { nome: { [Op.like]: `%${nome}%` } },
      { cognome: { [Op.like]: `%${nome}%` } }
    ];
  }


  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione = Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = {
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
  };

  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Utente.findAndCountAll(queryOptions);
    return {
      utenti: rows,
      paginazione: {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: count,
        totalePagine: Math.ceil(count / limitNum),
      },
    };
  }

  const utenti = await Utente.findAll(queryOptions);
  return { utenti, paginazione: null };
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