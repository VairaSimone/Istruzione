'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const { hashToken } = require('../utils/tokenHash');
const { escapeLike } = require('../utils/escapeLike');
const logger = require('../utils/logger');
const emailService = require('./emailService');

/**
 * UserService — responsabilità ESCLUSIVA: gestione utenti e account.
 *
 *   cambio email · eliminazione account (self) · lingua ·
 *   lista utenti · aggiornamento ruolo · eliminazione utenti (admin)
 *
 * L'autenticazione vive in `authService.js`.
 */

// ─────────────────────────────────────────────
// RICHIESTA CAMBIO EMAIL
// ─────────────────────────────────────────────
const richiediCambioEmail = async (userId, nuovaEmail) => {
  const emailFormattata = nuovaEmail.toLowerCase().trim();

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
    email_verification_token: hashToken(tokenVerifica),
    email_verification_expire: scadenzaVerifica,
    nuova_email_pendente: emailFormattata,
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
      email_verification_token: hashToken(token),
      nuova_email_pendente: { [Op.ne]: null },
    },
  });

  if (!utente) {
    throw new AppError('Token di verifica non valido o non associato a un cambio email.', 400, 'INVALID_TOKEN');
  }

  if (utente.email_verification_expire && new Date(utente.email_verification_expire) < new Date()) {
    throw new AppError('Il token di verifica è scaduto. Richiedi un nuovo cambio email.', 400, 'EXPIRED_TOKEN');
  }

  const nuovaEmail = utente.nuova_email_pendente;

  // Verifica che l'email non sia stata occupata da un altro account nel
  // frattempo (consistenza dei dati / unique constraint).
  const giaPreso = await Utente.findOne({ where: { email: nuovaEmail } });
  if (giaPreso && giaPreso.id !== utente.id) {
    throw new AppError('Questa email è già associata a un altro account.', 409, 'EMAIL_TAKEN');
  }

  await utente.update({
    email: nuovaEmail,
    nuova_email_pendente: null,
    email_verification_token: null,
    email_verification_expire: null,
  });

  logger.info(`Email aggiornata con successo per utente ID: ${utente.id}`);
  return utente;
};

// ─────────────────────────────────────────────
// AGGIORNA LINGUA
// ─────────────────────────────────────────────
const aggiornaLingua = async (userId, lingua) => {
  if (!['it', 'en'].includes(lingua)) {
    throw new AppError('Lingua non supportata.', 400, 'INVALID_LANGUAGE');
  }

  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  utente.lingua = lingua;
  await utente.save();

  return utente;
};

