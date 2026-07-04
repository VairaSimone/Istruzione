'use strict';

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const logger = require('../utils/logger');
const inviteService = require('./inviteService');

/**
 * AuleService — logica di dominio delle AULE VIRTUALI (classi).
 *
 *   CRUD aule · membership (insegnanti/studenti) · inviti in aula
 *
 * Regole di accesso applicate qui (difesa a livello service, oltre al gate di
 * ruolo nelle route):
 *   - un insegnante opera SOLO sulle aule di cui è membro-insegnante;
 *   - l'admin opera su tutte le aule;
 *   - gli studenti non raggiungono questo service (route riservate a
 *     insegnante|admin).
 *
 * Tutte le query evitano N+1: i conteggi membri sono ottenuti con una singola
 * query aggregata e i membri con una sola join, mai in loop.
 */

// Campi anagrafici minimi esposti per un membro dell'aula.
const ATTRIBUTI_MEMBRO = ['id', 'nome', 'cognome', 'email', 'ruolo', 'stato'];

// ─────────────────────────────────────────────
// Helpers interni
// ─────────────────────────────────────────────

/** Carica l'aula o lancia 404. */
const caricaClasse = async (classeId, opzioni = {}) => {
  const classe = await Classe.findByPk(classeId, opzioni);
  if (!classe) {
    throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
  }
  return classe;
};

/**
 * Verifica che il richiedente possa gestire l'aula: admin sempre, altrimenti
 * deve esserne membro-insegnante. Lancia 403 in caso contrario.
 */
const assicuraAccessoInsegnante = async (classeId, richiedente, transaction) => {
  if (richiedente.ruolo === 'admin') return;

  const membership = await ClasseUtente.findOne({
    where: {
      classe_id: classeId,
      utente_id: richiedente.id,
      ruolo_nella_classe: 'insegnante',
    },
    transaction,
  });

  if (!membership) {
    throw new AppError('Non hai accesso a questa aula.', 403, 'FORBIDDEN');
  }
};

/**
 * Risolve un utente destinatario da id OPPURE email, verificandone il ruolo
 * globale atteso e lo stato 'attivo'. Usato per aggiungere membri già
 * registrati.
 */
const risolviUtenteRegistrato = async (
  { utenteId, email },
  ruoloAtteso,
  transaction
) => {
  let utente = null;

  if (utenteId) {
    utente = await Utente.findByPk(utenteId, { transaction });
  } else if (email) {
    utente = await Utente.findOne({
      where: { email: email.toLowerCase().trim() },
      transaction,
    });
  }

  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }
  if (utente.ruolo !== ruoloAtteso) {
    const etichetta = ruoloAtteso === 'studente' ? 'uno studente' : 'un insegnante';
    throw new AppError(`L'utente indicato non è ${etichetta}.`, 422, 'INVALID_MEMBER_ROLE');
  }
  if (utente.stato !== 'attivo') {
    throw new AppError("L'utente indicato non è attivo.", 422, 'USER_NOT_ACTIVE');
  }

  return utente;
};

/**
 * Conta insegnanti e studenti per un insieme di aule con UNA sola query
 * aggregata (niente N+1). Restituisce una mappa classeId → { insegnanti, studenti }.
 */
const conteggiMembri = async (classeIds) => {
  const mappa = new Map();
  if (!classeIds.length) return mappa;

  const righe = await ClasseUtente.findAll({
    where: { classe_id: { [Op.in]: classeIds } },
    attributes: [
      'classe_id',
      'ruolo_nella_classe',
      [fn('COUNT', col('id')), 'totale'],
    ],
    group: ['classe_id', 'ruolo_nella_classe'],
    raw: true,
  });

  for (const r of righe) {
    const corrente = mappa.get(r.classe_id) || { insegnanti: 0, studenti: 0 };
    if (r.ruolo_nella_classe === 'insegnante') {
      corrente.insegnanti = parseInt(r.totale, 10);
    } else {
      corrente.studenti = parseInt(r.totale, 10);
    }
    mappa.set(r.classe_id, corrente);
  }

  return mappa;
};

// ─────────────────────────────────────────────
// CREA AULA
// Il creatore diventa automaticamente membro-insegnante dell'aula.
// ─────────────────────────────────────────────
const creaClasse = async ({ dati, creatore }) => {
  const classe = await sequelize.transaction(async (t) => {
    const nuova = await Classe.create(
      {
        nome: dati.nome.trim(),
        descrizione: dati.descrizione ?? null,
        anno_scolastico: dati.annoScolastico ?? null,
        livello_jlpt: dati.livelloJLPT ?? null,
        colore: dati.colore ?? null,
        icona: dati.icona ?? null,
        creata_da: creatore.id,
        archiviata: false,
      },
      { transaction: t }
    );

    await ClasseUtente.create(
      {
        classe_id: nuova.id,
        utente_id: creatore.id,
        ruolo_nella_classe: 'insegnante',
        aggiunto_da: creatore.id,
      },
      { transaction: t }
    );

    return nuova;
  });

  logger.info(`[AULA] Creata aula ${classe.id} "${classe.nome}" da utente ${creatore.id}`);

  return {
    ...classe.toPublicJSON(),
    conteggio: { insegnanti: 1, studenti: 0 },
  };
};

