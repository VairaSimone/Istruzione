'use strict';

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Corso = require('../models/Corso');
const Capitolo = require('../models/Capitolo');
const DocumentoCapitolo = require('../models/DocumentoCapitolo');
const CorsoAula = require('../models/CorsoAula');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const FileCaricato = require('../models/FileCaricato');
const fileService = require('./fileService');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const impostazioniService = require('./impostazioniService');
const { assicuraStessaScuola, risolviScuolaCreazione } = require('../utils/tenant');
const logger = require('../utils/logger');

/**
 * CorsiService — logica di dominio delle VIDEOLEZIONI ON-DEMAND (corsi).
 *
 *   CRUD corsi · capitoli · SOTTO-CAPITOLI (stile Udemy) · documenti allegati ·
 *   UPLOAD DI FILE (video/copertine/documenti caricati dal PC) · disponibilità
 *   presso le aule · viste studente (elenco/dettaglio dei corsi disponibili)
 *
 * NOVITÀ rispetto alla prima versione:
 *   - i contenuti multimediali possono essere CARICATI come file dal PC
 *     (video del capitolo, copertina del corso, documenti allegati) oltre che,
 *     in alternativa, referenziati via URL esterno. I file risiedono su disco
 *     (cfr. fileService) e i loro binari vengono ripuliti quando l'entità che
 *     li usa viene eliminata o il media sostituito;
 *   - i capitoli sono organizzati su DUE LIVELLI: sezioni (capitolo senza padre)
 *     e sotto-capitoli (con `capitolo_padre_id`). La profondità è limitata a 1.
 *
 * Regole di accesso applicate qui (difesa a livello service, oltre al gate di
 * ruolo nelle route):
 *   - un insegnante gestisce i corsi della PROPRIA scuola; l'admin è trasversale;
 *   - un corso è reso disponibile SOLO ad aule della STESSA scuola e, per
 *     l'insegnante, solo ad aule in cui insegna;
 *   - lo studente vede/guarda solo i corsi PUBBLICATI resi disponibili a
 *     un'aula di cui è membro-studente.
 */

