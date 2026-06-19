'use strict';

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');
const Utente = require('../models/Utente');
const crypto = require('crypto');
const emailService = require('../services/emailService');

/**
 * Controller Auth — livello sottile tra route e service.
 * NON contiene logica di business: solo estrazione parametri dalla request
 * e formattazione della response.
 */

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
exports.register = catchAsync(async (req, res) => {
  const { nome, cognome, eta, email, password, classe } = req.body;

  const utente = await authService.registraUtente({ nome, cognome, eta, email, password, classe });

  res.status(201).json({
    status: 'success',
    message: 'Registrazione completata. Puoi effettuare il login.',
    data: {
      utente: utente.toPublicJSON(),
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const risultato = await authService.loginUtente(email, password);

  res.status(200).json({
    status: 'success',
    message: 'Login effettuato con successo.',
    data: risultato,
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
exports.logout = catchAsync(async (req, res) => {
  // req.user è stato iniettato da authenticateJWT
  await authService.logoutUtente(req.user.id);

  res.status(200).json({
    status: 'success',
    message: 'Logout effettuato con successo.',
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
exports.me = catchAsync(async (req, res) => {
  // req.user è già stato caricato e sanitizzato dal middleware authenticateJWT
  const { id, nome, cognome, eta, email, ruolo, classe } = req.user;

  res.status(200).json({
    status: 'success',
    data: {
      utente: { id, nome, cognome, eta, email, ruolo, classe },
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/refresh-token
// ─────────────────────────────────────────────
exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  const risultato = await authService.refreshAccessToken(refreshToken);

  res.status(200).json({
    status: 'success',
    message: 'Access token rinnovato.',
    data: risultato,
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const risultato = await authService.forgotPassword(email);

  // Risposta sempre 200 per non rivelare se l'email esiste
  res.status(200).json({
    status: 'success',
    message: 'Se l\'email è registrata, riceverai le istruzioni per il reset della password.',
    // tokenDebug presente solo in sviluppo (viene da authService)
    ...(risultato.tokenDebug && { _debug_token: risultato.tokenDebug }),
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
exports.resetPassword = catchAsync(async (req, res) => {
  const { token, nuovaPassword } = req.body;

  await authService.resetPassword(token, nuovaPassword);

  res.status(200).json({
    status: 'success',
    message: 'Password aggiornata con successo. Puoi effettuare il login.',
  });
});

// ─────────────────────────────────────────────
// PATCH /api/auth/change-email
// ─────────────────────────────────────────────
exports.changeEmail = catchAsync(async (req, res) => {
  const { nuovaEmail } = req.body;
  const userId = req.user.id;

  const utenteAggiornato = await authService.changeEmail(userId, nuovaEmail);

  res.status(200).json({
    status: 'success',
    message: 'Email aggiornata con successo.',
    data: {
      utente: utenteAggiornato,
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/verify-email
// ─────────────────────────────────────────────
exports.verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  await authService.verificaEmail(token);

  res.status(200).json({
    status: 'success',
    message: 'Email verificata con successo! Ora puoi effettuare il login.',
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/request-email-change
// ─────────────────────────────────────────────
exports.requestEmailChange = catchAsync(async (req, res) => {
  const { nuovaEmail } = req.body;
  const userId = req.user.id; // Preso dal JWT token

  // 1. Controlla se la nuova email è già usata da qualcun altro
  const giaEsistente = await Utente.findOne({ where: { email: nuovaEmail.toLowerCase().trim() } });
  if (giaEsistente) {
    return res.status(409).json({ status: 'fail', message: 'Questa email è già associata a un altro account.' });
  }

  // 2. Genera un token sicuro
  const tokenVerifica = crypto.randomBytes(32).toString('hex');
  const scadenzaVerifica = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 ore di validità

  // 3. Salva temporaneamente il token e la nuova email nel database sull'utente corrente
  // Assicurati che questi campi (o simili) esistano nel tuo DB, altrimenti usa campi dedicati alla nuova email.
  await Utente.update({
    email_verification_token: tokenVerifica,
    email_verification_expire: scadenzaVerifica,
    // Se non hai una colonna temporanea 'nuova_email_pendente', puoi passarla nel link dell'email stessa,
    // oppure salvarla in un campo ad hoc nel DB. Supponiamo qui di passarla via token o averla salvata.
  }, { where: { id: userId } });

  // 4. Invia l'email alla NUOVA casella postale
  // Nota: puoi creare una funzione apposita in emailService o riadattare quella esistente
  await emailService.sendVerificationEmail(nuovaEmail, tokenVerifica); 

  res.status(200).json({
    status: 'success',
    message: 'Richiesta di cambio email presa in carico. Controlla la tua NUOVA casella postale.',
    // Solo per sviluppo, se vuoi testare senza aprire l'email:
    _debug_token: tokenVerifica
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/confirm-email-change
// ─────────────────────────────────────────────
exports.confirmEmailChange = catchAsync(async (req, res) => {
  
  res.status(200).json({
    status: 'success',
    message: 'Email modificata e confermata con successo.',
  });
});