// ─────────────────────────────────────────────
// ELENCO AULE (con conteggio membri)
// Insegnante: solo le proprie aule. Admin: tutte. Filtri + paginazione.
// ─────────────────────────────────────────────
const elencoClassi = async ({ richiedente, filtri }) => {
  const { livello, anno, archiviata, q, page, limit } = filtri;
  const where = {};

  // Scope insegnante: limita alle aule di cui è membro-insegnante.
  if (richiedente.ruolo !== 'admin') {
    const iscrizioni = await ClasseUtente.findAll({
      where: { utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
      attributes: ['classe_id'],
      raw: true,
    });
    const idAule = iscrizioni.map((i) => i.classe_id);
    // Nessuna aula ⇒ risultato vuoto senza interrogare `classi`.
    if (!idAule.length) {
      return { classi: [], paginazione: null };
    }
    where.id = { [Op.in]: idAule };
  }

  if (livello) where.livello_jlpt = livello;
  if (anno) where.anno_scolastico = anno;
  if (archiviata !== undefined) where.archiviata = archiviata;
  if (q) {
    where.nome = { [Op.like]: `%${escapeLike(q.trim())}%` };
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = {
    where,
    order: [['created_at', 'DESC']],
  };
  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPaginazione) {
    const risultato = await Classe.findAndCountAll(queryOptions);
    righe = risultato.rows;
    totale = risultato.count;
  } else {
    righe = await Classe.findAll(queryOptions);
  }

  // Conteggio membri in un'unica query aggregata (niente N+1).
  const conteggi = await conteggiMembri(righe.map((c) => c.id));

  const classi = righe.map((c) => ({
    ...c.toPublicJSON(),
    conteggio: conteggi.get(c.id) || { insegnanti: 0, studenti: 0 },
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { classi, paginazione };
};

// ─────────────────────────────────────────────
// DETTAGLIO AULA (con elenco membri diviso per ruolo)
// ─────────────────────────────────────────────
const dettaglioClasse = async ({ classeId, richiedente }) => {
  const classe = await caricaClasse(classeId);
  await assicuraAccessoInsegnante(classeId, richiedente);

  // Una sola join per tutti i membri; niente query per membro.
  const iscrizioni = await ClasseUtente.findAll({
    where: { classe_id: classeId },
    include: [{ model: Utente, as: 'utente', attributes: ATTRIBUTI_MEMBRO }],
    order: [
      ['ruolo_nella_classe', 'ASC'],
      [{ model: Utente, as: 'utente' }, 'cognome', 'ASC'],
      [{ model: Utente, as: 'utente' }, 'nome', 'ASC'],
    ],
  });

  const insegnanti = [];
  const studenti = [];
  for (const iscr of iscrizioni) {
    if (!iscr.utente) continue;
    const membro = {
      id: iscr.utente.id,
      nome: iscr.utente.nome,
      cognome: iscr.utente.cognome,
      email: iscr.utente.email,
      stato: iscr.utente.stato,
      iscrittoIl: iscr.created_at,
    };
    if (iscr.ruolo_nella_classe === 'insegnante') insegnanti.push(membro);
    else studenti.push(membro);
  }

  return {
    ...classe.toPublicJSON(),
    conteggio: { insegnanti: insegnanti.length, studenti: studenti.length },
    insegnanti,
    studenti,
  };
};

// ─────────────────────────────────────────────
// AGGIORNA AULA
// ─────────────────────────────────────────────
const aggiornaClasse = async ({ classeId, dati, richiedente }) => {
  const classe = await caricaClasse(classeId);
  await assicuraAccessoInsegnante(classeId, richiedente);

  // Applica solo i campi effettivamente presenti nel payload.
  if (dati.nome !== undefined) classe.nome = dati.nome.trim();
  if (dati.descrizione !== undefined) classe.descrizione = dati.descrizione;
  if (dati.annoScolastico !== undefined) classe.anno_scolastico = dati.annoScolastico;
  if (dati.livelloJLPT !== undefined) classe.livello_jlpt = dati.livelloJLPT;
  if (dati.colore !== undefined) classe.colore = dati.colore;
  if (dati.icona !== undefined) classe.icona = dati.icona;
  if (dati.archiviata !== undefined) classe.archiviata = dati.archiviata;

  await classe.save();

  logger.info(`[AULA] Aggiornata aula ${classeId} da utente ${richiedente.id}`);

  const conteggi = await conteggiMembri([classeId]);
  return {
    ...classe.toPublicJSON(),
    conteggio: conteggi.get(classeId) || { insegnanti: 0, studenti: 0 },
  };
};

// ─────────────────────────────────────────────
// ELIMINA AULA (cascade: rimuove le iscrizioni)
// ─────────────────────────────────────────────
const eliminaClasse = async ({ classeId, richiedente }) => {
  const classe = await caricaClasse(classeId);
  await assicuraAccessoInsegnante(classeId, richiedente);

  await classe.destroy(); // ON DELETE CASCADE su classe_utenti
  logger.info(`[AULA] Eliminata aula ${classeId} da utente ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// AGGIUNGI MEMBRO GIÀ REGISTRATO (studente o insegnante)
// ─────────────────────────────────────────────
const aggiungiMembro = async ({ classeId, riferimento, ruoloNellaClasse, richiedente }) => {
  return sequelize.transaction(async (t) => {
    await caricaClasse(classeId, { transaction: t });
    await assicuraAccessoInsegnante(classeId, richiedente, t);

    const ruoloGlobaleAtteso = ruoloNellaClasse === 'insegnante' ? 'insegnante' : 'studente';
    const utente = await risolviUtenteRegistrato(riferimento, ruoloGlobaleAtteso, t);

    const esistente = await ClasseUtente.findOne({
      where: { classe_id: classeId, utente_id: utente.id },
      transaction: t,
    });
    if (esistente) {
      throw new AppError("L'utente fa già parte di questa aula.", 409, 'ALREADY_MEMBER');
    }

    await ClasseUtente.create(
      {
        classe_id: classeId,
        utente_id: utente.id,
        ruolo_nella_classe: ruoloNellaClasse,
        aggiunto_da: richiedente.id,
      },
      { transaction: t }
    );

    logger.info(
      `[AULA] Aggiunto ${ruoloNellaClasse} ${utente.id} all'aula ${classeId} da ${richiedente.id}`
    );

    return {
      id: utente.id,
      nome: utente.nome,
      cognome: utente.cognome,
      email: utente.email,
      ruoloNellaClasse,
    };
  });
};

// ─────────────────────────────────────────────
// RIMUOVI MEMBRO
// Impedisce di lasciare l'aula senza insegnanti.
// ─────────────────────────────────────────────
const rimuoviMembro = async ({ classeId, utenteId, ruoloNellaClasse, richiedente }) => {
  return sequelize.transaction(async (t) => {
    await caricaClasse(classeId, { transaction: t });
    await assicuraAccessoInsegnante(classeId, richiedente, t);

    const membership = await ClasseUtente.findOne({
      where: {
        classe_id: classeId,
        utente_id: utenteId,
        ruolo_nella_classe: ruoloNellaClasse,
      },
      transaction: t,
    });
    if (!membership) {
      throw new AppError('Membro non trovato in questa aula.', 404, 'MEMBER_NOT_FOUND');
    }

    // Un'aula deve avere sempre almeno un insegnante.
    if (ruoloNellaClasse === 'insegnante') {
      const numInsegnanti = await ClasseUtente.count({
        where: { classe_id: classeId, ruolo_nella_classe: 'insegnante' },
        transaction: t,
      });
      if (numInsegnanti <= 1) {
        throw new AppError(
          "Impossibile rimuovere l'ultimo insegnante dell'aula.",
          409,
          'LAST_TEACHER'
        );
      }
    }

    await membership.destroy({ transaction: t });
    logger.info(
      `[AULA] Rimosso ${ruoloNellaClasse} ${utenteId} dall'aula ${classeId} da ${richiedente.id}`
    );
  });
};

// ─────────────────────────────────────────────
// INVITA STUDENTE VIA EMAIL NELL'AULA
// Delega la creazione dell'invito (token + email) all'InviteService, legandolo
// all'aula: al completamento della registrazione lo studente vi verrà iscritto.
// ─────────────────────────────────────────────
const invitaStudente = async ({ classeId, email, richiedente, lingua }) => {
  const classe = await caricaClasse(classeId);
  await assicuraAccessoInsegnante(classeId, richiedente);

  const { invito, tokenDebug } = await inviteService.creaInvitoStudenteInClasse({
    email,
    classeId,
    nomeClasse: classe.nome,
    invitatoDa: richiedente.id,
    lingua,
  });

  logger.info(`[AULA] Invitato studente ${email} nell'aula ${classeId} da ${richiedente.id}`);

  return { invito: invito.toPublicJSON(), tokenDebug };
};

module.exports = {
  creaClasse,
  elencoClassi,
  dettaglioClasse,
  aggiornaClasse,
  eliminaClasse,
  aggiungiMembro,
  rimuoviMembro,
  invitaStudente,
};
