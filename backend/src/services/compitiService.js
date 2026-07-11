'use strict';

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Compito = require('../models/Compito');
const CompitoAssegnazione = require('../models/CompitoAssegnazione');
const CompitoConsegna = require('../models/CompitoConsegna');
const ClasseUtente = require('../models/ClasseUtente');
const Classe = require('../models/Classe');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const { assicuraStessaScuola, risolviScuolaCreazione } = require('../utils/tenant');
const logger = require('../utils/logger');
const tipiAttivita = require('../constants/tipiAttivita');
const notificheService = require('./notificheService');

/**
 * CompitiService — logica di dominio dei COMPITI.
 *
 *   CRUD compiti · assegnazione (aula/studente) · consegne · valutazione ·
 *   viste studente (assegnati / completati / in scadenza / scaduti)
 *
 * Regole di accesso applicate qui:
 *   - un insegnante gestisce SOLO i compiti che ha creato (admin: tutti);
 *   - può assegnare solo alle proprie aule o a studenti delle proprie aule;
 *   - lo studente vede/consegna solo i compiti pubblicati a lui destinati
 *     (direttamente o tramite un'aula di cui è membro).
 */

// Finestra entro cui un compito non ancora svolto è considerato "in scadenza".
const SOGLIA_IN_SCADENZA_ORE = 72;
const SOGLIA_IN_SCADENZA_MS = SOGLIA_IN_SCADENZA_ORE * 60 * 60 * 1000;

const ATTRIBUTI_STUDENTE = ['id', 'nome', 'cognome', 'email'];

// ─────────────────────────────────────────────
// Helpers: caricamento e autorizzazione
// ─────────────────────────────────────────────

const caricaCompito = async (compitoId, opzioni = {}) => {
  const compito = await Compito.findByPk(compitoId, opzioni);
  if (!compito) {
    throw new AppError('Compito non trovato.', 404, 'COMPITO_NOT_FOUND');
  }
  return compito;
};

/** L'insegnante gestisce solo i propri compiti; l'admin tutti. */
const assicuraProprietaCompito = (compito, richiedente) => {
  if (richiedente.ruolo === 'admin') return;
  if (String(compito.creato_da) !== String(richiedente.id)) {
    throw new AppError('Non hai accesso a questo compito.', 403, 'FORBIDDEN');
  }
};