// ─────────────────────────────────────────────
// ELIMINA ACCOUNT (self)
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
if (req.user.ruolo !== 'admin') {
    where.scuolaId = req.user.scuolaId;
  }
  if (nome) {
    // Escape dei wildcard LIKE (% _ \) sull'input utente per prevenire
    // LIKE injection e query a costo esponenziale.
    const termine = `%${escapeLike(nome)}%`;
    where[Op.or] = [
      { nome: { [Op.like]: termine } },
      { cognome: { [Op.like]: termine } },
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
        'email_verification_expire',
      ],
    },
    order: [['cognome', 'ASC'], ['nome', 'ASC']],
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
// Eseguito in TRANSAZIONE con lock di riga: impedisce la race condition in
// cui due declassamenti concorrenti lascino il sistema senza insegnanti.
// Incrementa inoltre token_version del bersaglio (revoca sessioni) così che
// il nuovo ruolo abbia effetto immediato.
// ─────────────────────────────────────────────
const aggiornaRuoloUtente = async (actingUserId, actingRole, userId, nuovoRuolo) => {
  if (!Utente.RUOLI_VALIDI.includes(nuovoRuolo)) {
    throw new AppError('Ruolo non valido.', 422, 'INVALID_ROLE');
  }

  if (String(actingUserId) === String(userId)) {
    throw new AppError('Non puoi modificare il tuo stesso ruolo.', 403, 'SELF_ROLE_CHANGE_FORBIDDEN');
  }

  // Solo un admin può assegnare (o revocare) il ruolo admin: impedisce a un
  // insegnante di promuovere se stesso o altri ad amministratore.
  if (nuovoRuolo === 'admin' && actingRole !== 'admin') {
    throw new AppError('Solo un amministratore può assegnare il ruolo admin.', 403, 'ADMIN_ROLE_FORBIDDEN');
  }

  return sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    // Solo un admin può declassare un altro admin.
    if (utente.ruolo === 'admin' && actingRole !== 'admin') {
      throw new AppError('Solo un amministratore può modificare un account admin.', 403, 'ADMIN_ROLE_FORBIDDEN');
    }

    // Salvaguardia atomica: non declassare l'ultimo admin rimasto.
    if (utente.ruolo === 'admin' && nuovoRuolo !== 'admin') {
      const admin = await Utente.findAll({
        where: { ruolo: 'admin' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (admin.length <= 1) {
        throw new AppError('Impossibile declassare l\'ultimo amministratore.', 409, 'LAST_ADMIN');
      }
    }

    // Salvaguardia atomica: non declassare l'ultimo insegnante rimasto.
    if (utente.ruolo === 'insegnante' && nuovoRuolo !== 'insegnante') {
      // Blocca TUTTE le righe insegnante per la durata della transazione:
      // un'altra transazione concorrente che voglia declassare/eliminare un
      // insegnante resta in attesa, evitando il "double demote".
      const insegnanti = await Utente.findAll({
        where: { ruolo: 'insegnante' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (insegnanti.length <= 1) {
        throw new AppError('Impossibile declassare l\'ultimo insegnante.', 409, 'LAST_TEACHER');
      }
    }

    await utente.update(
      {
        ruolo: nuovoRuolo,
        // Revoca delle sessioni attive del bersaglio: il cambio ruolo ha
        // effetto immediato e i refresh token preesistenti vengono invalidati.
        token_version: utente.token_version + 1,
        refresh_token: null,
      },
      { transaction: t }
    );

    logger.info(`[AUDIT] Ruolo modificato dall'insegnante ${actingUserId}: utente ${userId} -> ${nuovoRuolo}`);

    return utente.toPublicJSON();
  });
};

// ─────────────────────────────────────────────
// ELIMINA ACCOUNT (azione amministrativa insegnante)
// Eseguito in TRANSAZIONE con lock di riga per garantire l'atomicità del
// controllo "ultimo insegnante".
// ─────────────────────────────────────────────
const eliminaUtenteComeInsegnante = async (actingUserId, actingRole, targetUserId) => {
  if (String(actingUserId) === String(targetUserId)) {
    throw new AppError(
      'Non puoi eliminare il tuo account da questa sezione. Usa le impostazioni del profilo.',
      403,
      'SELF_DELETE_FORBIDDEN'
    );
  }

  return sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(targetUserId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    // Solo un admin può eliminare un altro admin.
    if (utente.ruolo === 'admin' && actingRole !== 'admin') {
      throw new AppError('Solo un amministratore può eliminare un account admin.', 403, 'ADMIN_ROLE_FORBIDDEN');
    }

    // Salvaguardia atomica: non eliminare l'ultimo admin rimasto.
    if (utente.ruolo === 'admin') {
      const admin = await Utente.findAll({
        where: { ruolo: 'admin' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (admin.length <= 1) {
        throw new AppError('Impossibile eliminare l\'ultimo amministratore.', 409, 'LAST_ADMIN');
      }
    }

    if (utente.ruolo === 'insegnante') {
      const insegnanti = await Utente.findAll({
        where: { ruolo: 'insegnante' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (insegnanti.length <= 1) {
        throw new AppError('Impossibile eliminare l\'ultimo insegnante.', 409, 'LAST_TEACHER');
      }
    }

    await utente.destroy({ transaction: t });
    logger.info(`[AUDIT] Account ${targetUserId} eliminato dall'utente ${actingUserId}`);
  });
};

module.exports = {
  richiediCambioEmail,
  confermaCambioEmail,
  aggiornaLingua,
  eliminaAccount,
  getUtentiPerInsegnante,
  aggiornaRuoloUtente,
  eliminaUtenteComeInsegnante,
};
