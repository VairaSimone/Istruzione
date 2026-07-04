'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const Invito = require('../models/Invito');
const ClasseUtente = require('../models/ClasseUtente');
const AppError = require('../utils/AppError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwtHelpers');
const { hashToken } = require('../utils/tokenHash');
const logger = require('../utils/logger');
const emailService = require('./emailService');

/**
 * AuthService — responsabilità ESCLUSIVA: autenticazione e ciclo di vita
 * delle credenziali.
 *
 *   register · login · logout · refresh · verify email ·
 *   resend verification · forgot/reset password · google auth
 *
 * La gestione utenti (cambio email, eliminazione account, operazioni
 * amministrative dell'insegnante) è stata spostata in `userService.js`.
 */

const MAX_TENTATIVI_FALLITI = 5;
const TEMPO_BLOCCO_MINUTI = 15;

// ─────────────────────────────────────────────
// CONSUMO INVITO — helper condiviso
// Carica e blocca l'invito, ne valida lo stato/scadenza/ruolo e verifica che
// l'email non sia stata occupata nel frattempo. Restituisce l'invito bloccato
// all'interno della transazione del chiamante.
// ─────────────────────────────────────────────
const caricaInvitoValido = async (tokenInChiaro, ruoloAtteso, t) => {
  const invito = await Invito.findOne({
    where: { token_hash: hashToken(tokenInChiaro) },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!invito || invito.stato === 'revocato') {
    throw new AppError('Invito non valido o revocato.', 400, 'INVALID_INVITE');
  }
  if (invito.stato === 'completato') {
    throw new AppError('Questo invito è già stato utilizzato.', 410, 'INVITE_ALREADY_USED');
  }
  if (new Date(invito.scadenza) <= new Date()) {
    throw new AppError('Invito scaduto. Richiedine uno nuovo.', 410, 'INVITE_EXPIRED');
  }
  if (invito.ruolo !== ruoloAtteso) {
    throw new AppError('Invito non valido per questo tipo di registrazione.', 400, 'INVITE_ROLE_MISMATCH');
  }

  const giaRegistrato = await Utente.findOne({
    where: { email: invito.email },
    transaction: t,
  });
  if (giaRegistrato) {
    throw new AppError('Esiste già un account con questa email.', 409, 'EMAIL_ALREADY_REGISTERED');
  }

  return invito;
};

// ─────────────────────────────────────────────
// REGISTRAZIONE STUDENTE SU INVITO
// L'email e la classe sono EREDITATE dall'invito creato dall'insegnante:
// l'utente fornisce solo nome, cognome, età e password. L'account nasce
// già attivo e con email verificata (il possesso del link prova il controllo
// della casella).
// ─────────────────────────────────────────────
const registraStudenteDaInvito = async ({ token, nome, cognome, eta, password }) => {
  return sequelize.transaction(async (t) => {
    const invito = await caricaInvitoValido(token, 'studente', t);

    const nuovoUtente = await Utente.create(
      {
        nome: nome.trim(),
        cognome: cognome.trim(),
        eta,
        email: invito.email,
        password,
        ruolo: 'studente',
        classe: invito.classe, // ereditata dall'invito, non sovrascrivibile
        stato: 'attivo',
        lingua: 'it',
        email_verificata: true,
        profilo_completo: true,
      },
      { transaction: t }
    );

    await invito.update(
      { stato: 'completato', utente_creato_id: nuovoUtente.id },
      { transaction: t }
    );

    // Se l'invito è legato a un'aula, iscrivi lo studente come membro.
    // findOrCreate garantisce l'idempotenza rispetto al vincolo di unicità
    // (classe_id + utente_id), anche se lo stesso studente fosse già presente.
    if (invito.classe_id) {
      await ClasseUtente.findOrCreate({
        where: { classe_id: invito.classe_id, utente_id: nuovoUtente.id },
        defaults: {
          classe_id: invito.classe_id,
          utente_id: nuovoUtente.id,
          ruolo_nella_classe: 'studente',
          aggiunto_da: invito.invitato_da,
        },
        transaction: t,
      });
      logger.info(
        `[INVITO] Studente ${nuovoUtente.id} iscritto all'aula ${invito.classe_id} da invito`
      );
    }

    logger.info(`[INVITO] Studente registrato da invito: ${nuovoUtente.email} (classe ${invito.classe})`);
    return nuovoUtente;
  });
};

// ─────────────────────────────────────────────
// REGISTRAZIONE INSEGNANTE SU INVITO (onboarding diretto dell'admin)
// L'insegnante non inserisce alcuna classe. Account già attivo: l'admin che
// ha generato l'invito funge da approvazione.
// ─────────────────────────────────────────────
const registraInsegnanteDaInvito = async ({ token, nome, cognome, password }) => {
  return sequelize.transaction(async (t) => {
    const invito = await caricaInvitoValido(token, 'insegnante', t);

    const nuovoUtente = await Utente.create(
      {
        nome: nome.trim(),
        cognome: cognome.trim(),
        eta: null,
        email: invito.email,
        password,
        ruolo: 'insegnante',
        classe: null,
        stato: 'attivo',
        lingua: 'it',
        email_verificata: true,
        profilo_completo: true,
      },
      { transaction: t }
    );

    await invito.update(
      { stato: 'completato', utente_creato_id: nuovoUtente.id },
      { transaction: t }
    );

    logger.info(`[INVITO] Insegnante registrato da invito: ${nuovoUtente.email}`);
    return nuovoUtente;
  });
};

// ─────────────────────────────────────────────
// CANDIDATURA INSEGNANTE (self-service, soggetta ad approvazione admin)
// Crea un account insegnante in stato 'in_attesa': NON può autenticarsi
// finché un admin non lo approva. L'insegnante non inserisce alcuna classe.
// ─────────────────────────────────────────────
const richiestaInsegnante = async ({ nome, cognome, email, password, motivazione }) => {
  const emailNorm = email.toLowerCase().trim();

  const esistente = await Utente.findOne({ where: { email: emailNorm } });
  if (esistente) {
    throw new AppError('Esiste già un account con questa email.', 409, 'EMAIL_ALREADY_REGISTERED');
  }

  const nuovoUtente = await Utente.create({
    nome: nome.trim(),
    cognome: cognome.trim(),
    eta: null,
    email: emailNorm,
    password,
    ruolo: 'insegnante',
    classe: null,
    stato: 'in_attesa',
    lingua: 'it',
    email_verificata: false,
    profilo_completo: true,
    nota_candidatura: motivazione ? String(motivazione).trim() : null,
  });

  // Notifica agli admin (best-effort).
  try {
    const admin = await Utente.findAll({ where: { ruolo: 'admin', stato: 'attivo' }, attributes: ['email', 'lingua'] });
    await Promise.all(
      admin.map((a) =>
        emailService.sendNuovaCandidaturaAdminEmail(a.email, {
          nome: nuovoUtente.nome,
          cognome: nuovoUtente.cognome,
          email: nuovoUtente.email,
        }, a.lingua)
      )
    );
  } catch (err) {
    logger.error(`Errore notifica admin nuova candidatura insegnante: ${err.message}`);
  }

  logger.info(`[CANDIDATURA] Nuova candidatura insegnante in attesa: ${nuovoUtente.email}`);
  return nuovoUtente;
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
const loginUtente = async (email, password) => {
  const utente = await Utente.findOne({ where: { email: email.toLowerCase().trim() } });

  if (!utente) {
    await fakeHashCompare();
    throw new AppError('Credenziali non valide', 401, 'INVALID_CREDENTIALS');
  }

  // Account creato via Google e mai dotato di password locale.
  if (!utente.password) {
    throw new AppError('Questo account utilizza l\'accesso con Google.', 401, 'USE_GOOGLE_LOGIN');
  }

  if (utente.bloccato_fino_al && new Date(utente.bloccato_fino_al) > new Date()) {
    const millisecondiRimanenti = new Date(utente.bloccato_fino_al).getTime() - Date.now();
    const minutiRimanenti = Math.ceil(millisecondiRimanenti / 60000);
    throw new AppError(
      `Account bloccato per troppi tentativi. Riprova tra ${minutiRimanenti} minuti.`,
      403,
      'ACCOUNT_LOCKED'
    );
  }

  // Il blocco è scaduto: azzera il contatore PRIMA di valutare la password,
  // così un singolo errore successivo non causa un re-blocco immediato.
  if (utente.bloccato_fino_al) {
    utente.tentativi_falliti = 0;
    utente.bloccato_fino_al = null;
  }

  const isPasswordValid = await utente.verificaPassword(password);

  if (!isPasswordValid) {
    utente.tentativi_falliti += 1;

    if (utente.tentativi_falliti >= MAX_TENTATIVI_FALLITI) {
      const dataSblocco = new Date();
      dataSblocco.setMinutes(dataSblocco.getMinutes() + TEMPO_BLOCCO_MINUTI);
      utente.bloccato_fino_al = dataSblocco;

      await utente.save();
      throw new AppError(
        `Troppi tentativi falliti. Account bloccato per ${TEMPO_BLOCCO_MINUTI} minuti.`,
        403,
        'ACCOUNT_LOCKED'
      );
    } else {
      await utente.save();
      throw new AppError('Credenziali non valide', 401, 'INVALID_CREDENTIALS');
    }
  }

  if (!utente.email_verificata) {
    // Persiste un eventuale reset contatore effettuato sopra
    if (utente.changed()) {
      await utente.save();
    }
    throw new AppError(
      'Email non verificata. Controlla la tua casella di posta.',
      401,
      'EMAIL_NOT_VERIFIED'
    );
  }

  // Gate sullo stato account: solo gli account 'attivo' possono autenticarsi.
  // Un insegnante in attesa di approvazione (o rifiutato) viene bloccato qui,
  // DOPO la verifica della password (così non si rivela l'esistenza del blocco
  // a chi non conosce le credenziali).
  if (utente.stato !== 'attivo') {
    if (utente.changed()) {
      await utente.save();
    }
    if (utente.stato === 'in_attesa') {
      throw new AppError(
        'Il tuo account è in attesa di approvazione da parte di un amministratore.',
        403,
        'ACCOUNT_PENDING'
      );
    }
    throw new AppError(
      'Questo account non è abilitato ad accedere. Contatta un amministratore.',
      403,
      'ACCOUNT_NOT_ACTIVE'
    );
  }

  const accessToken = generateAccessToken(utente);
  const refreshToken = generateRefreshToken(utente);

  utente.tentativi_falliti = 0;
  utente.bloccato_fino_al = null;
  utente.refresh_token = hashToken(refreshToken);
  await utente.save();

  return { utente, accessToken, refreshToken };
};

const fakeHashCompare = async () => {
  await bcrypt.compare('fake_password', '$2a$12$fakehashfakehashfakehashfakehashfakehashfakeha');
  return false;
};

// ─────────────────────────────────────────────
// LOGOUT
// Invalida tutti i refresh/access token incrementando token_version.
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
// Versioning: il payload contiene token_version, verificata in modo STRETTO
// contro quella persistita. Dopo logout/reset/revoca le versioni divergono
// e ogni refresh token precedente viene rifiutato.
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
      refresh_token: hashToken(refreshToken),
    },
  });

  if (!utente) {
    throw new AppError('Refresh token non valido o sessione terminata.', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Verifica STRETTA della versione del token (refresh token versioning).
  if (decoded.token_version !== utente.token_version) {
    throw new AppError('Refresh token non valido o sessione terminata.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const nuovoAccessToken = generateAccessToken(utente);
  const nuovoRefreshToken = generateRefreshToken(utente);

  utente.refresh_token = hashToken(nuovoRefreshToken);
  await utente.save();

  return { accessToken: nuovoAccessToken, refreshToken: nuovoRefreshToken };
};

// ─────────────────────────────────────────────
// VERIFICA EMAIL
// ─────────────────────────────────────────────
const verificaEmail = async (token) => {
  const utente = await Utente.findOne({
    where: {
      email_verification_token: hashToken(token),
      nuova_email_pendente: null,
    },
  });

  if (!utente) {
    throw new AppError('Token di verifica non valido o scaduto.', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  const adesso = new Date();
  if (utente.email_verification_expire && new Date(utente.email_verification_expire) < adesso) {
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
// RE-INVIO EMAIL DI VERIFICA
// Protezione anti user-enumeration: la risposta al client è SEMPRE generica
// e con lo stesso status, indipendentemente dall'esistenza dell'account o
// dal fatto che sia già verificato.
// ─────────────────────────────────────────────
const reinviaVerificaEmail = async (email) => {
  const utente = await Utente.findOne({ where: { email: email.toLowerCase().trim() } });

  // Caso 1: utente inesistente → equalizza il costo computazionale e ritorna
  // un esito generico (nessuna informazione trapela al chiamante).
  if (!utente) {
    crypto.randomBytes(32).toString('hex');
    logger.info(`Re-invio verifica richiesto per email inesistente: ${email}`);
    return { inviata: false };
  }

  // Caso 2: email già verificata → non si re-invia nulla, ma la risposta
  // esterna resta identica al caso "inviata".
  if (utente.email_verificata) {
    logger.info(`Re-invio verifica richiesto per email già verificata: ${utente.id}`);
    return { inviata: false };
  }

  // Caso 3: utente esistente e non verificato → genera un nuovo token e
  // re-invia l'email di verifica.
  const tokenVerifica = crypto.randomBytes(32).toString('hex');
  const scadenzaVerifica = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await utente.update({
    email_verification_token: hashToken(tokenVerifica),
    email_verification_expire: scadenzaVerifica,
  });

  try {
    await emailService.sendVerificationEmail(utente.email, tokenVerifica, utente.lingua);
  } catch (err) {
    logger.error(`Errore nel re-invio dell'email di verifica a ${utente.email}: ${err.message}`);
  }

  return { inviata: true, tokenDebug: process.env.NODE_ENV !== 'production' ? tokenVerifica : undefined };
};

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────
const forgotPassword = async (email) => {
  const utente = await Utente.findOne({ where: { email: email.toLowerCase().trim() } });

  if (!utente) {
    // Equalizza approssimativamente il costo computazionale per ridurre
    // la possibilità di user-enumeration via timing.
    crypto.randomBytes(32).toString('hex');
    logger.info(`Reset password richiesto per email inesistente: ${email}`);
    return { emailInviata: false, tokenDebug: undefined };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const oreScadenza = parseInt(process.env.RESET_PASSWORD_EXPIRES_HOURS) || 1;
  const scadenza = new Date(Date.now() + oreScadenza * 60 * 60 * 1000);

  await utente.update({
    reset_password_token: hashToken(token),
    reset_password_expire: scadenza,
  });

  try {
    await emailService.sendPasswordResetEmail(utente.email, token, utente.lingua);
  } catch (err) {
    // Non rilanciare: uno status diverso (500) rispetto al caso "email
    // inesistente" (200) permetterebbe user-enumeration. La risposta al
    // client resta sempre generica e con status 200.
    logger.error(`Errore nell'invio dell'email di reset a ${utente.email}: ${err.message}`);
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
      reset_password_token: hashToken(token),
    },
    attributes: { include: ['password'] },
  });

  if (!utente) {
    throw new AppError('Token non valido o scaduto.', 400, 'INVALID_RESET_TOKEN');
  }

  const adesso = new Date();
  if (utente.reset_password_expire && new Date(utente.reset_password_expire) < adesso) {
    throw new AppError('Token di verifica scaduto.', 400, 'EXPIRED_VERIFICATION_TOKEN');
  }

  // Incrementa token_version per invalidare anche gli access/refresh token
  // già emessi: dopo un reset password nessuna sessione precedente resta valida.
  await utente.update({
    password: nuovaPassword,
    reset_password_token: null,
    reset_password_expire: null,
    refresh_token: null,
    token_version: utente.token_version + 1,
  });

  logger.info(`Password reimpostata per utente: ${utente.email}`);
};

// ─────────────────────────────────────────────
// GOOGLE OAUTH 2.0 — SOLO LOGIN / COLLEGAMENTO (no auto-registrazione)
// In un sistema ad inviti rigido, Google NON può creare nuovi account: lo
// farebbe scavalcando l'invito. Quindi:
//   1. account già collegato al google_id  → login;
//   2. account locale con la stessa email   → collega il google_id e login;
//   3. nessun account                        → ERRORE (niente registrazione).
// In tutti i casi viene applicato il gate sullo stato ('attivo').
// ─────────────────────────────────────────────
const loginOrLinkGoogle = async ({ googleId, email, emailVerificata }) => {
  const emailNorm = email ? email.toLowerCase().trim() : null;

  // 1. Account già collegato a questo google_id.
  let utente = await Utente.findOne({ where: { google_id: googleId } });

  // 2. Nessun collegamento: aggancia un account ESISTENTE con la stessa email.
  if (!utente && emailNorm) {
    utente = await Utente.findOne({ where: { email: emailNorm } });
    if (utente) {
      utente.google_id = googleId;
      if (emailVerificata && !utente.email_verificata) {
        utente.email_verificata = true;
      }
      await utente.save();
      logger.info(`Account esistente collegato a Google: ${utente.id}`);
    }
  }

  // 3. Nessun account: in modalità invito-only NON si crea nulla.
  if (!utente) {
    throw new AppError(
      "Accesso non consentito: nessun account associato a questo indirizzo Google. L'accesso è riservato agli utenti invitati.",
      403,
      'GOOGLE_NO_ACCOUNT'
    );
  }

  // Gate sullo stato: un insegnante in attesa/rifiutato non entra via Google.
  if (utente.stato !== 'attivo') {
    const code = utente.stato === 'in_attesa' ? 'ACCOUNT_PENDING' : 'ACCOUNT_NOT_ACTIVE';
    throw new AppError('Account non abilitato ad accedere.', 403, code);
  }

  const accessToken = generateAccessToken(utente);
  const refreshToken = generateRefreshToken(utente);

  utente.refresh_token = hashToken(refreshToken);
  await utente.save();

  return { utente, accessToken, refreshToken };
};

module.exports = {
  registraStudenteDaInvito,
  registraInsegnanteDaInvito,
  richiestaInsegnante,
  loginUtente,
  logoutUtente,
  refreshAccessToken,
  verificaEmail,
  reinviaVerificaEmail,
  forgotPassword,
  resetPassword,
  loginOrLinkGoogle,
};