// Numero massimo di capitoli (sezioni + sotto-capitoli) creabili inline alla
// creazione del corso. Per cataloghi ampi si usano gli endpoint granulari.
const MAX_CAPITOLI_INLINE = 40;

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
 * Conta i capitoli (sezioni + sotto-capitoli) per un insieme di corsi con UNA
 * sola query aggregata (niente N+1). Restituisce una mappa corsoId → totale.
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
 * Trasforma un'istanza Capitolo (con include videoFile + documenti.file) nel
 * DTO pubblico, aggiungendo la policy di download EFFETTIVA e i descrittori dei
 * file caricati. Non include ancora i sotto-capitoli (aggiunti dall'albero).
 */
const mappaCapitolo = (cap, defaultScaricabile, perStudente) => {
  const documenti = (cap.documenti || []).map((d) => ({
    ...d.toPublicJSON(),
    file: d.file ? d.file.toPublicJSON() : null,
  }));
  const videoFile = cap.videoFile ? cap.videoFile.toPublicJSON() : null;
  const base = cap.toPublicJSON();

  if (perStudente) {
    // Allo studente esponiamo la policy EFFETTIVA (booleano risolto), non
    // l'override grezzo (che potrebbe essere null = "eredita").
    const { scaricabile, ...senzaOverride } = base;
    return {
      ...senzaOverride,
      videoFile,
      scaricabileEffettivo: cap.scaricabileEffettivo(defaultScaricabile),
      documenti,
    };
  }
  return {
    ...base,
    videoFile,
    scaricabileEffettivo: cap.scaricabileEffettivo(defaultScaricabile),
    documenti,
  };
};

/**
 * Carica i capitoli di un corso con video (file), documenti (e relativi file) in
 * un'unica query, e li restituisce come ALBERO a due livelli: array di sezioni
 * (capitoli di primo livello) ciascuna con `sottoCapitoli`. Ordinamento per
 * `ordine` poi `created_at`, sia tra le sezioni sia tra i sotto-capitoli.
 *
 * @param {string} corsoId
 * @param {boolean} defaultScaricabile  policy download predefinita del corso
 * @param {boolean} perStudente
 */
const caricaCapitoliConDocumenti = async (corsoId, defaultScaricabile, perStudente) => {
  const capitoli = await Capitolo.findAll({
    where: { corso_id: corsoId },
    include: [
      {
        model: DocumentoCapitolo,
        as: 'documenti',
        include: [{ model: FileCaricato, as: 'file' }],
      },
      { model: FileCaricato, as: 'videoFile' },
    ],
    order: [
      ['ordine', 'ASC'],
      ['created_at', 'ASC'],
      [{ model: DocumentoCapitolo, as: 'documenti' }, 'ordine', 'ASC'],
      [{ model: DocumentoCapitolo, as: 'documenti' }, 'created_at', 'ASC'],
    ],
  });

  // Bucket dei figli per padre (l'ordine ASC della query è preservato).
  const figliPerPadre = new Map();
  const radici = [];
  for (const cap of capitoli) {
    if (cap.capitolo_padre_id) {
      const chiave = String(cap.capitolo_padre_id);
      if (!figliPerPadre.has(chiave)) figliPerPadre.set(chiave, []);
      figliPerPadre.get(chiave).push(cap);
    } else {
      radici.push(cap);
    }
  }

  return radici.map((r) => {
    const nodo = mappaCapitolo(r, defaultScaricabile, perStudente);
    const figli = figliPerPadre.get(String(r.id)) || [];
    nodo.sottoCapitoli = figli.map((f) => mappaCapitolo(f, defaultScaricabile, perStudente));
    return nodo;
  });
};

// ─────────────────────────────────────────────
// Helpers: pulizia dei file su disco
// ─────────────────────────────────────────────

/** Raccoglie gli id di TUTTI i file (copertina + video + documenti) di un corso. */
const raccogliFileIdsDelCorso = async (corsoId, transaction) => {
  const ids = new Set();

  const corso = await Corso.findByPk(corsoId, {
    attributes: ['id', 'copertina_file_id'],
    transaction,
  });
  if (corso && corso.copertina_file_id) ids.add(corso.copertina_file_id);

  const capitoli = await Capitolo.findAll({
    where: { corso_id: corsoId },
    attributes: ['id', 'video_file_id'],
    raw: true,
    transaction,
  });
  const capitoloIds = capitoli.map((c) => c.id);
  capitoli.forEach((c) => c.video_file_id && ids.add(c.video_file_id));

  if (capitoloIds.length) {
    const docs = await DocumentoCapitolo.findAll({
      where: { capitolo_id: { [Op.in]: capitoloIds } },
      attributes: ['file_id'],
      raw: true,
      transaction,
    });
    docs.forEach((d) => d.file_id && ids.add(d.file_id));
  }
  return [...ids];
};

/**
 * Raccoglie gli id dei file di un capitolo E dei suoi sotto-capitoli
 * (video + documenti). Usato prima di eliminare una sezione (cascade).
 */
const raccogliFileIdsDelCapitolo = async (capitoloId, transaction) => {
  const ids = new Set();

  // Il capitolo stesso + i suoi eventuali sotto-capitoli.
  const capitoli = await Capitolo.findAll({
    where: { [Op.or]: [{ id: capitoloId }, { capitolo_padre_id: capitoloId }] },
    attributes: ['id', 'video_file_id'],
    raw: true,
    transaction,
  });
  const tuttiIds = capitoli.map((c) => c.id);
  capitoli.forEach((c) => c.video_file_id && ids.add(c.video_file_id));

  if (tuttiIds.length) {
    const docs = await DocumentoCapitolo.findAll({
      where: { capitolo_id: { [Op.in]: tuttiIds } },
      attributes: ['file_id'],
      raw: true,
      transaction,
    });
    docs.forEach((d) => d.file_id && ids.add(d.file_id));
  }
  return [...ids];
};

/** Elimina (best-effort) una lista di file: binario su disco + riga DB. */
const eliminaFilesPerId = async (fileIds) => {
  for (const id of fileIds) {
    try {
      await fileService.eliminaFileCaricato(id);
    } catch (err) {
      logger.warn(`[CORSO] Pulizia file ${id} non riuscita: ${err.message}`);
    }
  }
};

// ─────────────────────────────────────────────
// Helper: valida/risolve il padre di un sotto-capitolo (profondità max 1)
// ─────────────────────────────────────────────
const risolviPadre = async (corsoId, capitoloPadreId, transaction) => {
  if (capitoloPadreId === undefined || capitoloPadreId === null) return null;

  const padre = await Capitolo.findByPk(capitoloPadreId, { transaction });
  if (!padre || String(padre.corso_id) !== String(corsoId)) {
    throw new AppError('Il capitolo padre indicato non esiste in questo corso.', 404, 'CAPITOLO_PADRE_NOT_FOUND');
  }
  // Profondità massima = 1: il padre deve essere una sezione di primo livello.
  if (padre.capitolo_padre_id) {
    throw new AppError(
      'Un sotto-capitolo non può contenere altri sotto-capitoli.',
      422,
      'SOTTOCAPITOLO_DEPTH_EXCEEDED'
    );
  }
  return padre;
};

// ─────────────────────────────────────────────
// STAFF — CREA CORSO (con capitoli/sotto-capitoli inline facoltativi)
// ─────────────────────────────────────────────
const creaCorso = async ({ dati, capitoli, richiedente }) => {
  const scuolaId = risolviScuolaCreazione(richiedente, dati.scuolaId, {
    scuolaObbligatoriaPerAdmin: true,
  });

  const capitoliInput = Array.isArray(capitoli) ? capitoli : [];
  // Conteggio totale (sezioni + sotto-capitoli) per limitare il payload.
  const totaleInline = capitoliInput.reduce(
    (acc, c) => acc + 1 + (Array.isArray(c.sottoCapitoli) ? c.sottoCapitoli.length : 0),
    0
  );
  if (totaleInline > MAX_CAPITOLI_INLINE) {
    throw new AppError(
      `Puoi creare al massimo ${MAX_CAPITOLI_INLINE} capitoli (sezioni + sotto-capitoli) in fase di creazione. Aggiungi gli altri singolarmente.`,
      422,
      'TOO_MANY_CAPITOLI'
    );
  }

  // Livello e materia sono testo libero, ma se la scuola ha definito i propri
  // vocabolari (`impostazioni.didattica`) i valori devono appartenervi.
  const livelloNorm = await impostazioniService.assicuraNelVocabolario(
    scuolaId,
    'livelliDisponibili',
    dati.livello,
    'Il livello del corso'
  );
  const materiaNorm = await impostazioniService.assicuraNelVocabolario(
    scuolaId,
    'materieDisponibili',
    dati.materia,
    'La materia del corso'
  );

  const corso = await sequelize.transaction(async (t) => {
    const nuovo = await Corso.create(
      {
        titolo: dati.titolo.trim(),
        descrizione: dati.descrizione ?? null,
        copertina_url: dati.copertinaUrl ?? null,
        materia: materiaNorm,
        livello: livelloNorm,
        stato: dati.stato ?? 'bozza',
        video_scaricabile: dati.videoScaricabile ?? false,
        scuola_id: scuolaId,
        creato_da: richiedente.id,
      },
      { transaction: t }
    );

    // Crea un capitolo inline (con eventuali documenti url-only).
    const creaCapitoloInline = async (c, ordineDefault, padreId) => {
      const capitolo = await Capitolo.create(
        {
          corso_id: nuovo.id,
          capitolo_padre_id: padreId ?? null,
          titolo: c.titolo.trim(),
          descrizione: c.descrizione ?? null,
          video_url: c.videoUrl ?? null,
          video_durata_secondi: c.videoDurataSecondi ?? null,
          scaricabile: c.scaricabile === undefined ? null : c.scaricabile,
          ordine: c.ordine ?? ordineDefault,
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
            file_id: null,
            ordine: d.ordine ?? j,
          },
          { transaction: t }
        );
      }
      return capitolo;
    };

    for (let i = 0; i < capitoliInput.length; i += 1) {
      const c = capitoliInput[i];
      const sezione = await creaCapitoloInline(c, i, null);

      const sotto = Array.isArray(c.sottoCapitoli) ? c.sottoCapitoli : [];
      for (let k = 0; k < sotto.length; k += 1) {
        await creaCapitoloInline(sotto[k], k, sezione.id);
      }
    }

    return nuovo;
  });

  logger.info(`[CORSO] Creato corso ${corso.id} "${corso.titolo}" da utente ${richiedente.id}`);

  const capitoliCompleti = await caricaCapitoliConDocumenti(corso.id, corso.video_scaricabile, false);
  const conteggi = await conteggiCapitoli([corso.id]);

  return {
    ...corso.toPublicJSON(),
    conteggioCapitoli: conteggi.get(corso.id) || 0,
    capitoli: capitoliCompleti,
    auleDisponibili: [],
  };
};

