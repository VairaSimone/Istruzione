'use strict';

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Corso = require('../models/Corso');
const Capitolo = require('../models/Capitolo');
const DocumentoCapitolo = require('../models/DocumentoCapitolo');
const CorsoAula = require('../models/CorsoAula');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const { assicuraStessaScuola, risolviScuolaCreazione } = require('../utils/tenant');
const logger = require('../utils/logger');

/**
 * CorsiService — logica di dominio delle VIDEOLEZIONI ON-DEMAND (corsi).
 *
 *   CRUD corsi · capitoli · documenti allegati · disponibilità presso le aule ·
 *   viste studente (elenco/dettaglio dei corsi disponibili)
 *
 * Regole di accesso applicate qui (difesa a livello service, oltre al gate di
 * ruolo nelle route):
 *   - un insegnante gestisce i corsi della PROPRIA scuola (il corso è un asset
 *     della scuola: qualunque insegnante della scuola può curarne il catalogo);
 *     l'admin è trasversale su tutte le scuole;
 *   - un corso può essere reso disponibile SOLO ad aule della STESSA scuola e,
 *     per l'insegnante, solo ad aule in cui insegna;
 *   - lo studente vede/guarda solo i corsi PUBBLICATI resi disponibili a
 *     un'aula di cui è membro-studente.
 *
 * ISOLAMENTO TRA SCUOLE: essendo la disponibilità vincolata alla stessa scuola
 * e le viste studente derivate dalle sue aule, un corso non è mai raggiungibile
 * da studenti di scuole diverse dalla propria.
 *
 * Tutte le query evitano N+1: i conteggi capitoli sono ottenuti con un'unica
 * query aggregata e i capitoli/documenti con una sola join, mai in loop.
 */

// Numero massimo di capitoli creabili inline alla creazione del corso. Per
// cataloghi ampi si usano gli endpoint granulari (aggiunta capitolo per capitolo),
// così da non superare il limite di dimensione del payload JSON.
const MAX_CAPITOLI_INLINE = 20;

// ─────────────────────────────────────────────
// Helpers: caricamento e autorizzazione
// ─────────────────────────────────────────────

/** Carica il corso o lancia 404. */
const caricaCorso = async (corsoId, opzioni = {}) => {
  const corso = await Corso.findByPk(corsoId, opzioni);
  if (!corso) {
    throw new AppError('Corso non trovato.', 404, 'CORSO_NOT_FOUND');
  }
  return corso;
};

/**
 * Verifica che il richiedente possa gestire il corso: admin sempre, altrimenti
 * deve appartenere alla STESSA scuola del corso. Lancia 403 in caso contrario.
 */
const assicuraGestioneCorso = (corso, richiedente) => {
  assicuraStessaScuola(
    richiedente,
    corso.scuola_id,
    'Questo corso non appartiene alla tua scuola.'
  );
};

/**
 * Carica un capitolo garantendo che appartenga al corso indicato (evita di
 * operare su un capitolo di un altro corso passando un id arbitrario).
 */
const caricaCapitolo = async (corsoId, capitoloId, opzioni = {}) => {
  const capitolo = await Capitolo.findByPk(capitoloId, opzioni);
  if (!capitolo || String(capitolo.corso_id) !== String(corsoId)) {
    throw new AppError('Capitolo non trovato.', 404, 'CAPITOLO_NOT_FOUND');
  }
  return capitolo;
};

/**
 * Carica un documento garantendo che appartenga al capitolo indicato.
 */
