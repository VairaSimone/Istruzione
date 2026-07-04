'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const Invito = require('../models/Invito');
const AppError = require('../utils/AppError');
const { hashToken } = require('../utils/tokenHash');
const { escapeLike } = require('../utils/escapeLike');
const logger = require('../utils/logger');
const emailService = require('./emailService');

/**
 * InviteService — gestione del ciclo di vita degli inviti.
 *
 *   creazione (studente / insegnante) · validazione token pubblica ·
 *   elenco · revoca
 *
 * Il consumo dell'invito (creazione effettiva dell'utente) avviene in
 * `authService.js`, perché riguarda il ciclo di vita delle credenziali.
 */

const INVITE_EXPIRES_HOURS = parseInt(process.env.INVITE_EXPIRES_HOURS, 10) || 168; // 7 giorni

// ─────────────────────────────────────────────
// Helpers interni
// ─────────────────────────────────────────────

/** Genera il token in chiaro + il suo hash e la data di scadenza. */
const generaTokenInvito = () => {
  const tokenInChiaro = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(tokenInChiaro);
  const scadenza = new Date(Date.now() + INVITE_EXPIRES_HOURS * 60 * 60 * 1000);
  return { tokenInChiaro, tokenHash, scadenza };
};

/**
 * Crea un invito per `email`/`ruolo`, revocando eventuali inviti pendenti
 * preesistenti per la stessa coppia (un solo token valido alla volta).
 * Eseguito in transazione per atomicità.
 */
const creaInvito = async ({ email, ruolo, classe, classeId = null, invitatoDa, lingua = 'it', nomeClasse = null }) => {
  const emailNorm = email.toLowerCase().trim();

  // Un utente già registrato non può essere re-invitato.
  const utenteEsistente = await Utente.findOne({ where: { email: emailNorm } });
  if (utenteEsistente) {
    throw new AppError(
      'Esiste già un account registrato con questa email.',
      409,
      'EMAIL_ALREADY_REGISTERED'
    );
  }

  const { tokenInChiaro, tokenHash, scadenza } = generaTokenInvito();

  const invito = await sequelize.transaction(async (t) => {
    // Revoca gli inviti pendenti preesistenti per la stessa email+ruolo:
    // invalida i vecchi token, evitando link multipli validi in parallelo.
    await Invito.update(
      { stato: 'revocato' },
      { where: { email: emailNorm, ruolo, stato: 'pendente' }, transaction: t }
    );

    return Invito.create(
      {
        email: emailNorm,
        ruolo,
        classe: ruolo === 'studente' ? classe : null,
        classe_id: ruolo === 'studente' ? classeId : null,
        token_hash: tokenHash,
        stato: 'pendente',
        scadenza,
        invitato_da: invitatoDa,
      },
      { transaction: t }
    );
  });

  // Invio email best-effort: un errore SMTP non deve invalidare l'invito
  // (l'admin/insegnante può rigenerarlo). Per gli inviti in aula si mostra il
  // nome dell'aula come etichetta di contesto.
  try {
    if (ruolo === 'studente') {
      await emailService.sendStudentInviteEmail(emailNorm, tokenInChiaro, nomeClasse || classe, lingua);
    } else {
      await emailService.sendTeacherInviteEmail(emailNorm, tokenInChiaro, lingua);
    }
  } catch (err) {
    logger.error(`Errore nell'invio dell'email di invito a ${emailNorm}: ${err.message}`);
  }

  logger.info(`[INVITO] Creato invito ${ruolo} per ${emailNorm} da utente ${invitatoDa}`);

  return {
    invito,
    // Token in chiaro restituito SOLO fuori produzione, per agevolare i test.
    tokenDebug: process.env.NODE_ENV !== 'production' ? tokenInChiaro : undefined,
  };
};

// ─────────────────────────────────────────────
// CREA INVITO STUDENTE (insegnante / admin)
// ─────────────────────────────────────────────
const creaInvitoStudente = async ({ email, classe, invitatoDa, lingua }) => {
  if (!Utente.CLASSI_VALIDE.includes(classe)) {
    throw new AppError(
      `La classe deve essere una di: ${Utente.CLASSI_VALIDE.join(', ')}`,
      422,
      'INVALID_CLASS'
    );
  }
  return creaInvito({ email, ruolo: 'studente', classe, invitatoDa, lingua });
};

