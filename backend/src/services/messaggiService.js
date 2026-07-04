'use strict';

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Messaggio = require('../models/Messaggio');
const MessaggioDestinatario = require('../models/MessaggioDestinatario');
const ClasseUtente = require('../models/ClasseUtente');
const Classe = require('../models/Classe');
const Compito = require('../models/Compito');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const compitiService = require('./compitiService');

/**
 * MessaggiService — comunicazione interna e feedback.
 *
 *   invio (studente / aula) · incoraggiamenti · note private · feedback su
 *   compiti · inbox · notifiche non letti · risposte (threading)
 *
 * Regole di accesso:
 *   - il docente scrive a studenti/aule con cui condivide un'aula (admin: tutti);
 *   - lo studente NON inizia messaggi: può solo rispondere (se consentito) e
 *     leggere la propria posta;
 *   - le note private sono visibili solo all'autore.
 */

const ATTRIBUTI_UTENTE = ['id', 'nome', 'cognome', 'email'];

// ─────────────────────────────────────────────
// Helpers di autorizzazione
// ─────────────────────────────────────────────

const insegnaNellaClasse = async (classeId, richiedente, transaction) => {
  if (richiedente.ruolo === 'admin') return true;
  const m = await ClasseUtente.findOne({
    where: { classe_id: classeId, utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    transaction,
  });
  return !!m;
};

const condivideClasseConStudente = async (utenteId, richiedente, transaction) => {
  if (richiedente.ruolo === 'admin') return true;
  const aule = await ClasseUtente.findAll({
    where: { utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  const classeIds = aule.map((a) => a.classe_id);
  if (!classeIds.length) return false;
  const m = await ClasseUtente.findOne({
    where: { classe_id: { [Op.in]: classeIds }, utente_id: utenteId, ruolo_nella_classe: 'studente' },
    transaction,
  });
  return !!m;
};

const caricaMessaggio = async (id, opzioni = {}) => {
  const messaggio = await Messaggio.findByPk(id, opzioni);
  if (!messaggio) throw new AppError('Messaggio non trovato.', 404, 'MESSAGE_NOT_FOUND');
  return messaggio;
};

// ─────────────────────────────────────────────
// INVIO MESSAGGIO (docente → studente | aula | nota privata)
// ─────────────────────────────────────────────
const inviaMessaggio = async ({ dati, richiedente }) => {
  const {
    tipo = 'messaggio', oggetto, corpo, studenteId, classeId,
    compitoId, notaSuUtenteId, consentiRisposte = true,
  } = dati;

  return sequelize.transaction(async (t) => {
    // Se legato a un compito, deve esistere ed essere dell'autore (o admin).
    if (compitoId) {
      const compito = await Compito.findByPk(compitoId, { transaction: t });
      if (!compito) throw new AppError('Compito non trovato.', 404, 'COMPITO_NOT_FOUND');
      if (richiedente.ruolo !== 'admin' && String(compito.creato_da) !== String(richiedente.id)) {
        throw new AppError('Non hai accesso a questo compito.', 403, 'FORBIDDEN');
      }
    }

    let classeContesto = null;
    let destinatariIds = [];
    let notaSu = null;

    if (tipo === 'nota_privata') {
      // Nessun destinatario: visibile solo all'autore. Facoltativo il
      // riferimento a uno studente delle proprie aule.
      if (notaSuUtenteId) {
        if (!(await condivideClasseConStudente(notaSuUtenteId, richiedente, t))) {
          throw new AppError('Puoi annotare solo studenti delle tue aule.', 403, 'FORBIDDEN');
        }
        notaSu = notaSuUtenteId;
      }
      if (classeId) {
        if (!(await insegnaNellaClasse(classeId, richiedente, t))) {
          throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
        }
        classeContesto = classeId;
      }
    } else {
      // Messaggio "vero": esattamente uno tra studenteId e classeId.
      if (Boolean(studenteId) === Boolean(classeId)) {
        throw new AppError(
          'Specificare esattamente uno tra studenteId e classeId.',
          422,
          'INVALID_MESSAGE_TARGET'
        );
      }

      if (studenteId) {
        const studente = await Utente.findByPk(studenteId, { transaction: t });
        if (!studente || studente.ruolo !== 'studente') {
          throw new AppError('Studente non trovato.', 404, 'USER_NOT_FOUND');
        }
        if (!(await condivideClasseConStudente(studenteId, richiedente, t))) {
          throw new AppError('Puoi scrivere solo a studenti delle tue aule.', 403, 'FORBIDDEN');
        }
        destinatariIds = [studenteId];
      } else {
        const classe = await Classe.findByPk(classeId, { transaction: t });
        if (!classe) throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
        if (!(await insegnaNellaClasse(classeId, richiedente, t))) {
          throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
        }
        classeContesto = classeId;
        const membri = await ClasseUtente.findAll({
          where: { classe_id: classeId, ruolo_nella_classe: 'studente' },
          attributes: ['utente_id'],
          raw: true,
          transaction: t,
        });
        destinatariIds = membri.map((m) => m.utente_id);
      }
    }

    const messaggio = await Messaggio.create(
      {
        mittente_id: richiedente.id,
        tipo,
        oggetto: oggetto ?? null,
        corpo: corpo.trim(),
        classe_id: classeContesto,
        compito_id: compitoId ?? null,
        nota_su_utente_id: notaSu,
        messaggio_padre_id: null,
        consenti_risposte: tipo === 'nota_privata' ? false : consentiRisposte,
      },
      { transaction: t }
    );

    if (destinatariIds.length) {
      await MessaggioDestinatario.bulkCreate(
        destinatariIds.map((uid) => ({
          messaggio_id: messaggio.id,
          utente_id: uid,
          letto: false,
        })),
        { transaction: t }
      );
    }

    logger.info(
      `[MSG] ${tipo} ${messaggio.id} da ${richiedente.id} → ${destinatariIds.length} destinatari`
    );

    return { ...messaggio.toPublicJSON(), numeroDestinatari: destinatariIds.length };
  });
};

// ─────────────────────────────────────────────
// FEEDBACK SU COMPITO (scrive la consegna + notifica lo studente)
// Riusa compitiService.valutaConsegna come UNICA fonte di verità del feedback.
// ─────────────────────────────────────────────
const inviaFeedbackCompito = async ({ compitoId, studenteId, corpo, punteggio, richiedente }) => {
  // 1. Persistenza del feedback/punteggio sulla consegna (autorizza e valida
  //    proprietà del compito ed esistenza della consegna).
  const consegna = await compitiService.valutaConsegna({
    compitoId,
    utenteId: studenteId,
    dati: { feedback: corpo, punteggioOttenuto: punteggio },
    richiedente,
  });

  // 2. Messaggio di feedback allo studente (notifica).
  const messaggio = await sequelize.transaction(async (t) => {
    const msg = await Messaggio.create(
      {
        mittente_id: richiedente.id,
        tipo: 'feedback',
        oggetto: 'Feedback sul compito',
        corpo: corpo.trim(),
        compito_id: compitoId,
        consenti_risposte: true,
      },
      { transaction: t }
    );
    await MessaggioDestinatario.create(
      { messaggio_id: msg.id, utente_id: studenteId, letto: false },
      { transaction: t }
    );
    return msg;
  });

  logger.info(`[MSG] Feedback compito ${compitoId} → studente ${studenteId}`);
  return { consegna, messaggio: messaggio.toPublicJSON() };
};

// ─────────────────────────────────────────────
// INBOX — messaggi ricevuti
// ─────────────────────────────────────────────
const elencoRicevuti = async ({ utente, filtri }) => {
  const whereDest = { utente_id: utente.id };
  if (filtri.nonLetti === true) whereDest.letto = false;

  const pageNum = parseInt(filtri.page, 10);
  const limitNum = parseInt(filtri.limit, 10);
  const usaPag = Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = {
    where: whereDest,
    include: [
      {
        model: Messaggio,
        as: 'messaggio',
        include: [{ model: Utente, as: 'mittente', attributes: ATTRIBUTI_UTENTE }],
      },
    ],
    order: [[{ model: Messaggio, as: 'messaggio' }, 'created_at', 'DESC']],
  };
  if (usaPag) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPag) {
    const r = await MessaggioDestinatario.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await MessaggioDestinatario.findAll(queryOptions);
  }

  const messaggi = righe
    .filter((d) => d.messaggio)
    .map((d) => ({
      ...d.messaggio.toPublicJSON(),
      letto: d.letto,
      lettoIl: d.letto_il,
      mittente: d.messaggio.mittente
        ? {
            id: d.messaggio.mittente.id,
            nome: d.messaggio.mittente.nome,
            cognome: d.messaggio.mittente.cognome,
          }
        : null,
    }));

  const paginazione = usaPag
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { messaggi, paginazione };
};

// ─────────────────────────────────────────────
// POSTA INVIATA (docente) — con conteggi lettura
// ─────────────────────────────────────────────
const elencoInviati = async ({ richiedente, filtri }) => {
  const where = { mittente_id: richiedente.id, tipo: { [Op.ne]: 'nota_privata' }, messaggio_padre_id: null };

  const pageNum = parseInt(filtri.page, 10);
  const limitNum = parseInt(filtri.limit, 10);
  const usaPag = Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = { where, order: [['created_at', 'DESC']] };
  if (usaPag) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPag) {
    const r = await Messaggio.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await Messaggio.findAll(queryOptions);
  }

  const ids = righe.map((m) => m.id);
  const mappaConteggi = new Map();
  if (ids.length) {
    const conteggi = await MessaggioDestinatario.findAll({
      where: { messaggio_id: { [Op.in]: ids } },
      attributes: [
        'messaggio_id',
        [fn('COUNT', col('id')), 'totali'],
        [fn('SUM', col('letto')), 'letti'],
      ],
      group: ['messaggio_id'],
      raw: true,
    });
    for (const c of conteggi) {
      mappaConteggi.set(c.messaggio_id, {
        destinatari: Number(c.totali) || 0,
        letti: Number(c.letti) || 0,
      });
    }
  }

  const messaggi = righe.map((m) => ({
    ...m.toPublicJSON(),
    conteggio: mappaConteggi.get(m.id) || { destinatari: 0, letti: 0 },
  }));

  const paginazione = usaPag
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { messaggi, paginazione };
};

// ─────────────────────────────────────────────
// NOTE PRIVATE (docente)
// ─────────────────────────────────────────────
const elencoNote = async ({ richiedente, filtri }) => {
  const where = { mittente_id: richiedente.id, tipo: 'nota_privata' };

  const pageNum = parseInt(filtri.page, 10);
  const limitNum = parseInt(filtri.limit, 10);
  const usaPag = Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = {
    where,
    include: [{ model: Utente, as: 'notaSu', attributes: ATTRIBUTI_UTENTE }],
    order: [['created_at', 'DESC']],
  };
  if (usaPag) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPag) {
    const r = await Messaggio.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await Messaggio.findAll(queryOptions);
  }

  const note = righe.map((m) => ({
    ...m.toPublicJSON(),
    notaSu: m.notaSu
      ? { id: m.notaSu.id, nome: m.notaSu.nome, cognome: m.notaSu.cognome }
      : null,
  }));

  const paginazione = usaPag
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { note, paginazione };
};

// ─────────────────────────────────────────────
// NOTIFICHE — conteggio non letti
// ─────────────────────────────────────────────
const contaNonLetti = async ({ utente }) => {
  const nonLetti = await MessaggioDestinatario.count({
    where: { utente_id: utente.id, letto: false },
  });
  return { nonLetti };
};

// ─────────────────────────────────────────────
// DETTAGLIO — leggere un messaggio (marca come letto se destinatario)
// ─────────────────────────────────────────────
const dettaglioMessaggio = async ({ messaggioId, utente }) => {
  const messaggio = await caricaMessaggio(messaggioId, {
    include: [{ model: Utente, as: 'mittente', attributes: ATTRIBUTI_UTENTE }],
  });

  const eAutore = String(messaggio.mittente_id) === String(utente.id);
  const destinatario = await MessaggioDestinatario.findOne({
    where: { messaggio_id: messaggioId, utente_id: utente.id },
  });

  if (!eAutore && !destinatario) {
    throw new AppError('Messaggio non trovato.', 404, 'MESSAGE_NOT_FOUND');
  }

  // Marca come letto alla lettura da parte del destinatario.
  if (destinatario && !destinatario.letto) {
    destinatario.letto = true;
    destinatario.letto_il = new Date();
    await destinatario.save();
  }

  // Thread: risposte dirette.
  const risposte = await Messaggio.findAll({
    where: { messaggio_padre_id: messaggioId },
    include: [{ model: Utente, as: 'mittente', attributes: ATTRIBUTI_UTENTE }],
    order: [['created_at', 'ASC']],
  });

  return {
    ...messaggio.toPublicJSON(),
    mittente: messaggio.mittente
      ? { id: messaggio.mittente.id, nome: messaggio.mittente.nome, cognome: messaggio.mittente.cognome }
      : null,
    letto: destinatario ? true : undefined,
    risposte: risposte.map((r) => ({
      ...r.toPublicJSON(),
      mittente: r.mittente
        ? { id: r.mittente.id, nome: r.mittente.nome, cognome: r.mittente.cognome }
        : null,
    })),
  };
};

// ─────────────────────────────────────────────
// SEGNA COME LETTO (esplicito)
// ─────────────────────────────────────────────
const segnaLetto = async ({ messaggioId, utente }) => {
  const destinatario = await MessaggioDestinatario.findOne({
    where: { messaggio_id: messaggioId, utente_id: utente.id },
  });
  if (!destinatario) {
    throw new AppError('Messaggio non trovato.', 404, 'MESSAGE_NOT_FOUND');
  }
  if (!destinatario.letto) {
    destinatario.letto = true;
    destinatario.letto_il = new Date();
    await destinatario.save();
  }
  return destinatario.toPublicJSON();
};

// ─────────────────────────────────────────────
// RISPONDI (destinatario → mittente, se consentito)
// ─────────────────────────────────────────────
const rispondi = async ({ messaggioId, corpo, utente }) => {
  return sequelize.transaction(async (t) => {
    const padre = await caricaMessaggio(messaggioId, { transaction: t });

    const destinatario = await MessaggioDestinatario.findOne({
      where: { messaggio_id: messaggioId, utente_id: utente.id },
      transaction: t,
    });
    if (!destinatario) {
      throw new AppError('Puoi rispondere solo ai messaggi che hai ricevuto.', 403, 'FORBIDDEN');
    }
    if (!padre.consenti_risposte) {
      throw new AppError('Le risposte non sono consentite per questo messaggio.', 403, 'REPLIES_DISABLED');
    }
    if (!padre.mittente_id) {
      throw new AppError('Il destinatario della risposta non è più disponibile.', 409, 'NO_RECIPIENT');
    }

    const risposta = await Messaggio.create(
      {
        mittente_id: utente.id,
        tipo: 'messaggio',
        oggetto: padre.oggetto ? `Re: ${padre.oggetto}`.slice(0, 160) : null,
        corpo: corpo.trim(),
        messaggio_padre_id: padre.id,
        consenti_risposte: true,
      },
      { transaction: t }
    );

    await MessaggioDestinatario.create(
      { messaggio_id: risposta.id, utente_id: padre.mittente_id, letto: false },
      { transaction: t }
    );

    logger.info(`[MSG] Risposta ${risposta.id} a ${messaggioId} da ${utente.id}`);
    return risposta.toPublicJSON();
  });
};

// ─────────────────────────────────────────────
// ELIMINA MESSAGGIO (solo autore / admin)
// ─────────────────────────────────────────────
const eliminaMessaggio = async ({ messaggioId, richiedente }) => {
  const messaggio = await caricaMessaggio(messaggioId);
  if (richiedente.ruolo !== 'admin' && String(messaggio.mittente_id) !== String(richiedente.id)) {
    throw new AppError('Non puoi eliminare questo messaggio.', 403, 'FORBIDDEN');
  }
  await messaggio.destroy(); // cascade sui destinatari
  logger.info(`[MSG] Messaggio ${messaggioId} eliminato da ${richiedente.id}`);
};

module.exports = {
  inviaMessaggio,
  inviaFeedbackCompito,
  elencoRicevuti,
  elencoInviati,
  elencoNote,
  contaNonLetti,
  dettaglioMessaggio,
  segnaLetto,
  rispondi,
  eliminaMessaggio,
};
