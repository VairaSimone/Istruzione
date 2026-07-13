'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const Invito = require('../models/Invito');
const Scuola = require('../models/Scuola');
const AppError = require('../utils/AppError');
const { hashToken } = require('../utils/tokenHash');
const { escapeLike } = require('../utils/escapeLike');
const { risolviScuolaCreazione } = require('../utils/tenant');
const logger = require('../utils/logger');
const impostazioniService = require('./impostazioniService');
const emailService = require('./emailService');
const quotaService = require('./quotaService');

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
const creaInvito = async ({ email, ruolo, classe, classeId = null, scuolaId = null, invitatoDa, lingua = 'it', nomeClasse = null }) => {
  const emailNorm = email.toLowerCase().trim();

  // Ogni invitato deve finire in una scuola (tenant): senza scuola l'account
  // creato resterebbe fuori dal modello multi-tenant. Fail-closed.
  if (!scuolaId) {
    throw new AppError(
      "Impossibile creare l'invito: scuola di destinazione mancante.",
      422,
      'SCUOLA_REQUIRED'
    );
  }
  // La scuola indicata deve esistere.
  const scuola = await Scuola.findByPk(scuolaId);
  if (!scuola) {
    throw new AppError('Scuola di destinazione non trovata.', 404, 'SCUOLA_NOT_FOUND');
  }

  // Un utente già registrato non può essere re-invitato.
  const utenteEsistente = await Utente.findOne({ where: { email: emailNorm } });
  if (utenteEsistente) {
    throw new AppError(
      'Esiste già un account registrato con questa email.',
      409,
      'EMAIL_ALREADY_REGISTERED'
    );
  }

  // Quote della scuola: un nuovo invito occupa un posto. Il controllo considera
  // sia gli utenti registrati sia gli inviti già pendenti (per non sovra-prenotare).
  // `insegnante` verifica anche il sotto-limite insegnanti.
  await quotaService.assicuraPostoUtente(scuola, ruolo);

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
        scuola_id: scuolaId,
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
const creaInvitoStudente = async ({ email, classe, scuolaId, richiedente, lingua }) => {
  // Tenant: insegnante → propria scuola; admin → scuolaId indicata (obbligatoria).
  const scuolaFinale = risolviScuolaCreazione(richiedente, scuolaId, {
    scuolaObbligatoriaPerAdmin: true,
  });

  // La classe non è più un ENUM di piattaforma: ogni scuola definisce il proprio
  // vocabolario in `impostazioni.didattica.classiDisponibili`. Vocabolario vuoto
  // ⇒ testo libero. La classe resta comunque obbligatoria per gli inviti studente.
  if (classe === undefined || classe === null || String(classe).trim() === '') {
    throw new AppError('La classe è obbligatoria per gli inviti studente.', 422, 'INVALID_CLASS');
  }
  const classeNorm = await impostazioniService.assicuraNelVocabolario(
    scuolaFinale,
    'classiDisponibili',
    classe,
    'La classe'
  );

  return creaInvito({
    email,
    ruolo: 'studente',
    classe: classeNorm,
    scuolaId: scuolaFinale,
    invitatoDa: richiedente.id,
    lingua,
  });
};

// ─────────────────────────────────────────────
// CREA INVITO STUDENTE IN AULA (insegnante / admin)
// Legato a una classe: al completamento della registrazione lo studente vi
// verrà iscritto automaticamente (cfr. authService.registraStudenteDaInvito).
// La verifica di accesso all'aula e la scuola (dell'aula) sono a monte, in
// auleService.
// ─────────────────────────────────────────────
const creaInvitoStudenteInClasse = async ({ email, classeId, nomeClasse, scuolaId, invitatoDa, lingua }) => {
  return creaInvito({
    email,
    ruolo: 'studente',
    classe: null,
    classeId,
    nomeClasse,
    scuolaId,
    invitatoDa,
    lingua,
  });
};

// ─────────────────────────────────────────────
// CREA INVITO INSEGNANTE (solo admin — onboarding diretto)
// L'admin sceglie la scuola a cui l'insegnante verrà iscritto (obbligatoria).
// ─────────────────────────────────────────────
const creaInvitoInsegnante = async ({ email, scuolaId, richiedente, lingua }) => {
  const scuolaFinale = risolviScuolaCreazione(richiedente, scuolaId, {
    scuolaObbligatoriaPerAdmin: true,
  });
  return creaInvito({
    email,
    ruolo: 'insegnante',
    classe: null,
    scuolaId: scuolaFinale,
    invitatoDa: richiedente.id,
    lingua,
  });
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
    scuola_id: invito.scuola_id,
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