// ─────────────────────────────────────────────
// STAFF — ELENCO CORSI (della propria scuola, con conteggio capitoli)
// ─────────────────────────────────────────────
const elencoCorsi = async ({ richiedente, filtri }) => {
  const { stato, livello, materia, q, scuola, page, limit } = filtri;
  const where = {};

  if (richiedente.ruolo !== 'admin') {
    if (!richiedente.scuola_id) {
      return { corsi: [], paginazione: null };
    }
    where.scuola_id = richiedente.scuola_id;
  } else if (scuola) {
    where.scuola_id = scuola;
  }

  if (stato) where.stato = stato;
  if (livello) where.livello = livello;
  if (materia) where.materia = materia;
  if (q) {
    where.titolo = { [Op.like]: `%${escapeLike(q.trim())}%` };
  }

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
// STAFF — DETTAGLIO CORSO (capitoli + sotto-capitoli + documenti + aule)
// ─────────────────────────────────────────────
const dettaglioCorso = async ({ corsoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  const capitoli = await caricaCapitoliConDocumenti(corsoId, corso.video_scaricabile, false);

  const disponibilita = await CorsoAula.findAll({
    where: { corso_id: corsoId },
    include: [{ model: Classe, as: 'classe', attributes: ['id', 'nome', 'anno_scolastico', 'livello'] }],
    order: [['created_at', 'ASC']],
  });

  const auleDisponibili = disponibilita
    .filter((d) => d.classe)
    .map((d) => ({
      classeId: d.classe.id,
      nome: d.classe.nome,
      annoScolastico: d.classe.anno_scolastico,
      livello: d.classe.livello,
      resaDisponibileIl: d.created_at,
    }));

  const conteggi = await conteggiCapitoli([corsoId]);

  return {
    ...corso.toPublicJSON(),
    conteggioCapitoli: conteggi.get(corsoId) || 0,
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
  if (dati.livello !== undefined) {
    corso.livello = await impostazioniService.assicuraNelVocabolario(
      corso.scuola_id,
      'livelliDisponibili',
      dati.livello,
      'Il livello del corso'
    );
  }
  if (dati.materia !== undefined) {
    corso.materia = await impostazioniService.assicuraNelVocabolario(
      corso.scuola_id,
      'materieDisponibili',
      dati.materia,
      'La materia del corso'
    );
  }
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
// STAFF — ELIMINA CORSO (cascade: capitoli, documenti, disponibilità + file)
// ─────────────────────────────────────────────
const eliminaCorso = async ({ corsoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  // Raccogli i file PRIMA della cancellazione (dopo le righe non ci sono più).
  const fileIds = await raccogliFileIdsDelCorso(corsoId);

  await corso.destroy(); // ON DELETE CASCADE su capitoli/corso_aule (e documenti)
  await eliminaFilesPerId(fileIds);

  logger.info(`[CORSO] Eliminato corso ${corsoId} da utente ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// STAFF — AGGIUNGI CAPITOLO (sezione o sotto-capitolo)
// ─────────────────────────────────────────────
const aggiungiCapitolo = async ({ corsoId, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  const padre = await risolviPadre(corsoId, dati.capitoloPadreId, undefined);
  const padreId = padre ? padre.id : null;

  // Ordine: accoda in fondo tra i pari grado (stessa sezione, o primo livello).
  let ordine = dati.ordine;
  if (ordine === undefined || ordine === null) {
    const maxOrdine = await Capitolo.max('ordine', {
      where: { corso_id: corsoId, capitolo_padre_id: padreId },
    });
    ordine = Number.isFinite(maxOrdine) ? maxOrdine + 1 : 0;
  }

  const capitolo = await Capitolo.create({
    corso_id: corsoId,
    capitolo_padre_id: padreId,
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
    videoFile: null,
    scaricabileEffettivo: capitolo.scaricabileEffettivo(corso.video_scaricabile),
    documenti: [],
    sottoCapitoli: [],
  };
};

// ─────────────────────────────────────────────
// STAFF — AGGIORNA CAPITOLO (inclusa la ri-parentela con guardrail)
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

  // Ri-parentela (spostamento tra sezioni o promozione a sezione).
  if (dati.capitoloPadreId !== undefined) {
    const nuovoPadreId = dati.capitoloPadreId;
    if (nuovoPadreId && String(nuovoPadreId) === String(capitoloId)) {
      throw new AppError('Un capitolo non può essere padre di se stesso.', 422, 'CAPITOLO_PADRE_INVALID');
    }
    if (nuovoPadreId) {
      // Un capitolo che HA già sotto-capitoli non può diventare sotto-capitolo.
      const numFigli = await Capitolo.count({ where: { capitolo_padre_id: capitoloId } });
      if (numFigli > 0) {
        throw new AppError(
          'Questo capitolo ha dei sotto-capitoli e non può diventare a sua volta un sotto-capitolo.',
          422,
          'CAPITOLO_HAS_CHILDREN'
        );
      }
      const padre = await risolviPadre(corsoId, nuovoPadreId, undefined);
      capitolo.capitolo_padre_id = padre.id;
    } else {
      capitolo.capitolo_padre_id = null;
    }
  }

  await capitolo.save();
  logger.info(`[CORSO] Aggiornato capitolo ${capitoloId} del corso ${corsoId} da ${richiedente.id}`);

  const ricaricato = await Capitolo.findByPk(capitoloId, {
    include: [
      { model: DocumentoCapitolo, as: 'documenti', include: [{ model: FileCaricato, as: 'file' }] },
      { model: FileCaricato, as: 'videoFile' },
    ],
    order: [[{ model: DocumentoCapitolo, as: 'documenti' }, 'ordine', 'ASC']],
  });

  return mappaCapitolo(ricaricato, corso.video_scaricabile, false);
};

// ─────────────────────────────────────────────
// STAFF — ELIMINA CAPITOLO (cascade: sotto-capitoli, documenti + file)
// ─────────────────────────────────────────────
const eliminaCapitolo = async ({ corsoId, capitoloId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  const capitolo = await caricaCapitolo(corsoId, capitoloId);

  const fileIds = await raccogliFileIdsDelCapitolo(capitoloId);

  await capitolo.destroy(); // ON DELETE CASCADE su sotto-capitoli e documenti
  await eliminaFilesPerId(fileIds);

  logger.info(`[CORSO] Eliminato capitolo ${capitoloId} del corso ${corsoId} da ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// STAFF — CARICA/SOSTITUISCI IL VIDEO DI UN CAPITOLO (file dal PC)
// ─────────────────────────────────────────────
const impostaVideoCapitolo = async ({ corsoId, capitoloId, file, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  const capitolo = await caricaCapitolo(corsoId, capitoloId);

  const vecchioFileId = capitolo.video_file_id;

  const nuovoFile = await fileService.persistiFile({ tipo: 'video', file, richiedente });

  capitolo.video_file_id = nuovoFile.id;
  // Il file caricato prevale sull'eventuale URL esterno precedente.
  capitolo.video_url = null;
  if (dati && dati.videoDurataSecondi !== undefined && dati.videoDurataSecondi !== null) {
    capitolo.video_durata_secondi = dati.videoDurataSecondi;
  }
  await capitolo.save();

  // Rimuovi il vecchio file (ora non più referenziato).
  if (vecchioFileId && String(vecchioFileId) !== String(nuovoFile.id)) {
    await eliminaFilesPerId([vecchioFileId]);
  }

  logger.info(`[CORSO] Video caricato per capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`);

  const ricaricato = await Capitolo.findByPk(capitoloId, {
    include: [
      { model: DocumentoCapitolo, as: 'documenti', include: [{ model: FileCaricato, as: 'file' }] },
      { model: FileCaricato, as: 'videoFile' },
    ],
  });
  return mappaCapitolo(ricaricato, corso.video_scaricabile, false);
};

// ─────────────────────────────────────────────
// STAFF — RIMUOVI IL VIDEO (file) DI UN CAPITOLO
// ─────────────────────────────────────────────
const rimuoviVideoCapitolo = async ({ corsoId, capitoloId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  const capitolo = await caricaCapitolo(corsoId, capitoloId);

  const fileId = capitolo.video_file_id;
  if (!fileId) {
    throw new AppError('Questo capitolo non ha un video caricato.', 404, 'VIDEO_NOT_FOUND');
  }

  capitolo.video_file_id = null;
  await capitolo.save();
  await eliminaFilesPerId([fileId]);

  logger.info(`[CORSO] Video rimosso dal capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// STAFF — CARICA/SOSTITUISCI LA COPERTINA DEL CORSO (file dal PC)
// ─────────────────────────────────────────────
const impostaCopertina = async ({ corsoId, file, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  const vecchioFileId = corso.copertina_file_id;
  const nuovoFile = await fileService.persistiFile({ tipo: 'immagine', file, richiedente });

  corso.copertina_file_id = nuovoFile.id;
  corso.copertina_url = null; // il file prevale sull'URL esterno
  await corso.save();

  if (vecchioFileId && String(vecchioFileId) !== String(nuovoFile.id)) {
    await eliminaFilesPerId([vecchioFileId]);
  }

  logger.info(`[CORSO] Copertina caricata per corso ${corsoId} da ${richiedente.id}`);

  const conteggi = await conteggiCapitoli([corsoId]);
  return {
    ...corso.toPublicJSON(),
    conteggioCapitoli: conteggi.get(corsoId) || 0,
  };
};

// ─────────────────────────────────────────────
// STAFF — RIMUOVI LA COPERTINA (file) DEL CORSO
// ─────────────────────────────────────────────
const rimuoviCopertina = async ({ corsoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);

  const fileId = corso.copertina_file_id;
  if (!fileId) {
    throw new AppError('Questo corso non ha una copertina caricata.', 404, 'COPERTINA_NOT_FOUND');
  }

  corso.copertina_file_id = null;
  await corso.save();
  await eliminaFilesPerId([fileId]);

  logger.info(`[CORSO] Copertina rimossa dal corso ${corsoId} da ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// STAFF — AGGIUNGI DOCUMENTO A UN CAPITOLO (via URL esterno)
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
    file_id: null,
    ordine,
  });

  logger.info(
    `[CORSO] Aggiunto documento (URL) ${documento.id} al capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`
  );

  return { ...documento.toPublicJSON(), file: null };
};

// ─────────────────────────────────────────────
// STAFF — AGGIUNGI DOCUMENTO A UN CAPITOLO (file caricato dal PC)
// ─────────────────────────────────────────────
const aggiungiDocumentoFile = async ({ corsoId, capitoloId, file, dati, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  await caricaCapitolo(corsoId, capitoloId);

  let ordine = dati.ordine;
  if (ordine === undefined || ordine === null) {
    const maxOrdine = await DocumentoCapitolo.max('ordine', { where: { capitolo_id: capitoloId } });
    ordine = Number.isFinite(maxOrdine) ? maxOrdine + 1 : 0;
  }

  // Titolo: usa quello indicato o, in mancanza, il nome file originale.
  const titolo = dati && dati.titolo ? dati.titolo.trim() : file.originalname;

  const risultato = await sequelize.transaction(async (t) => {
    const fileCaricato = await fileService.persistiFile({
      tipo: 'documento',
      file,
      richiedente,
      transaction: t,
    });

    const documento = await DocumentoCapitolo.create(
      {
        capitolo_id: capitoloId,
        titolo,
        url: null,
        file_id: fileCaricato.id,
        ordine,
      },
      { transaction: t }
    );

    return { documento, fileCaricato };
  });

  logger.info(
    `[CORSO] Aggiunto documento (file) ${risultato.documento.id} al capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`
  );

  return { ...risultato.documento.toPublicJSON(), file: risultato.fileCaricato.toPublicJSON() };
};

// ─────────────────────────────────────────────
// STAFF — ELIMINA DOCUMENTO (rimuove anche il file caricato, se presente)
// ─────────────────────────────────────────────
const eliminaDocumento = async ({ corsoId, capitoloId, documentoId, richiedente }) => {
  const corso = await caricaCorso(corsoId);
  assicuraGestioneCorso(corso, richiedente);
  await caricaCapitolo(corsoId, capitoloId);
  const documento = await caricaDocumento(capitoloId, documentoId);

  const fileId = documento.file_id;

  await documento.destroy();
  if (fileId) await eliminaFilesPerId([fileId]);

  logger.info(
    `[CORSO] Eliminato documento ${documentoId} dal capitolo ${capitoloId} (corso ${corsoId}) da ${richiedente.id}`
  );
};

// ─────────────────────────────────────────────
// STAFF — RENDI DISPONIBILE UN CORSO A UN'AULA
// ─────────────────────────────────────────────
const rendiDisponibile = async ({ corsoId, classeId, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const corso = await caricaCorso(corsoId, { transaction: t });
    assicuraGestioneCorso(corso, richiedente);

    const classe = await Classe.findByPk(classeId, { transaction: t });
    if (!classe) {
      throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
    }

    if (String(corso.scuola_id) !== String(classe.scuola_id)) {
      throw new AppError(
        "Il corso e l'aula devono appartenere alla stessa scuola.",
        403,
        'CROSS_SCUOLA_FORBIDDEN'
      );
    }

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
      livello: classe.livello,
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

  const { livello, materia, q, page, limit } = filtri;
  const where = { id: { [Op.in]: corsoIds }, stato: 'pubblicato' };
  if (livello) where.livello = livello;
  if (materia) where.materia = materia;
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

  const corsi = righe.map((c) => ({
    id: c.id,
    titolo: c.titolo,
    descrizione: c.descrizione,
    copertinaFileId: c.copertina_file_id,
    copertinaUrl: c.copertina_url,
    materia: c.materia,
    livello: c.livello,
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
  const conteggi = await conteggiCapitoli([corsoId]);

  return {
    id: corso.id,
    titolo: corso.titolo,
    descrizione: corso.descrizione,
    copertinaFileId: corso.copertina_file_id,
    copertinaUrl: corso.copertina_url,
    materia: corso.materia,
    livello: corso.livello,
    conteggioCapitoli: conteggi.get(corsoId) || 0,
    capitoli,
    created_at: corso.created_at,
  };
};

// ─────────────────────────────────────────────
// DISTRIBUZIONE FILE — risolve l'accesso e la policy di download
// ─────────────────────────────────────────────
/**
 * Determina se il richiedente può accedere a un file caricato e con quale
 * Content-Disposition servirlo. Centralizza qui la regola di accesso perché
 * dipende dai corsi/aule/iscrizioni.
 *
 * @returns {Promise<{disposition:'inline'|'attachment'}>}
 */
const risolviAccessoFile = async ({ file, richiedente }) => {
  // Trova l'entità che referenzia il file → il corso di appartenenza.
  let corso = null;
  let capitolo = null;

  if (file.tipo === 'immagine') {
    corso = await Corso.findOne({ where: { copertina_file_id: file.id } });
  } else if (file.tipo === 'video') {
    capitolo = await Capitolo.findOne({ where: { video_file_id: file.id } });
    if (capitolo) corso = await Corso.findByPk(capitolo.corso_id);
  } else if (file.tipo === 'documento') {
    const doc = await DocumentoCapitolo.findOne({ where: { file_id: file.id } });
    if (doc) {
      capitolo = await Capitolo.findByPk(doc.capitolo_id);
      if (capitolo) corso = await Corso.findByPk(capitolo.corso_id);
    }
  }

  const isStaff = richiedente.ruolo === 'insegnante' || richiedente.ruolo === 'admin';

  if (isStaff) {
    // Lo staff accede ai file della propria scuola (admin trasversale).
    assicuraStessaScuola(richiedente, file.scuola_id, 'Questo file non appartiene alla tua scuola.');
  } else {
    // Lo studente accede solo ai file di un corso disponibile e pubblicato.
    if (!corso) throw new AppError('File non trovato.', 404, 'FILE_NOT_FOUND');
    const disponibili = await idCorsiDisponibiliStudente(richiedente.id);
    if (!disponibili.map(String).includes(String(corso.id)) || corso.stato !== 'pubblicato') {
      throw new AppError('File non trovato.', 404, 'FILE_NOT_FOUND');
    }
  }

  // Content-Disposition / policy di download.
  let disposition = 'inline';
  if (file.tipo === 'documento') {
    disposition = 'attachment';
  } else if (file.tipo === 'video') {
    const scaricabile = capitolo
      ? capitolo.scaricabileEffettivo(corso ? corso.video_scaricabile : false)
      : false;
    disposition = scaricabile ? 'attachment' : 'inline';
  }

  return { disposition };
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
  impostaVideoCapitolo,
  rimuoviVideoCapitolo,
  impostaCopertina,
  rimuoviCopertina,
  aggiungiDocumento,
  aggiungiDocumentoFile,
  eliminaDocumento,
  rendiDisponibile,
  revocaDisponibilita,
  elencoCorsiStudente,
  dettaglioCorsoStudente,
  risolviAccessoFile,
};