// ─────────────────────────────────────────────
// CREA INVITO STUDENTE IN AULA (insegnante / admin)
// Legato a una classe: al completamento della registrazione lo studente vi
// verrà iscritto automaticamente (cfr. authService.registraStudenteDaInvito).
// La verifica di accesso all'aula è a monte, in auleService.
// ─────────────────────────────────────────────
const creaInvitoStudenteInClasse = async ({ email, classeId, nomeClasse, invitatoDa, lingua }) => {
  return creaInvito({
    email,
    ruolo: 'studente',
    classe: null,
    classeId,
    nomeClasse,
    invitatoDa,
    lingua,
  });
};

// ─────────────────────────────────────────────
// CREA INVITO INSEGNANTE (solo admin — onboarding diretto)
// ─────────────────────────────────────────────
const creaInvitoInsegnante = async ({ email, invitatoDa, lingua }) => {
  return creaInvito({ email, ruolo: 'insegnante', classe: null, invitatoDa, lingua });
};

// ─────────────────────────────────────────────
// VALIDA TOKEN (pubblico — usato dal frontend per pre-compilare il form)
// Restituisce i dati ereditati dall'invito SENZA esporre il token_hash.
// ─────────────────────────────────────────────
const validaTokenInvito = async (tokenInChiaro) => {
  const invito = await Invito.findOne({ where: { token_hash: hashToken(tokenInChiaro) } });

  if (!invito || invito.stato === 'revocato') {
    throw new AppError('Invito non valido o revocato.', 400, 'INVALID_INVITE');
  }
  if (invito.stato === 'completato') {
    throw new AppError('Questo invito è già stato utilizzato.', 410, 'INVITE_ALREADY_USED');
  }
  if (new Date(invito.scadenza) <= new Date()) {
    throw new AppError('Invito scaduto. Richiedine uno nuovo.', 410, 'INVITE_EXPIRED');
  }

  return {
    email: invito.email,
    ruolo: invito.ruolo,
    classe: invito.classe,
    scadenza: invito.scadenza,
  };
};

// ─────────────────────────────────────────────
// ELENCO INVITI (insegnante / admin)
// Gli insegnanti vedono solo i propri inviti; gli admin vedono tutto.
// ─────────────────────────────────────────────
const elencoInviti = async ({ richiedente, stato, ruolo, email, page, limit }) => {
  const where = {};

  if (richiedente.ruolo !== 'admin') {
    where.invitato_da = richiedente.id;
  }
  if (stato) where.stato = stato;
  if (ruolo) where.ruolo = ruolo;
  if (email) where.email = { [Op.like]: `%${escapeLike(email.toLowerCase().trim())}%` };

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = {
    where,
    attributes: { exclude: ['token_hash'] },
    order: [['created_at', 'DESC']],
  };

  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Invito.findAndCountAll(queryOptions);
    return {
      inviti: rows,
      paginazione: {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: count,
        totalePagine: Math.ceil(count / limitNum),
      },
    };
  }

  const inviti = await Invito.findAll(queryOptions);
  return { inviti, paginazione: null };
};

// ─────────────────────────────────────────────
// REVOCA INVITO (autore o admin)
// ─────────────────────────────────────────────
const revocaInvito = async (richiedente, invitoId) => {
  const invito = await Invito.findByPk(invitoId);
  if (!invito) {
    throw new AppError('Invito non trovato.', 404, 'INVITE_NOT_FOUND');
  }

  // Un insegnante può revocare solo gli inviti che ha creato lui.
  if (richiedente.ruolo !== 'admin' && String(invito.invitato_da) !== String(richiedente.id)) {
    throw new AppError('Non puoi revocare questo invito.', 403, 'FORBIDDEN');
  }

  if (invito.stato !== 'pendente') {
    throw new AppError(
      'Solo gli inviti ancora pendenti possono essere revocati.',
      409,
      'INVITE_NOT_PENDING'
    );
  }

  invito.stato = 'revocato';
  await invito.save();

  logger.info(`[INVITO] Invito ${invitoId} revocato da utente ${richiedente.id}`);
  return invito.toPublicJSON();
};

module.exports = {
  creaInvitoStudente,
  creaInvitoStudenteInClasse,
  creaInvitoInsegnante,
  validaTokenInvito,
  elencoInviti,
  revocaInvito,
};