const caricaDocumento = async (capitoloId, documentoId, opzioni = {}) => {
  const documento = await DocumentoCapitolo.findByPk(documentoId, opzioni);
  if (!documento || String(documento.capitolo_id) !== String(capitoloId)) {
    throw new AppError('Documento non trovato.', 404, 'DOCUMENTO_NOT_FOUND');
  }
  return documento;
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

/** Id delle aule di cui lo studente è membro-studente. */
const idAuleStudente = async (studenteId, transaction) => {
  const righe = await ClasseUtente.findAll({
    where: { utente_id: studenteId, ruolo_nella_classe: 'studente' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  return righe.map((r) => r.classe_id);
};

/**
 * Conta i capitoli per un insieme di corsi con UNA sola query aggregata
 * (niente N+1). Restituisce una mappa corsoId → numeroCapitoli.
 */
const conteggiCapitoli = async (corsoIds) => {
  const mappa = new Map();
  if (!corsoIds.length) return mappa;

  const righe = await Capitolo.findAll({
    where: { corso_id: { [Op.in]: corsoIds } },
    attributes: ['corso_id', [fn('COUNT', col('id')), 'totale']],
    group: ['corso_id'],
    raw: true,
  });

  for (const r of righe) {
    mappa.set(r.corso_id, parseInt(r.totale, 10));
  }
  return mappa;
};

/**
 * Carica i capitoli di un corso con i relativi documenti in un'unica query
 * (una join), ordinati per `ordine` e poi per data di creazione.
 *
 * @param {string} corsoId
 * @param {boolean} defaultScaricabile  policy download predefinita del corso
 * @param {boolean} perStudente  se true, aggiunge `scaricabileEffettivo` e
 *   omette l'override grezzo `scaricabile` (dettaglio interno allo staff).
 */
const caricaCapitoliConDocumenti = async (corsoId, defaultScaricabile, perStudente) => {
  const capitoli = await Capitolo.findAll({
    where: { corso_id: corsoId },
    include: [{ model: DocumentoCapitolo, as: 'documenti' }],
    order: [
      ['ordine', 'ASC'],
      ['created_at', 'ASC'],
      [{ model: DocumentoCapitolo, as: 'documenti' }, 'ordine', 'ASC'],
      [{ model: DocumentoCapitolo, as: 'documenti' }, 'created_at', 'ASC'],
    ],
  });

  return capitoli.map((cap) => {
    const documenti = (cap.documenti || []).map((d) => d.toPublicJSON());
    const base = cap.toPublicJSON();
    if (perStudente) {
      // Allo studente esponiamo la policy EFFETTIVA (booleano risolto), non
      // l'override grezzo (che potrebbe essere null = "eredita").
      const { scaricabile, ...senzaOverride } = base;
      return {
        ...senzaOverride,
        scaricabileEffettivo: cap.scaricabileEffettivo(defaultScaricabile),
        documenti,
      };
    }
    return {
      ...base,
      scaricabileEffettivo: cap.scaricabileEffettivo(defaultScaricabile),
      documenti,
    };
  });
};

// ─────────────────────────────────────────────
// STAFF — CREA CORSO (con capitoli inline facoltativi)
// ─────────────────────────────────────────────
const creaCorso = async ({ dati, capitoli, richiedente }) => {
  // Scuola del corso: timbrata dalla scuola dell'insegnante; l'admin, che non
  // appartiene ad alcuna scuola, deve indicarla esplicitamente (scuolaId).
  const scuolaId = risolviScuolaCreazione(richiedente, dati.scuolaId, {
    scuolaObbligatoriaPerAdmin: true,
  });

  const capitoliInput = Array.isArray(capitoli) ? capitoli : [];
  if (capitoliInput.length > MAX_CAPITOLI_INLINE) {
    throw new AppError(
      `Puoi creare al massimo ${MAX_CAPITOLI_INLINE} capitoli in fase di creazione. Aggiungi gli altri singolarmente.`,
      422,
      'TOO_MANY_CAPITOLI'
    );
  }

  const corso = await sequelize.transaction(async (t) => {
    const nuovo = await Corso.create(
      {
        titolo: dati.titolo.trim(),
        descrizione: dati.descrizione ?? null,
        copertina_url: dati.copertinaUrl ?? null,
        livello_jlpt: dati.livelloJLPT ?? null,
        stato: dati.stato ?? 'bozza',
        video_scaricabile: dati.videoScaricabile ?? false,
        scuola_id: scuolaId,
        creato_da: richiedente.id,
      },
      { transaction: t }
    );

    // Capitoli inline (con eventuali documenti), preservando l'ordine indicato.
    for (let i = 0; i < capitoliInput.length; i += 1) {
      const c = capitoliInput[i];
      const capitolo = await Capitolo.create(
        {
          corso_id: nuovo.id,
          titolo: c.titolo.trim(),
          descrizione: c.descrizione ?? null,
          video_url: c.videoUrl ?? null,
          video_durata_secondi: c.videoDurataSecondi ?? null,
          scaricabile: c.scaricabile === undefined ? null : c.scaricabile,
          ordine: c.ordine ?? i,
        },
        { transaction: t }
      );

      const documenti = Array.isArray(c.documenti) ? c.documenti : [];
      for (let j = 0; j < documenti.length; j += 1) {
        const d = documenti[j];
        await DocumentoCapitolo.create(
          {
            capitolo_id: capitolo.id,
            titolo: d.titolo.trim(),
            url: d.url.trim(),
            ordine: d.ordine ?? j,
          },
          { transaction: t }
        );
      }
    }

    return nuovo;
  });

  logger.info(`[CORSO] Creato corso ${corso.id} "${corso.titolo}" da utente ${richiedente.id}`);

  const capitoliCompleti = await caricaCapitoliConDocumenti(
    corso.id,
    corso.video_scaricabile,
    false
  );

  return {
    ...corso.toPublicJSON(),
    conteggioCapitoli: capitoliCompleti.length,
    capitoli: capitoliCompleti,
    auleDisponibili: [],
  };
};

// ─────────────────────────────────────────────
// STAFF — ELENCO CORSI (della propria scuola, con conteggio capitoli)
// ─────────────────────────────────────────────
const elencoCorsi = async ({ richiedente, filtri }) => {
  const { stato, livello, q, scuola, page, limit } = filtri;
  const where = {};

  // Scope tenant: l'insegnante vede SOLO i corsi della propria scuola.
  if (richiedente.ruolo !== 'admin') {
    if (!richiedente.scuola_id) {
      // Account non associato ad alcuna scuola: nessun corso.
      return { corsi: [], paginazione: null };
    }
    where.scuola_id = richiedente.scuola_id;
  } else if (scuola) {
    // Admin: filtro facoltativo per scuola.
    where.scuola_id = scuola;
  }

  if (stato) where.stato = stato;
  if (livello) where.livello_jlpt = livello;
  if (q) {
    where.titolo = { [Op.like]: `%${escapeLike(q.trim())}%` };
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
    const risultato = await Corso.findAndCountAll(queryOptions);
    righe = risultato.rows;
    totale = risultato.count;
  } else {
    righe = await Corso.findAll(queryOptions);
  }

  // Conteggio capitoli in un'unica query aggregata (niente N+1).
  const conteggi = await conteggiCapitoli(righe.map((c) => c.id));

  const corsi = righe.map((c) => ({
    ...c.toPublicJSON(),
    conteggioCapitoli: conteggi.get(c.id) || 0,
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { corsi, paginazione };
};

// ─────────────────────────────────────────────
// STAFF — DETTAGLIO CORSO (capitoli + documenti + aule disponibili)
// ─────────────────────────────────────────────
const dettaglioCorso = async ({ corsoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  const capitoli = await caricaCapitoliConDocumenti(corsoId, corso.video_scaricabile, false);

  // Aule a cui il corso è reso disponibile (una join).
  const disponibilita = await CorsoAula.findAll({
    where: { corso_id: corsoId },
    include: [{ model: Classe, as: 'classe', attributes: ['id', 'nome', 'anno_scolastico', 'livello_jlpt'] }],
    order: [['created_at', 'ASC']],
  });

  const auleDisponibili = disponibilita
    .filter((d) => d.classe)
    .map((d) => ({
      classeId: d.classe.id,
      nome: d.classe.nome,
      annoScolastico: d.classe.anno_scolastico,
      livelloJLPT: d.classe.livello_jlpt,
      resaDisponibileIl: d.created_at,
    }));

  return {
    ...corso.toPublicJSON(),
    conteggioCapitoli: capitoli.length,
    capitoli,
    auleDisponibili,
  };
};

// ─────────────────────────────────────────────
// STAFF — AGGIORNA CORSO
// ─────────────────────────────────────────────
const aggiornaCorso = async ({ corsoId, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  if (dati.titolo !== undefined) corso.titolo = dati.titolo.trim();
  if (dati.descrizione !== undefined) corso.descrizione = dati.descrizione;
  if (dati.copertinaUrl !== undefined) corso.copertina_url = dati.copertinaUrl;
  if (dati.livelloJLPT !== undefined) corso.livello_jlpt = dati.livelloJLPT;
  if (dati.stato !== undefined) corso.stato = dati.stato;
  if (dati.videoScaricabile !== undefined) corso.video_scaricabile = dati.videoScaricabile;

  await corso.save();
  logger.info(`[CORSO] Aggiornato corso ${corsoId} da utente ${richiedente.id}`);

  const conteggi = await conteggiCapitoli([corsoId]);
  return {
    ...corso.toPublicJSON(),
    conteggioCapitoli: conteggi.get(corsoId) || 0,
  };
};

// ─────────────────────────────────────────────
// STAFF — ELIMINA CORSO (cascade: capitoli, documenti, disponibilità)
// ─────────────────────────────────────────────
const eliminaCorso = async ({ corsoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  await corso.destroy(); // ON DELETE CASCADE su capitoli/corso_aule (e documenti)
  logger.info(`[CORSO] Eliminato corso ${corsoId} da utente ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// STAFF — AGGIUNGI CAPITOLO
// ─────────────────────────────────────────────
const aggiungiCapitolo = async ({ corsoId, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  // Se l'ordine non è indicato, accoda in fondo (max ordine corrente + 1).
  let ordine = dati.ordine;
  if (ordine === undefined || ordine === null) {
    const maxOrdine = await Capitolo.max('ordine', { where: { corso_id: corsoId } });
    ordine = Number.isFinite(maxOrdine) ? maxOrdine + 1 : 0;
  }

  const capitolo = await Capitolo.create({
    corso_id: corsoId,
    titolo: dati.titolo.trim(),
    descrizione: dati.descrizione ?? null,
    video_url: dati.videoUrl ?? null,
    video_durata_secondi: dati.videoDurataSecondi ?? null,
    scaricabile: dati.scaricabile === undefined ? null : dati.scaricabile,
    ordine,
  });

  logger.info(`[CORSO] Aggiunto capitolo ${capitolo.id} al corso ${corsoId} da ${richiedente.id}`);

  return {
    ...capitolo.toPublicJSON(),
    scaricabileEffettivo: capitolo.scaricabileEffettivo(corso.video_scaricabile),
    documenti: [],
  };
};

// ─────────────────────────────────────────────
// STAFF — AGGIORNA CAPITOLO
// ─────────────────────────────────────────────
const aggiornaCapitolo = async ({ corsoId, capitoloId, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  const capitolo = await caricaCapitolo(corsoId, capitoloId);

  if (dati.titolo !== undefined) capitolo.titolo = dati.titolo.trim();
  if (dati.descrizione !== undefined) capitolo.descrizione = dati.descrizione;
  if (dati.videoUrl !== undefined) capitolo.video_url = dati.videoUrl;
  if (dati.videoDurataSecondi !== undefined) capitolo.video_durata_secondi = dati.videoDurataSecondi;
  if (dati.scaricabile !== undefined) capitolo.scaricabile = dati.scaricabile;
  if (dati.ordine !== undefined) capitolo.ordine = dati.ordine;

  await capitolo.save();
  logger.info(`[CORSO] Aggiornato capitolo ${capitoloId} del corso ${corsoId} da ${richiedente.id}`);

  const documenti = await DocumentoCapitolo.findAll({
    where: { capitolo_id: capitoloId },
    order: [['ordine', 'ASC'], ['created_at', 'ASC']],
  });

  return {
    ...capitolo.toPublicJSON(),
    scaricabileEffettivo: capitolo.scaricabileEffettivo(corso.video_scaricabile),
    documenti: documenti.map((d) => d.toPublicJSON()),
  };
};

// ─────────────────────────────────────────────
// STAFF — ELIMINA CAPITOLO (cascade: documenti)
// ─────────────────────────────────────────────
const eliminaCapitolo = async ({ corsoId, capitoloId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  const capitolo = await caricaCapitolo(corsoId, capitoloId);

  await capitolo.destroy(); // ON DELETE CASCADE su documenti_capitolo
  logger.info(`[CORSO] Eliminato capitolo ${capitoloId} del corso ${corsoId} da ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// STAFF — AGGIUNGI DOCUMENTO A UN CAPITOLO
// ─────────────────────────────────────────────
const aggiungiDocumento = async ({ corsoId, capitoloId, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  await caricaCapitolo(corsoId, capitoloId);

  let ordine = dati.ordine;
  if (ordine === undefined || ordine === null) {
    const maxOrdine = await DocumentoCapitolo.max('ordine', { where: { capitolo_id: capitoloId } });
    ordine = Number.isFinite(maxOrdine) ? maxOrdine + 1 : 0;
  }

  const documento = await DocumentoCapitolo.create({
    capitolo_id: capitoloId,
    titolo: dati.titolo.trim(),
    url: dati.url.trim(),
    ordine,
  });

  logger.info(
    `[CORSO] Aggiunto documento ${documento.id} al capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`
  );

  return documento.toPublicJSON();
};

// ─────────────────────────────────────────────
// STAFF — ELIMINA DOCUMENTO
// ─────────────────────────────────────────────
const eliminaDocumento = async ({ corsoId, capitoloId, documentoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  await caricaCapitolo(corsoId, capitoloId);
  const documento = await caricaDocumento(capitoloId, documentoId);

  await documento.destroy();
  logger.info(
    `[CORSO] Eliminato documento ${documentoId} dal capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`
  );
};

// ─────────────────────────────────────────────
// STAFF — RENDI DISPONIBILE UN CORSO A UN'AULA
// Vincolo di isolamento: l'aula deve appartenere alla STESSA scuola del corso.
// ─────────────────────────────────────────────
const rendiDisponibile = async ({ corsoId, classeId, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const corso = await caricaCorso(corsoId, { transaction: t });
    assicuraGestioneCorso(corso, richiedente);

    const classe = await Classe.findByPk(classeId, { transaction: t });
    if (!classe) {
      throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
    }

    // ISOLAMENTO TRA SCUOLE: corso e aula devono appartenere alla stessa scuola.
    // Impedisce di rendere un corso visibile ad aule (e quindi studenti) di
    // un'altra scuola.
    if (String(corso.scuola_id) !== String(classe.scuola_id)) {
      throw new AppError(
        "Il corso e l'aula devono appartenere alla stessa scuola.",
        403,
        'CROSS_SCUOLA_FORBIDDEN'
      );
    }

    // L'insegnante può rendere disponibile un corso solo alle aule in cui insegna
    // (l'admin è trasversale).
    if (!(await insegnaNellaClasse(classeId, richiedente, t))) {
      throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
    }

    const [disponibilita, creata] = await CorsoAula.findOrCreate({
      where: { corso_id: corsoId, classe_id: classeId },
      defaults: {
        corso_id: corsoId,
        classe_id: classeId,
        reso_disponibile_da: richiedente.id,
      },
      transaction: t,
    });

    if (!creata) {
      throw new AppError('Il corso è già disponibile per questa aula.', 409, 'ALREADY_AVAILABLE');
    }

    logger.info(
      `[CORSO] Corso ${corsoId} reso disponibile all'aula ${classeId} da ${richiedente.id}`
    );

    return {
      classeId: classe.id,
      nome: classe.nome,
      annoScolastico: classe.anno_scolastico,
      livelloJLPT: classe.livello_jlpt,
      resaDisponibileIl: disponibilita.created_at,
    };
  });
};

// ─────────────────────────────────────────────
// STAFF — REVOCA LA DISPONIBILITÀ DI UN CORSO PRESSO UN'AULA
// ─────────────────────────────────────────────
const revocaDisponibilita = async ({ corsoId, classeId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  const disponibilita = await CorsoAula.findOne({
    where: { corso_id: corsoId, classe_id: classeId },
  });
  if (!disponibilita) {
    throw new AppError('Il corso non è disponibile per questa aula.', 404, 'AVAILABILITY_NOT_FOUND');
  }

  await disponibilita.destroy();
  logger.info(
    `[CORSO] Revocata la disponibilità del corso ${corsoId} all'aula ${classeId} da ${richiedente.id}`
  );
};

// ─────────────────────────────────────────────
// STUDENTE — id dei corsi PUBBLICATI disponibili tramite le sue aule
// ─────────────────────────────────────────────
const idCorsiDisponibiliStudente = async (studenteId, transaction) => {
  const classeIds = await idAuleStudente(studenteId, transaction);
  if (!classeIds.length) return [];

  const righe = await CorsoAula.findAll({
    where: { classe_id: { [Op.in]: classeIds } },
    attributes: ['corso_id'],
    raw: true,
    transaction,
  });
  return [...new Set(righe.map((r) => r.corso_id))];
};

// ─────────────────────────────────────────────
// STUDENTE — ELENCO CORSI DISPONIBILI (pubblicati, delle sue aule)
// ─────────────────────────────────────────────
const elencoCorsiStudente = async ({ studente, filtri }) => {
  const corsoIds = await idCorsiDisponibiliStudente(studente.id);
  if (!corsoIds.length) return { corsi: [], paginazione: null };

  const { livello, q, page, limit } = filtri;
  const where = { id: { [Op.in]: corsoIds }, stato: 'pubblicato' };
  if (livello) where.livello_jlpt = livello;
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
    const risultato = await Corso.findAndCountAll(queryOptions);
    righe = risultato.rows;
    totale = risultato.count;
  } else {
    righe = await Corso.findAll(queryOptions);
  }

  const conteggi = await conteggiCapitoli(righe.map((c) => c.id));

  // Allo studente non serve la scuola_id/autore; esponiamo i campi utili alla
  // vista catalogo.
  const corsi = righe.map((c) => ({
    id: c.id,
    titolo: c.titolo,
    descrizione: c.descrizione,
    copertinaUrl: c.copertina_url,
    livelloJLPT: c.livello_jlpt,
    conteggioCapitoli: conteggi.get(c.id) || 0,
    created_at: c.created_at,
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { corsi, paginazione };
};

// ─────────────────────────────────────────────
// STUDENTE — DETTAGLIO CORSO (deve essergli disponibile e pubblicato)
// Espone i capitoli con video, documenti e policy di download EFFETTIVA.
// ─────────────────────────────────────────────
const dettaglioCorsoStudente = async ({ corsoId, studente }) => {
  const corsoIds = await idCorsiDisponibiliStudente(studente.id);
  if (!corsoIds.map(String).includes(String(corsoId))) {
    throw new AppError('Corso non trovato.', 404, 'CORSO_NOT_FOUND');
  }

  const corso = await Corso.findOne({ where: { id: corsoId, stato: 'pubblicato' } });
  if (!corso) {
    throw new AppError('Corso non trovato.', 404, 'CORSO_NOT_FOUND');
  }

  const capitoli = await caricaCapitoliConDocumenti(corsoId, corso.video_scaricabile, true);

  return {
    id: corso.id,
    titolo: corso.titolo,
    descrizione: corso.descrizione,
    copertinaUrl: corso.copertina_url,
    livelloJLPT: corso.livello_jlpt,
    conteggioCapitoli: capitoli.length,
    capitoli,
    created_at: corso.created_at,
  };
};

module.exports = {
  creaCorso,
  elencoCorsi,
  dettaglioCorso,
  aggiornaCorso,
  eliminaCorso,
  aggiungiCapitolo,
  aggiornaCapitolo,
  eliminaCapitolo,
  aggiungiDocumento,
  eliminaDocumento,
  rendiDisponibile,
  revocaDisponibilita,
  elencoCorsiStudente,
  dettaglioCorsoStudente,
};