/** True se il richiedente è insegnante dell'aula (o admin). */
const insegnaNellaClasse = async (classeId, richiedente, transaction) => {
  if (richiedente.ruolo === 'admin') return true;
  const m = await ClasseUtente.findOne({
    where: { classe_id: classeId, utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    transaction,
  });
  return !!m;
};

/** Insieme (Set) degli id aula in cui il richiedente è insegnante. */
const idAuleInsegnate = async (richiedente, transaction) => {
  const righe = await ClasseUtente.findAll({
    where: { utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  return righe.map((r) => r.classe_id);
};

/** True se il richiedente condivide almeno un'aula (come insegnante) con lo studente. */
const condivideClasseConStudente = async (utenteId, richiedente, transaction) => {
  if (richiedente.ruolo === 'admin') return true;
  const idAule = await idAuleInsegnate(richiedente, transaction);
  if (!idAule.length) return false;
  const m = await ClasseUtente.findOne({
    where: {
      classe_id: { [Op.in]: idAule },
      utente_id: utenteId,
      ruolo_nella_classe: 'studente',
    },
    transaction,
  });
  return !!m;
};

/**
 * Stato del compito PER STUDENTE, derivato (mai memorizzato):
 *   completato · scaduto · in_scadenza · assegnato
 */
const statoPerStudente = (compito, consegna, ora = Date.now()) => {
  if (consegna) return 'completato';
  const scad = new Date(compito.data_scadenza).getTime();
  if (scad < ora) return 'scaduto';
  if (scad - ora <= SOGLIA_IN_SCADENZA_MS) return 'in_scadenza';
  return 'assegnato';
};

/**
 * Risolve l'insieme DISTINTO degli id studente destinatari di un compito:
 * studenti delle aule assegnate (membership corrente) ∪ studenti diretti.
 * Poche query aggregate, nessun N+1.
 */
const risolviDestinatari = async (compitoId, transaction) => {
  const assegnazioni = await CompitoAssegnazione.findAll({
    where: { compito_id: compitoId },
    attributes: ['classe_id', 'utente_id'],
    raw: true,
    transaction,
  });

  const classeIds = assegnazioni.filter((a) => a.classe_id).map((a) => a.classe_id);
  const direttiIds = assegnazioni.filter((a) => a.utente_id).map((a) => a.utente_id);

  const studentIds = new Set(direttiIds);

  if (classeIds.length) {
    const membri = await ClasseUtente.findAll({
      where: { classe_id: { [Op.in]: classeIds }, ruolo_nella_classe: 'studente' },
      attributes: ['utente_id'],
      raw: true,
      transaction,
    });
    for (const m of membri) studentIds.add(m.utente_id);
  }

  return { studentIds, classeIds, direttiIds };
};

/**
 * Accoda le notifiche `nuovo_compito` ai destinatari indicati, per un compito
 * PUBBLICATO. Best effort e idempotente (una sola notifica per compito+studente
 * grazie a `unicaPerRiferimento`): può quindi essere invocato più volte per lo
 * stesso compito (pubblicazione, nuove assegnazioni) senza generare duplicati.
 * Va chiamato FUORI da transazioni: non deve mai far fallire l'operazione.
 */
const notificaNuovoCompito = async (compito, studentIds) => {
  if (!compito || compito.stato !== 'pubblicato') return;
  const ids = [...studentIds];
  if (!ids.length) return;

  const scadenza = (() => {
    try {
      return new Date(compito.data_scadenza).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  })();

  for (const utenteId of ids) {
    await notificheService.accodaNotifica({
      utenteId,
      tipo: 'nuovo_compito',
      titolo: compito.titolo,
      corpo: scadenza ? `Scadenza: ${scadenza}` : null,
      link: `/studente/compiti/${compito.id}`,
      scuolaId: compito.scuola_id ?? null,
      riferimentoTipo: 'compito',
      riferimentoId: compito.id,
      unicaPerRiferimento: true,
    });
  }
};

/** Valida la coppia (classeId|utenteId): esattamente uno dei due. */
const normalizzaBersaglio = ({ classeId, utenteId }) => {
  if (Boolean(classeId) === Boolean(utenteId)) {
    throw new AppError(
      'Specificare esattamente uno tra classeId e utenteId.',
      422,
      'INVALID_ASSIGNMENT_TARGET'
    );
  }
  return { classeId: classeId || null, utenteId: utenteId || null };
};

/**
 * Applica una singola assegnazione (aula o studente) con autorizzazione e
 * idempotenza. Usata sia in creazione (inline) sia dall'endpoint dedicato.
 */
const applicaAssegnazione = async ({ compitoId, bersaglio, richiedente, transaction }) => {
  const { classeId, utenteId } = normalizzaBersaglio(bersaglio);

  if (classeId) {
    const classe = await Classe.findByPk(classeId, { transaction });
    if (!classe) throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
    // Confine di tenant: l'aula deve appartenere alla scuola del richiedente
    // (l'admin è trasversale). Difesa in profondità oltre al controllo di membership.
    assicuraStessaScuola(richiedente, classe.scuola_id, 'Questa aula non appartiene alla tua scuola.');
    if (!(await insegnaNellaClasse(classeId, richiedente, transaction))) {
      throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
    }
  } else {
    const studente = await Utente.findByPk(utenteId, { transaction });
    if (!studente || studente.ruolo !== 'studente') {
      throw new AppError('Studente non trovato.', 404, 'USER_NOT_FOUND');
    }
    // Confine di tenant: lo studente deve essere della scuola del richiedente.
    assicuraStessaScuola(richiedente, studente.scuola_id, 'Questo studente non appartiene alla tua scuola.');
    if (!(await condivideClasseConStudente(utenteId, richiedente, transaction))) {
      throw new AppError(
        'Puoi assegnare solo a studenti delle tue aule.',
        403,
        'FORBIDDEN'
      );
    }
  }

  const [assegnazione, creata] = await CompitoAssegnazione.findOrCreate({
    where: {
      compito_id: compitoId,
      classe_id: classeId,
      utente_id: utenteId,
    },
    defaults: {
      compito_id: compitoId,
      classe_id: classeId,
      utente_id: utenteId,
      assegnato_da: richiedente.id,
    },
    transaction,
  });

  if (!creata) {
    throw new AppError('Questo destinatario è già assegnato al compito.', 409, 'ALREADY_ASSIGNED');
  }

  return assegnazione;
};

// ─────────────────────────────────────────────
// INSEGNANTE — CREA COMPITO (con assegnazioni facoltative inline)
// ─────────────────────────────────────────────
const creaCompito = async ({ dati, assegnazioni, richiedente }) => {
  // Scuola del compito: timbrata dalla scuola dell'insegnante (null per l'admin,
  // trasversale). Rende esplicito il tenant di appartenenza del compito.
  const scuolaId = risolviScuolaCreazione(richiedente, null, {
    scuolaObbligatoriaPerAdmin: false,
  });

  // Normalizza il tipo di attività contro il registro: traduce gli alias
  // storici (quiz_kana → quiz, tracciamento → pratica_scrittura) e rifiuta i
  // codici sconosciuti. Poi verifica che la configurazione porti le chiavi
  // obbligatorie del tipo (es. `quizId` per il tipo `quiz`).
  const tipoAttivita = tipiAttivita.normalizza(dati.tipoAttivita);
  tipiAttivita.validaConfigurazione(tipoAttivita, dati.configurazione);

  return sequelize.transaction(async (t) => {
    const compito = await Compito.create(
      {
        titolo: dati.titolo.trim(),
        descrizione: dati.descrizione ?? null,
        tipo_attivita: tipoAttivita,
        configurazione: dati.configurazione ?? null,
        data_scadenza: dati.dataScadenza,
        tempo_limite_minuti: dati.tempoLimiteMinuti ?? null,
        punteggio_massimo: dati.punteggioMassimo ?? 100,
        stato: dati.stato ?? 'bozza',
        scuola_id: scuolaId,
        creato_da: richiedente.id,
      },
      { transaction: t }
    );

    const assegnazioniCreate = [];
    if (Array.isArray(assegnazioni)) {
      for (const bersaglio of assegnazioni) {
        const a = await applicaAssegnazione({
          compitoId: compito.id,
          bersaglio,
          richiedente,
          transaction: t,
        });
        assegnazioniCreate.push(a.toPublicJSON());
      }
    }

    logger.info(`[COMPITO] Creato compito ${compito.id} "${compito.titolo}" da ${richiedente.id}`);

    // Se il compito nasce già PUBBLICATO con assegnazioni, prepara i destinatari
    // per la notifica (accodata fuori transazione).
    let destinatari = null;
    if (compito.stato === 'pubblicato' && assegnazioniCreate.length) {
      const { studentIds } = await risolviDestinatari(compito.id, t);
      destinatari = studentIds;
    }

    return { compito, assegnazioniCreate, destinatari };
  }).then(async ({ compito, assegnazioniCreate, destinatari }) => {
    if (destinatari) await notificaNuovoCompito(compito, destinatari);
    return { ...compito.toPublicJSON(), assegnazioni: assegnazioniCreate };
  });
};

// ─────────────────────────────────────────────
// INSEGNANTE — ELENCO COMPITI (con conteggi assegnazioni/consegne)
// ─────────────────────────────────────────────
const elencoCompiti = async ({ richiedente, filtri }) => {
  const { stato, tipo, q, page, limit } = filtri;
  const where = {};

  if (richiedente.ruolo !== 'admin') {
    where.creato_da = richiedente.id;
  }
  if (stato) where.stato = stato;
  if (tipo) where.tipo_attivita = tipiAttivita.normalizza(tipo);
  if (q) where.titolo = { [Op.like]: `%${escapeLike(q.trim())}%` };

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = { where, order: [['created_at', 'DESC']] };
  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPaginazione) {
    const r = await Compito.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await Compito.findAll(queryOptions);
  }

  const ids = righe.map((c) => c.id);

  // Conteggi in due sole query aggregate (niente N+1).
  const mappaAssegn = new Map(); // compito_id → { classi, studenti }
  const mappaConsegne = new Map(); // compito_id → completati
  if (ids.length) {
    const assegnRows = await CompitoAssegnazione.findAll({
      where: { compito_id: { [Op.in]: ids } },
      attributes: ['compito_id', 'classe_id', 'utente_id'],
      raw: true,
    });
    for (const a of assegnRows) {
      const cur = mappaAssegn.get(a.compito_id) || { classi: 0, studenti: 0 };
      if (a.classe_id) cur.classi += 1;
      else cur.studenti += 1;
      mappaAssegn.set(a.compito_id, cur);
    }

    const consegneRows = await CompitoConsegna.findAll({
      where: { compito_id: { [Op.in]: ids } },
      attributes: ['compito_id', [fn('COUNT', col('id')), 'totale']],
      group: ['compito_id'],
      raw: true,
    });
    for (const r of consegneRows) {
      mappaConsegne.set(r.compito_id, parseInt(r.totale, 10));
    }
  }

  const compiti = righe.map((c) => ({
    ...c.toPublicJSON(),
    assegnazioni: mappaAssegn.get(c.id) || { classi: 0, studenti: 0 },
    completati: mappaConsegne.get(c.id) || 0,
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { compiti, paginazione };
};

// ─────────────────────────────────────────────
// INSEGNANTE — DETTAGLIO COMPITO (destinatari + statistiche di completamento)
// ─────────────────────────────────────────────
const dettaglioCompito = async ({ compitoId, richiedente }) => {
  const compito = await caricaCompito(compitoId);
  assicuraProprietaCompito(compito, richiedente);

  const assegnazioni = await CompitoAssegnazione.findAll({
    where: { compito_id: compitoId },
    include: [
      { model: Classe, as: 'classe', attributes: ['id', 'nome'] },
      { model: Utente, as: 'studente', attributes: ATTRIBUTI_STUDENTE },
    ],
    order: [['created_at', 'ASC']],
  });

  const { studentIds } = await risolviDestinatari(compitoId);
  const numeroDestinatari = studentIds.size;
  const completati = await CompitoConsegna.count({ where: { compito_id: compitoId } });

  return {
    ...compito.toPublicJSON(),
    assegnazioni: assegnazioni.map((a) => ({
      id: a.id,
      tipo: a.classe_id ? 'classe' : 'studente',
      classe: a.classe ? { id: a.classe.id, nome: a.classe.nome } : null,
      studente: a.studente
        ? {
            id: a.studente.id,
            nome: a.studente.nome,
            cognome: a.studente.cognome,
            email: a.studente.email,
          }
        : null,
      created_at: a.created_at,
    })),
    statistiche: {
      destinatari: numeroDestinatari,
      completati,
      nonCompletati: Math.max(0, numeroDestinatari - completati),
      percentualeCompletamento:
        numeroDestinatari > 0 ? Math.round((completati / numeroDestinatari) * 100) : 0,
    },
  };
};

// ─────────────────────────────────────────────
// INSEGNANTE — AGGIORNA COMPITO
// ─────────────────────────────────────────────
const aggiornaCompito = async ({ compitoId, dati, richiedente }) => {
  const compito = await caricaCompito(compitoId);
  assicuraProprietaCompito(compito, richiedente);

  // Rileva la TRANSIZIONE a "pubblicato" per notificare i destinatari una sola
  // volta (la prima pubblicazione).
  const eraPubblicato = compito.stato === 'pubblicato';

  if (dati.titolo !== undefined) compito.titolo = dati.titolo.trim();
  if (dati.descrizione !== undefined) compito.descrizione = dati.descrizione;
  if (dati.tipoAttivita !== undefined) {
    compito.tipo_attivita = tipiAttivita.normalizza(dati.tipoAttivita);
  }
  if (dati.configurazione !== undefined) compito.configurazione = dati.configurazione;
  // Rivalida la coerenza tipo ↔ configurazione dopo l'applicazione dei campi.
  tipiAttivita.validaConfigurazione(compito.tipo_attivita, compito.configurazione);
  if (dati.dataScadenza !== undefined) compito.data_scadenza = dati.dataScadenza;
  if (dati.tempoLimiteMinuti !== undefined) compito.tempo_limite_minuti = dati.tempoLimiteMinuti;
  if (dati.punteggioMassimo !== undefined) compito.punteggio_massimo = dati.punteggioMassimo;
  if (dati.stato !== undefined) compito.stato = dati.stato;

  await compito.save();
  logger.info(`[COMPITO] Aggiornato compito ${compitoId} da ${richiedente.id}`);

  // Notifica alla PRIMA pubblicazione (bozza/archiviato → pubblicato).
  if (!eraPubblicato && compito.stato === 'pubblicato') {
    const { studentIds } = await risolviDestinatari(compito.id);
    await notificaNuovoCompito(compito, studentIds);
  }

  return compito.toPublicJSON();
};

// ─────────────────────────────────────────────
// INSEGNANTE — ELIMINA COMPITO (cascade: assegnazioni + consegne)
// ─────────────────────────────────────────────
const eliminaCompito = async ({ compitoId, richiedente }) => {
  const compito = await caricaCompito(compitoId);
  assicuraProprietaCompito(compito, richiedente);
  await compito.destroy();
  logger.info(`[COMPITO] Eliminato compito ${compitoId} da ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// INSEGNANTE — AGGIUNGI ASSEGNAZIONE
// ─────────────────────────────────────────────
const aggiungiAssegnazione = async ({ compitoId, bersaglio, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const compito = await caricaCompito(compitoId, { transaction: t });
    assicuraProprietaCompito(compito, richiedente);

    const assegnazione = await applicaAssegnazione({
      compitoId,
      bersaglio,
      richiedente,
      transaction: t,
    });

    logger.info(`[COMPITO] Assegnazione ${assegnazione.id} aggiunta al compito ${compitoId}`);

    // Se il compito è GIÀ pubblicato, i nuovi destinatari vanno avvisati. Grazie
    // all'idempotenza (unicaPerRiferimento) i destinatari già notificati in
    // precedenza non ricevono un duplicato.
    let destinatari = null;
    if (compito.stato === 'pubblicato') {
      const { studentIds } = await risolviDestinatari(compitoId, t);
      destinatari = studentIds;
    }

    return { assegnazione, compito, destinatari };
  }).then(async ({ assegnazione, compito, destinatari }) => {
    if (destinatari) await notificaNuovoCompito(compito, destinatari);
    return assegnazione.toPublicJSON();
  });
};

// ─────────────────────────────────────────────
// INSEGNANTE — RIMUOVI ASSEGNAZIONE
// ─────────────────────────────────────────────
const rimuoviAssegnazione = async ({ compitoId, assegnazioneId, richiedente }) => {
  const compito = await caricaCompito(compitoId);
  assicuraProprietaCompito(compito, richiedente);

  const assegnazione = await CompitoAssegnazione.findOne({
    where: { id: assegnazioneId, compito_id: compitoId },
  });
  if (!assegnazione) {
    throw new AppError('Assegnazione non trovata.', 404, 'ASSIGNMENT_NOT_FOUND');
  }

  await assegnazione.destroy();
  logger.info(`[COMPITO] Assegnazione ${assegnazioneId} rimossa dal compito ${compitoId}`);
};

// ─────────────────────────────────────────────
// INSEGNANTE — ELENCO CONSEGNE (stato per ogni studente destinatario)
// ─────────────────────────────────────────────
const elencoConsegne = async ({ compitoId, richiedente }) => {
  const compito = await caricaCompito(compitoId);
  assicuraProprietaCompito(compito, richiedente);

  const { studentIds } = await risolviDestinatari(compitoId);
  const ids = [...studentIds];
  if (!ids.length) return { compito: compito.toPublicJSON(), consegne: [] };

  // Anagrafica + consegne in due sole query.
  const [studenti, consegne] = await Promise.all([
    Utente.findAll({ where: { id: { [Op.in]: ids } }, attributes: ATTRIBUTI_STUDENTE }),
    CompitoConsegna.findAll({ where: { compito_id: compitoId, utente_id: { [Op.in]: ids } } }),
  ]);

  const mappaConsegne = new Map(consegne.map((c) => [String(c.utente_id), c]));
  const ora = Date.now();

  const righe = studenti
    .map((s) => {
      const consegna = mappaConsegne.get(String(s.id)) || null;
      return {
        studente: { id: s.id, nome: s.nome, cognome: s.cognome, email: s.email },
        stato: statoPerStudente(compito, consegna, ora),
        consegna: consegna ? consegna.toPublicJSON() : null,
      };
    })
    .sort((a, b) =>
      (a.studente.cognome || '').localeCompare(b.studente.cognome || '', 'it')
    );

  return { compito: compito.toPublicJSON(), consegne: righe };
};

// ─────────────────────────────────────────────
// INSEGNANTE — VALUTA CONSEGNA (punteggio + feedback)
// ─────────────────────────────────────────────
const valutaConsegna = async ({ compitoId, utenteId, dati, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const compito = await caricaCompito(compitoId, { transaction: t });
    assicuraProprietaCompito(compito, richiedente);

    const consegna = await CompitoConsegna.findOne({
      where: { compito_id: compitoId, utente_id: utenteId },
      transaction: t,
    });
    if (!consegna) {
      throw new AppError(
        'Lo studente non ha ancora consegnato questo compito.',
        404,
        'DELIVERY_NOT_FOUND'
      );
    }

    if (dati.punteggioOttenuto !== undefined) {
      if (dati.punteggioOttenuto > compito.punteggio_massimo) {
        throw new AppError(
          `Il punteggio non può superare il massimo del compito (${compito.punteggio_massimo}).`,
          422,
          'SCORE_OUT_OF_RANGE'
        );
      }
      consegna.punteggio_ottenuto = dati.punteggioOttenuto;
    }
    if (dati.feedback !== undefined) consegna.feedback = dati.feedback;

    consegna.stato = 'valutato';
    consegna.valutato_da = richiedente.id;
    await consegna.save({ transaction: t });

    logger.info(`[COMPITO] Consegna del compito ${compitoId} valutata per studente ${utenteId}`);
    return consegna.toPublicJSON();
  });
};

// ─────────────────────────────────────────────
// STUDENTE — id dei compiti pubblicati a lui destinati (helper condiviso)
// ─────────────────────────────────────────────
const idCompitiDestinati = async (studenteId, transaction) => {
  const classi = await ClasseUtente.findAll({
    where: { utente_id: studenteId, ruolo_nella_classe: 'studente' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  const classeIds = classi.map((c) => c.classe_id);

  const orConds = [{ utente_id: studenteId }];
  if (classeIds.length) orConds.push({ classe_id: { [Op.in]: classeIds } });

  const assegn = await CompitoAssegnazione.findAll({
    where: { [Op.or]: orConds },
    attributes: ['compito_id'],
    raw: true,
    transaction,
  });
  return [...new Set(assegn.map((a) => a.compito_id))];
};

// ─────────────────────────────────────────────
// STUDENTE — ELENCO COMPITI (filtro per stato derivato)
//   stato ∈ assegnato | completato | in_scadenza | scaduto (facoltativo)
// ─────────────────────────────────────────────
const elencoCompitiStudente = async ({ studente, filtri }) => {
  const compitoIds = await idCompitiDestinati(studente.id);
  if (!compitoIds.length) return { compiti: [], paginazione: null };

  // Solo compiti pubblicati.
  const compiti = await Compito.findAll({
    where: { id: { [Op.in]: compitoIds }, stato: 'pubblicato' },
    order: [['data_scadenza', 'ASC']],
  });
  if (!compiti.length) return { compiti: [], paginazione: null };

  // Consegne dello studente per questi compiti (una query).
  const consegne = await CompitoConsegna.findAll({
    where: { compito_id: { [Op.in]: compiti.map((c) => c.id) }, utente_id: studente.id },
  });
  const mappaConsegne = new Map(consegne.map((c) => [String(c.compito_id), c]));

  const ora = Date.now();
  let lista = compiti.map((c) => {
    const consegna = mappaConsegne.get(String(c.id)) || null;
    return {
      ...c.toPublicJSON(),
      statoStudente: statoPerStudente(c, consegna, ora),
      consegna: consegna ? consegna.toPublicJSON() : null,
    };
  });

  // Filtro per stato derivato (fatto in memoria: lo stato non è persistito).
  if (filtri.stato) {
    lista = lista.filter((c) => c.statoStudente === filtri.stato);
  }

  // Paginazione in memoria (i compiti per singolo studente sono in numero
  // limitato; lo stato derivato non è filtrabile a livello SQL).
  const pageNum = parseInt(filtri.page, 10);
  const limitNum = parseInt(filtri.limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  if (!usaPaginazione) return { compiti: lista, paginazione: null };

  const totale = lista.length;
  const start = (pageNum - 1) * limitNum;
  return {
    compiti: lista.slice(start, start + limitNum),
    paginazione: {
      paginaCorrente: pageNum,
      elementiPerPagina: limitNum,
      totaleElementi: totale,
      totalePagine: Math.ceil(totale / limitNum),
    },
  };
};

// ─────────────────────────────────────────────
// STUDENTE — DETTAGLIO COMPITO (deve essergli destinato e pubblicato)
// ─────────────────────────────────────────────
const dettaglioCompitoStudente = async ({ compitoId, studente }) => {
  const compitoIds = await idCompitiDestinati(studente.id);
  if (!compitoIds.map(String).includes(String(compitoId))) {
    throw new AppError('Compito non trovato.', 404, 'COMPITO_NOT_FOUND');
  }

  const compito = await Compito.findOne({ where: { id: compitoId, stato: 'pubblicato' } });
  if (!compito) throw new AppError('Compito non trovato.', 404, 'COMPITO_NOT_FOUND');

  const consegna = await CompitoConsegna.findOne({
    where: { compito_id: compitoId, utente_id: studente.id },
  });

  return {
    ...compito.toPublicJSON(),
    statoStudente: statoPerStudente(compito, consegna),
    consegna: consegna ? consegna.toPublicJSON() : null,
  };
};

// ─────────────────────────────────────────────
// STUDENTE — CONSEGNA COMPITO (upsert idempotente)
// ─────────────────────────────────────────────
const consegnaCompito = async ({ compitoId, studente, dati }) => {
  return sequelize.transaction(async (t) => {
    const compitoIds = await idCompitiDestinati(studente.id, t);
    if (!compitoIds.map(String).includes(String(compitoId))) {
      throw new AppError('Compito non trovato.', 404, 'COMPITO_NOT_FOUND');
    }

    const compito = await Compito.findOne({
      where: { id: compitoId, stato: 'pubblicato' },
      transaction: t,
    });
    if (!compito) throw new AppError('Compito non trovato.', 404, 'COMPITO_NOT_FOUND');

    // Valida il punteggio rispetto al massimo del compito.
    if (dati.punteggioOttenuto !== undefined && dati.punteggioOttenuto > compito.punteggio_massimo) {
      throw new AppError(
        `Il punteggio non può superare il massimo del compito (${compito.punteggio_massimo}).`,
        422,
        'SCORE_OUT_OF_RANGE'
      );
    }

    const ora = new Date();
    const inRitardo = ora.getTime() > new Date(compito.data_scadenza).getTime();
    const oltreTempo =
      compito.tempo_limite_minuti != null &&
      dati.tempoImpiegatoSecondi != null &&
      dati.tempoImpiegatoSecondi > compito.tempo_limite_minuti * 60;

    const [consegna, creata] = await CompitoConsegna.findOrCreate({
      where: { compito_id: compitoId, utente_id: studente.id },
      defaults: {
        compito_id: compitoId,
        utente_id: studente.id,
        stato: 'completato',
        punteggio_ottenuto: dati.punteggioOttenuto ?? null,
        tempo_impiegato_secondi: dati.tempoImpiegatoSecondi ?? null,
        oltre_tempo_limite: oltreTempo,
        in_ritardo: inRitardo,
        data_completamento: ora,
      },
      transaction: t,
    });

    // Ri-consegna: aggiorna i valori mantenendo l'eventuale feedback docente.
    if (!creata) {
      consegna.punteggio_ottenuto = dati.punteggioOttenuto ?? consegna.punteggio_ottenuto;
      consegna.tempo_impiegato_secondi =
        dati.tempoImpiegatoSecondi ?? consegna.tempo_impiegato_secondi;
      consegna.oltre_tempo_limite = oltreTempo;
      consegna.in_ritardo = inRitardo;
      consegna.data_completamento = ora;
      // Se era già stato valutato, una nuova consegna torna "completato".
      consegna.stato = 'completato';
      await consegna.save({ transaction: t });
    }

    logger.info(
      `[COMPITO] Consegna ${creata ? 'creata' : 'aggiornata'} per compito ${compitoId} da studente ${studente.id}`
    );
    return consegna.toPublicJSON();
  });
};

module.exports = {
  creaCompito,
  elencoCompiti,
  dettaglioCompito,
  aggiornaCompito,
  eliminaCompito,
  aggiungiAssegnazione,
  rimuoviAssegnazione,
  elencoConsegne,
  valutaConsegna,
  elencoCompitiStudente,
  dettaglioCompitoStudente,
  consegnaCompito,
  SOGLIA_IN_SCADENZA_ORE,
  // Riusati dal CalendarioService per comporre il feed senza duplicare la
  // logica di derivazione dei compiti destinati a uno studente né il calcolo
  // dello stato per-studente.
  idCompitiDestinati,
  statoPerStudente,
};
