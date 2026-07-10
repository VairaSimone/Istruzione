'use strict';

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Quiz = require('../models/Quiz');
const DomandaQuiz = require('../models/DomandaQuiz');
const OpzioneQuiz = require('../models/OpzioneQuiz');
const QuizAula = require('../models/QuizAula');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const { assicuraStessaScuola, risolviScuolaCreazione, isAdmin } = require('../utils/tenant');
const logger = require('../utils/logger');
const { mescola } = require('../utils/mescola');
const impostazioniService = require('./impostazioniService');
const {
  catalogoPubblico,
  trovaTemplateObbligatorio,
  CODICI_TEMPLATE,
} = require('../constants/quizTemplates');

/**
 * QuizGestioneService — logica di dominio dei QUIZ DELLE SCUOLE.
 *
 *   catalogo template · CRUD quiz · CRUD domande/opzioni · abilitazione per aula
 *   · viste studente · correzione lato server delle risposte
 *
 * Due specie di quiz (cfr. modello `Quiz`):
 *   - DA TEMPLATE      → `template_codice` valorizzato ('kana', 'kanji', …):
 *                        le domande le genera il motore del template, qui non
 *                        esistono righe in `domande_quiz`. Una scuola decide se
 *                        installare o meno il template del giapponese;
 *   - PERSONALIZZATI   → `template_codice` null: le domande sono righe di
 *                        database scritte dagli insegnanti, su qualsiasi materia.
 *
 * Regole di accesso applicate qui (difesa a livello service, oltre al gate di
 * ruolo nelle route):
 *   - ogni insegnante gestisce TUTTI i quiz della PROPRIA scuola (non solo i
 *     propri); l'admin è trasversale;
 *   - un quiz è abilitabile SOLO ad aule della STESSA scuola e, per
 *     l'insegnante, solo ad aule in cui insegna;
 *   - lo studente gioca solo i quiz PUBBLICATI abilitati per un'aula di cui è
 *     membro-studente.
 *
 * CORREZIONE LATO SERVER: per i quiz personalizzati il client non riceve mai la
 * soluzione (né il flag `corretta` delle opzioni, né la risposta esatta delle
 * domande aperte). La valutazione avviene in `correggiRisposte`.
 */

// Limiti difensivi.
const MAX_DOMANDE_INLINE = 50;     // domande creabili nello stesso POST di creazione
const MAX_DOMANDE_PER_QUIZ = 500;  // tetto complessivo per quiz
const OPZIONI_MIN = DomandaQuiz.OPZIONI_MIN; // 2
const OPZIONI_MAX = DomandaQuiz.OPZIONI_MAX; // 6

// Chiave di impostazione della scuola che governa l'accesso ai quiz storici di
// giapponese senza passare da un quiz installato. Default: true (retrocompat).
// Impostazione della scuola che governa l'accesso libero ai TEMPLATE.
// Vive nello schema (`impostazioni.didattica.accessoLiberoTemplate`), non più
// come chiave ad-hoc di primo livello.
const CHIAVE_TEMPLATE_LIBERO = 'accessoLiberoTemplate';

// ─────────────────────────────────────────────
// Helper — caricamento e autorizzazione
// ─────────────────────────────────────────────

/** Carica il quiz o lancia 404. */
const caricaQuiz = async (quizId, opzioni = {}) => {
  const quiz = await Quiz.findByPk(quizId, opzioni);
  if (!quiz) {
    throw new AppError('Quiz non trovato.', 404, 'QUIZ_NOT_FOUND');
  }
  return quiz;
};

/**
 * Verifica che il richiedente possa GESTIRE il quiz: admin sempre, altrimenti
 * deve appartenere alla STESSA scuola del quiz. Ogni insegnante della scuola
 * può modificare tutti i quiz della scuola, non solo quelli che ha creato.
 */
const assicuraGestioneQuiz = (quiz, richiedente) => {
  assicuraStessaScuola(
    richiedente,
    quiz.scuola_id,
    'Questo quiz non appartiene alla tua scuola.'
  );
};

/** Carica una domanda garantendo che appartenga al quiz indicato. */
const caricaDomanda = async (quizId, domandaId, opzioni = {}) => {
  const domanda = await DomandaQuiz.findByPk(domandaId, opzioni);
  if (!domanda || String(domanda.quiz_id) !== String(quizId)) {
    throw new AppError('Domanda non trovata.', 404, 'DOMANDA_NOT_FOUND');
  }
  return domanda;
};

/** True se il richiedente è insegnante dell'aula (o admin). */
const insegnaNellaClasse = async (classeId, richiedente, transaction) => {
  if (isAdmin(richiedente)) return true;
  const membership = await ClasseUtente.findOne({
    where: { classe_id: classeId, utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    transaction,
  });
  return Boolean(membership);
};

/** Id delle aule di cui l'utente è membro-studente. */
const idAuleStudente = async (studenteId, transaction) => {
  const righe = await ClasseUtente.findAll({
    where: { utente_id: studenteId, ruolo_nella_classe: 'studente' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  return righe.map((r) => r.classe_id);
};

/** Id dei quiz abilitati per almeno una delle aule dello studente. */
const idQuizAbilitatiStudente = async (studenteId, transaction) => {
  const classeIds = await idAuleStudente(studenteId, transaction);
  if (!classeIds.length) return [];

  const righe = await QuizAula.findAll({
    where: { classe_id: { [Op.in]: classeIds } },
    attributes: ['quiz_id'],
    raw: true,
    transaction,
  });
  return [...new Set(righe.map((r) => r.quiz_id))];
};

/**
 * Conta le domande per un insieme di quiz con UNA sola query aggregata
 * (niente N+1). Restituisce una mappa quizId → totale.
 */
const conteggiDomande = async (quizIds) => {
  const mappa = new Map();
  if (!quizIds.length) return mappa;

  const righe = await DomandaQuiz.findAll({
    where: { quiz_id: { [Op.in]: quizIds } },
    attributes: ['quiz_id', [fn('COUNT', col('id')), 'totale']],
    group: ['quiz_id'],
    raw: true,
  });

  for (const r of righe) {
    mappa.set(r.quiz_id, parseInt(r.totale, 10));
  }
  return mappa;
};

// ─────────────────────────────────────────────
// Helper — validazione semantica di una domanda
// ─────────────────────────────────────────────

/**
 * Normalizza e valida il payload di una domanda (forma già controllata dai
 * validator; qui si applicano i vincoli che richiedono di vedere l'insieme).
 *
 * Regole:
 *   - 'scelta_multipla' → da OPZIONI_MIN a OPZIONI_MAX opzioni, esattamente una
 *     corretta; nessuna risposta testuale;
 *   - 'vero_falso'      → esattamente 2 opzioni con una sola corretta. In
 *     alternativa si può omettere `opzioni` e passare `rispostaVeroFalso`
 *     (booleano): le opzioni "Vero"/"Falso" vengono generate;
 *   - 'risposta_breve'  → nessuna opzione; `rispostaCorretta` obbligatoria,
 *     con eventuali `risposteAlternative`.
 *
 * @returns {{campiDomanda:object, opzioni:Array<{testo:string,corretta:boolean,ordine:number}>}}
 */
const normalizzaDomanda = (dati) => {
  const tipo = dati.tipo || 'scelta_multipla';

  const campiDomanda = {
    tipo,
    testo: String(dati.testo).trim(),
    spiegazione: dati.spiegazione === undefined ? null : dati.spiegazione,
    media_url: dati.mediaUrl === undefined ? null : dati.mediaUrl,
    risposta_corretta: null,
    risposte_alternative: [],
    case_sensitive: false,
  };

  if (tipo === 'risposta_breve') {
    if (Array.isArray(dati.opzioni) && dati.opzioni.length > 0) {
      throw new AppError(
        'Le domande a risposta breve non possono avere opzioni di risposta.',
        422,
        'DOMANDA_OPZIONI_NON_AMMESSE'
      );
    }
    const risposta = typeof dati.rispostaCorretta === 'string' ? dati.rispostaCorretta.trim() : '';
    if (!risposta) {
      throw new AppError(
        'Le domande a risposta breve richiedono la risposta corretta.',
        422,
        'DOMANDA_RISPOSTA_MANCANTE'
      );
    }
    const alternative = Array.isArray(dati.risposteAlternative)
      ? dati.risposteAlternative.map((r) => String(r).trim()).filter(Boolean)
      : [];
    if (alternative.length > DomandaQuiz.MAX_RISPOSTE_ALTERNATIVE) {
      throw new AppError(
        `Puoi indicare al massimo ${DomandaQuiz.MAX_RISPOSTE_ALTERNATIVE} risposte alternative.`,
        422,
        'DOMANDA_TROPPE_ALTERNATIVE'
      );
    }
    campiDomanda.risposta_corretta = risposta;
    campiDomanda.risposte_alternative = [...new Set(alternative)];
    campiDomanda.case_sensitive = dati.caseSensitive === true;
    return { campiDomanda, opzioni: [] };
  }

  // — Domande a scelta (scelta_multipla | vero_falso) —
  let opzioniInput = Array.isArray(dati.opzioni) ? dati.opzioni : null;

  if (tipo === 'vero_falso' && !opzioniInput) {
    if (typeof dati.rispostaVeroFalso !== 'boolean') {
      throw new AppError(
        'Per una domanda vero/falso indica `opzioni` oppure `rispostaVeroFalso` (booleano).',
        422,
        'DOMANDA_VERO_FALSO_INCOMPLETA'
      );
    }
    opzioniInput = [
      { testo: 'Vero', corretta: dati.rispostaVeroFalso === true },
      { testo: 'Falso', corretta: dati.rispostaVeroFalso === false },
    ];
  }

  if (!opzioniInput || opzioniInput.length === 0) {
    throw new AppError(
      'Le domande a scelta richiedono le opzioni di risposta.',
      422,
      'DOMANDA_OPZIONI_MANCANTI'
    );
  }

  const minimo = tipo === 'vero_falso' ? 2 : OPZIONI_MIN;
  const massimo = tipo === 'vero_falso' ? 2 : OPZIONI_MAX;
  if (opzioniInput.length < minimo || opzioniInput.length > massimo) {
    throw new AppError(
      tipo === 'vero_falso'
        ? 'Una domanda vero/falso deve avere esattamente 2 opzioni.'
        : `Una domanda a scelta multipla deve avere da ${OPZIONI_MIN} a ${OPZIONI_MAX} opzioni.`,
      422,
      'DOMANDA_NUMERO_OPZIONI'
    );
  }

  const corrette = opzioniInput.filter((o) => o.corretta === true);
  if (corrette.length !== 1) {
    throw new AppError(
      'Ogni domanda a scelta deve avere esattamente una opzione corretta.',
      422,
      'DOMANDA_UNICA_CORRETTA'
    );
  }

  const opzioni = opzioniInput.map((o, indice) => ({
    testo: String(o.testo).trim(),
    corretta: o.corretta === true,
    ordine: Number.isInteger(o.ordine) ? o.ordine : indice,
  }));

  return { campiDomanda, opzioni };
};

/** Un quiz da template non ha domande in database: vieta le operazioni relative. */
const assicuraQuizPersonalizzato = (quiz) => {
  if (quiz.daTemplate) {
    throw new AppError(
      'Questo quiz deriva da un template: le sue domande sono generate automaticamente e non sono modificabili. Modificane la configurazione, oppure crea un quiz personalizzato.',
      422,
      'QUIZ_TEMPLATE_NO_DOMANDE'
    );
  }
};

/** Persiste una domanda con le sue opzioni (dentro una transazione). */
const creaDomandaConOpzioni = async (quizId, dati, ordineDefault, t) => {
  const { campiDomanda, opzioni } = normalizzaDomanda(dati);

  const domanda = await DomandaQuiz.create(
    {
      quiz_id: quizId,
      ...campiDomanda,
      ordine: Number.isInteger(dati.ordine) ? dati.ordine : ordineDefault,
    },
    { transaction: t }
  );

  for (const opzione of opzioni) {
    await OpzioneQuiz.create({ domanda_id: domanda.id, ...opzione }, { transaction: t });
  }

  return domanda;
};

/** Ricarica una domanda con le opzioni ordinate (vista staff). */
const ricaricaDomandaStaff = async (domandaId, transaction) => {
  const domanda = await DomandaQuiz.findByPk(domandaId, {
    include: [{ model: OpzioneQuiz, as: 'opzioni' }],
    order: [[{ model: OpzioneQuiz, as: 'opzioni' }, 'ordine', 'ASC']],
    transaction,
  });
  return {
    ...domanda.toPublicJSON(),
    opzioni: (domanda.opzioni || [])
      .slice()
      .sort((a, b) => a.ordine - b.ordine)
      .map((o) => o.toPublicJSON()),
  };
};

// ═════════════════════════════════════════════
// CATALOGO TEMPLATE
// ═════════════════════════════════════════════

/**
 * Catalogo dei template di piattaforma installabili, con l'indicazione di
 * quanti quiz la scuola del richiedente ne ha già creati.
 */
const elencoTemplate = async ({ richiedente, scuolaIdRichiesta }) => {
  const catalogo = catalogoPubblico();

  // L'admin può chiedere il conteggio per una scuola specifica.
  const scuolaId = isAdmin(richiedente) ? scuolaIdRichiesta || null : richiedente.scuola_id;
  if (!scuolaId) {
    return catalogo.map((t) => ({ ...t, installazioni: 0 }));
  }

  const righe = await Quiz.findAll({
    where: { scuola_id: scuolaId, template_codice: { [Op.in]: CODICI_TEMPLATE } },
    attributes: ['template_codice', [fn('COUNT', col('id')), 'totale']],
    group: ['template_codice'],
    raw: true,
  });
  const perCodice = new Map(righe.map((r) => [r.template_codice, parseInt(r.totale, 10)]));

  return catalogo.map((t) => ({ ...t, installazioni: perCodice.get(t.codice) || 0 }));
};

// ═════════════════════════════════════════════
// STAFF — CRUD QUIZ
// ═════════════════════════════════════════════

/**
 * Crea un quiz. Se `templateCodice` è presente, il quiz è l'installazione di un
 * template (la `configurazione` viene validata dal registro e le domande inline
 * sono rifiutate). Altrimenti è un quiz personalizzato, con domande facoltative
 * create inline.
 */
const creaQuiz = async ({ dati, domande, richiedente }) => {
  const scuolaId = risolviScuolaCreazione(richiedente, dati.scuolaId, {
    scuolaObbligatoriaPerAdmin: true,
  });

  const domandeInput = Array.isArray(domande) ? domande : [];
  let configurazione = {};
  // Descrittore del template installato (null per i quiz personalizzati):
  // serve anche più sotto per ereditarne materia e categoria.
  let template = null;

  if (dati.templateCodice) {
    template = trovaTemplateObbligatorio(dati.templateCodice);
    configurazione = template.valida(dati.configurazione || {});
    if (domandeInput.length > 0) {
      throw new AppError(
        'Un quiz creato da un template non accetta domande: le genera il suo motore.',
        422,
        'QUIZ_TEMPLATE_NO_DOMANDE'
      );
    }
  } else if (domandeInput.length > MAX_DOMANDE_INLINE) {
    throw new AppError(
      `Puoi creare al massimo ${MAX_DOMANDE_INLINE} domande in fase di creazione. Aggiungi le altre singolarmente.`,
      422,
      'TROPPE_DOMANDE'
    );
  }

  // La materia è testo libero, ma se la scuola ha definito il proprio
  // vocabolario (`impostazioni.didattica.materieDisponibili`) il valore deve
  // appartenervi. Se un template è installato e la materia non è indicata, si
  // eredita quella dichiarata dal template (es. "Giapponese").
  const materiaRichiesta =
    dati.materia !== undefined && dati.materia !== null && dati.materia !== ''
      ? dati.materia
      : template
        ? template.materia
        : null;
  const materiaNorm = await impostazioniService.assicuraNelVocabolario(
    scuolaId,
    'materieDisponibili',
    materiaRichiesta,
    'La materia del quiz'
  );
  const categoriaNorm =
    dati.categoria !== undefined && dati.categoria !== null && dati.categoria !== ''
      ? String(dati.categoria).trim()
      : template
        ? template.categoria || null
        : null;

  const quiz = await sequelize.transaction(async (t) => {
    const nuovo = await Quiz.create(
      {
        titolo: dati.titolo.trim(),
        descrizione: dati.descrizione ?? null,
        materia: materiaNorm,
        categoria: categoriaNorm,
        template_codice: dati.templateCodice ?? null,
        configurazione,
        stato: dati.stato ?? 'bozza',
        dimensione_round: dati.dimensioneRound ?? Quiz.DIMENSIONE_ROUND_DEFAULT,
        mescola_domande: dati.mescolaDomande === undefined ? true : dati.mescolaDomande,
        scuola_id: scuolaId,
        creato_da: richiedente.id,
      },
      { transaction: t }
    );

    for (let i = 0; i < domandeInput.length; i += 1) {
      await creaDomandaConOpzioni(nuovo.id, domandeInput[i], i, t);
    }

    return nuovo;
  });

  logger.info(
    `[QUIZ] Creato quiz ${quiz.id} "${quiz.titolo}" (motore ${quiz.motore}) da utente ${richiedente.id}`
  );

  return dettaglioQuiz({ quizId: quiz.id, richiedente });
};

/** Elenco dei quiz della scuola del richiedente (admin: tutte, o una scelta). */
const elencoQuiz = async ({ richiedente, filtri }) => {
  const { stato, materia, categoria, template, q, scuola, page, limit } = filtri;
  const where = {};

  if (!isAdmin(richiedente)) {
    if (!richiedente.scuola_id) {
      return { quiz: [], paginazione: null };
    }
    where.scuola_id = richiedente.scuola_id;
  } else if (scuola) {
    where.scuola_id = scuola;
  }

  if (stato) where.stato = stato;
  if (materia) where.materia = materia;
  if (categoria) where.categoria = categoria;
  // `template=personalizzato` filtra i quiz senza template.
  if (template === 'personalizzato') where.template_codice = null;
  else if (template) where.template_codice = template;
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
    const risultato = await Quiz.findAndCountAll(queryOptions);
    righe = risultato.rows;
    totale = risultato.count;
  } else {
    righe = await Quiz.findAll(queryOptions);
  }

  const conteggi = await conteggiDomande(righe.filter((x) => !x.daTemplate).map((x) => x.id));

  const quiz = righe.map((x) => ({
    ...x.toPublicJSON(),
    conteggioDomande: x.daTemplate ? null : conteggi.get(x.id) || 0,
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { quiz, paginazione };
};

/** Dettaglio staff: domande (con soluzioni) + aule abilitate. */
const dettaglioQuiz = async ({ quizId, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);

  const domande = quiz.daTemplate
    ? []
    : await DomandaQuiz.findAll({
        where: { quiz_id: quizId },
        include: [{ model: OpzioneQuiz, as: 'opzioni' }],
        order: [
          ['ordine', 'ASC'],
          ['created_at', 'ASC'],
          [{ model: OpzioneQuiz, as: 'opzioni' }, 'ordine', 'ASC'],
        ],
      });

  const abilitazioni = await QuizAula.findAll({
    where: { quiz_id: quizId },
    include: [
      { model: Classe, as: 'classe', attributes: ['id', 'nome', 'anno_scolastico', 'livello'] },
    ],
    order: [['created_at', 'ASC']],
  });

  const auleAbilitate = abilitazioni
    .filter((a) => a.classe)
    .map((a) => ({
      classeId: a.classe.id,
      nome: a.classe.nome,
      annoScolastico: a.classe.anno_scolastico,
      livello: a.classe.livello,
      abilitatoIl: a.created_at,
    }));

  return {
    ...quiz.toPublicJSON(),
    conteggioDomande: quiz.daTemplate ? null : domande.length,
    domande: domande.map((d) => ({
      ...d.toPublicJSON(),
      opzioni: (d.opzioni || []).map((o) => o.toPublicJSON()),
    })),
    auleAbilitate,
  };
};

/**
 * Aggiorna un quiz. Il `templateCodice` è immutabile (cambiarlo trasformerebbe
 * la natura del quiz lasciando domande o progressi incoerenti): per cambiare
 * template si crea un nuovo quiz.
 */
const aggiornaQuiz = async ({ quizId, dati, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);

  if (dati.templateCodice !== undefined && dati.templateCodice !== quiz.template_codice) {
    throw new AppError(
      'Il template di un quiz non è modificabile. Crea un nuovo quiz con il template desiderato.',
      422,
      'QUIZ_TEMPLATE_IMMUTABILE'
    );
  }

  if (dati.configurazione !== undefined) {
    if (!quiz.daTemplate) {
      throw new AppError(
        'Solo i quiz creati da un template hanno una configurazione.',
        422,
        'QUIZ_CONFIG_NON_AMMESSA'
      );
    }
    const template = trovaTemplateObbligatorio(quiz.template_codice);
    quiz.configurazione = template.valida(dati.configurazione || {});
  }

  if (dati.titolo !== undefined) quiz.titolo = dati.titolo.trim();
  if (dati.descrizione !== undefined) quiz.descrizione = dati.descrizione;
  if (dati.materia !== undefined) {
    quiz.materia = await impostazioniService.assicuraNelVocabolario(
      quiz.scuola_id,
      'materieDisponibili',
      dati.materia,
      'La materia del quiz'
    );
  }
  if (dati.categoria !== undefined) quiz.categoria = dati.categoria;
  if (dati.stato !== undefined) quiz.stato = dati.stato;
  if (dati.dimensioneRound !== undefined) quiz.dimensione_round = dati.dimensioneRound;
  if (dati.mescolaDomande !== undefined) quiz.mescola_domande = dati.mescolaDomande;

  await quiz.save();
  logger.info(`[QUIZ] Aggiornato quiz ${quizId} da utente ${richiedente.id}`);

  return dettaglioQuiz({ quizId, richiedente });
};

/** Elimina un quiz (cascade: domande, opzioni, abilitazioni, progressi SRS). */
const eliminaQuiz = async ({ quizId, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);

  await quiz.destroy();
  logger.info(`[QUIZ] Eliminato quiz ${quizId} da utente ${richiedente.id}`);
};

// ═════════════════════════════════════════════
// STAFF — DOMANDE (solo quiz personalizzati)
// ═════════════════════════════════════════════

const aggiungiDomanda = async ({ quizId, dati, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);
  assicuraQuizPersonalizzato(quiz);

  const totale = await DomandaQuiz.count({ where: { quiz_id: quizId } });
  if (totale >= MAX_DOMANDE_PER_QUIZ) {
    throw new AppError(
      `Un quiz può contenere al massimo ${MAX_DOMANDE_PER_QUIZ} domande.`,
      422,
      'TROPPE_DOMANDE'
    );
  }

  // Ordine: accoda in fondo se non specificato.
  let ordine = dati.ordine;
  if (ordine === undefined || ordine === null) {
    const maxOrdine = await DomandaQuiz.max('ordine', { where: { quiz_id: quizId } });
    ordine = Number.isFinite(maxOrdine) ? maxOrdine + 1 : 0;
  }

  const domanda = await sequelize.transaction(async (t) =>
    creaDomandaConOpzioni(quizId, { ...dati, ordine }, ordine, t)
  );

  logger.info(`[QUIZ] Aggiunta domanda ${domanda.id} al quiz ${quizId} da ${richiedente.id}`);

  return ricaricaDomandaStaff(domanda.id);
};

/**
 * Aggiorna una domanda. Se il payload contiene un cambio di tipo o di opzioni,
 * le opzioni vengono RICREATE integralmente (semplice e prevedibile). I
 * progressi SRS della domanda non vengono azzerati: l'identità della domanda
 * resta la stessa.
 */
const aggiornaDomanda = async ({ quizId, domandaId, dati, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);
  assicuraQuizPersonalizzato(quiz);
  const domanda = await caricaDomanda(quizId, domandaId);

  // Ricostruisce il payload completo unendo lo stato attuale e le modifiche:
  // la validazione semantica (una sola opzione corretta, ecc.) ha bisogno di
  // vedere la domanda nella sua forma finale.
  const opzioniAttuali = await OpzioneQuiz.findAll({
    where: { domanda_id: domandaId },
    order: [['ordine', 'ASC']],
  });

  const tipoFinale = dati.tipo !== undefined ? dati.tipo : domanda.tipo;

  // Le opzioni vanno ricreate solo se il client le tocca esplicitamente o se
  // cambia il tipo della domanda; altrimenti si riusano quelle esistenti (gli id
  // restano stabili, e con essi le eventuali referenze lato client).
  const ricreaOpzioni =
    dati.opzioni !== undefined ||
    dati.rispostaVeroFalso !== undefined ||
    tipoFinale !== domanda.tipo;

  let opzioniPayload;
  if (tipoFinale === 'risposta_breve') {
    opzioniPayload = [];
  } else if (dati.opzioni !== undefined) {
    opzioniPayload = dati.opzioni;
  } else if (dati.rispostaVeroFalso !== undefined) {
    opzioniPayload = undefined; // generate "Vero"/"Falso" dal booleano
  } else {
    opzioniPayload = opzioniAttuali.map((o) => ({
      testo: o.testo,
      corretta: o.corretta,
      ordine: o.ordine,
    }));
  }

  const payload = {
    tipo: tipoFinale,
    testo: dati.testo !== undefined ? dati.testo : domanda.testo,
    spiegazione: dati.spiegazione !== undefined ? dati.spiegazione : domanda.spiegazione,
    mediaUrl: dati.mediaUrl !== undefined ? dati.mediaUrl : domanda.media_url,
    rispostaCorretta:
      dati.rispostaCorretta !== undefined ? dati.rispostaCorretta : domanda.risposta_corretta,
    risposteAlternative:
      dati.risposteAlternative !== undefined
        ? dati.risposteAlternative
        : domanda.risposte_alternative || [],
    caseSensitive: dati.caseSensitive !== undefined ? dati.caseSensitive : domanda.case_sensitive,
    rispostaVeroFalso: dati.rispostaVeroFalso,
    opzioni: opzioniPayload,
  };

  const { campiDomanda, opzioni } = normalizzaDomanda(payload);

  await sequelize.transaction(async (t) => {
    domanda.set(campiDomanda);
    if (dati.ordine !== undefined) domanda.ordine = dati.ordine;
    await domanda.save({ transaction: t });

    if (ricreaOpzioni) {
      await OpzioneQuiz.destroy({ where: { domanda_id: domandaId }, transaction: t });
      for (const opzione of opzioni) {
        await OpzioneQuiz.create({ domanda_id: domandaId, ...opzione }, { transaction: t });
      }
    }
  });

  logger.info(`[QUIZ] Aggiornata domanda ${domandaId} del quiz ${quizId} da ${richiedente.id}`);

  return ricaricaDomandaStaff(domandaId);
};

const eliminaDomanda = async ({ quizId, domandaId, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);
  assicuraQuizPersonalizzato(quiz);
  const domanda = await caricaDomanda(quizId, domandaId);

  await domanda.destroy(); // CASCADE su opzioni_quiz e progressi_domanda
  logger.info(`[QUIZ] Eliminata domanda ${domandaId} del quiz ${quizId} da ${richiedente.id}`);
};

// ═════════════════════════════════════════════
// STAFF — ABILITAZIONE PRESSO LE AULE
// ═════════════════════════════════════════════

const abilitaPerAula = async ({ quizId, classeId, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const quiz = await caricaQuiz(quizId, { transaction: t });
    assicuraGestioneQuiz(quiz, richiedente);

    const classe = await Classe.findByPk(classeId, { transaction: t });
    if (!classe) {
      throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
    }

    if (String(quiz.scuola_id) !== String(classe.scuola_id)) {
      throw new AppError(
        "Il quiz e l'aula devono appartenere alla stessa scuola.",
        403,
        'CROSS_SCUOLA_FORBIDDEN'
      );
    }

    if (!(await insegnaNellaClasse(classeId, richiedente, t))) {
      throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
    }

    const [abilitazione, creata] = await QuizAula.findOrCreate({
      where: { quiz_id: quizId, classe_id: classeId },
      defaults: { quiz_id: quizId, classe_id: classeId, abilitato_da: richiedente.id },
      transaction: t,
    });

    if (!creata) {
      throw new AppError('Il quiz è già abilitato per questa aula.', 409, 'ALREADY_ENABLED');
    }

    logger.info(`[QUIZ] Quiz ${quizId} abilitato per l'aula ${classeId} da ${richiedente.id}`);

    return {
      classeId: classe.id,
      nome: classe.nome,
      annoScolastico: classe.anno_scolastico,
      livello: classe.livello,
      abilitatoIl: abilitazione.created_at,
    };
  });
};

const disabilitaPerAula = async ({ quizId, classeId, richiedente }) => {
  const quiz = await caricaQuiz(quizId);
  assicuraGestioneQuiz(quiz, richiedente);

  const abilitazione = await QuizAula.findOne({
    where: { quiz_id: quizId, classe_id: classeId },
  });
  if (!abilitazione) {
    throw new AppError('Il quiz non è abilitato per questa aula.', 404, 'ENABLEMENT_NOT_FOUND');
  }

  await abilitazione.destroy();
  logger.info(`[QUIZ] Quiz ${quizId} disabilitato per l'aula ${classeId} da ${richiedente.id}`);
};

// ═════════════════════════════════════════════
// VISTA GIOCATORE — quiz disponibili
// ═════════════════════════════════════════════

/**
 * Quiz che il richiedente può giocare:
 *   - studente → quiz PUBBLICATI abilitati per almeno una delle sue aule;
 *   - staff    → tutti i quiz della propria scuola (anche in bozza: anteprima).
 */
const quizDisponibili = async ({ richiedente, filtri = {} }) => {
  const where = {};

  if (richiedente.ruolo === 'studente') {
    const quizIds = await idQuizAbilitatiStudente(richiedente.id);
    if (!quizIds.length) return { quiz: [] };
    where.id = { [Op.in]: quizIds };
    where.stato = 'pubblicato';
  } else if (!isAdmin(richiedente)) {
    if (!richiedente.scuola_id) return { quiz: [] };
    where.scuola_id = richiedente.scuola_id;
  } else if (filtri.scuola) {
    where.scuola_id = filtri.scuola;
  }

  if (filtri.materia) where.materia = filtri.materia;
  if (filtri.categoria) where.categoria = filtri.categoria;

  const righe = await Quiz.findAll({ where, order: [['created_at', 'DESC']] });
  const conteggi = await conteggiDomande(righe.filter((x) => !x.daTemplate).map((x) => x.id));

  return {
    quiz: righe.map((x) => ({
      id: x.id,
      titolo: x.titolo,
      descrizione: x.descrizione,
      materia: x.materia,
      categoria: x.categoria,
      templateCodice: x.template_codice,
      motore: x.motore,
      configurazione: x.configurazione || {},
      dimensioneRound: x.dimensione_round,
      conteggioDomande: x.daTemplate ? null : conteggi.get(x.id) || 0,
      created_at: x.created_at,
    })),
  };
};

/**
 * Carica un quiz verificando che il richiedente possa GIOCARLO:
 *   - studente → quiz pubblicato e abilitato per una sua aula;
 *   - insegnante → quiz della propria scuola (anche in bozza: anteprima);
 *   - admin → sempre.
 * L'errore è sempre 404 per gli studenti, così un quiz di un'altra scuola non
 * è distinguibile da un quiz inesistente.
 */
const caricaQuizPerGioco = async (quizId, richiedente) => {
  const quiz = await Quiz.findByPk(quizId);

  if (richiedente.ruolo === 'studente') {
    if (!quiz || quiz.stato !== 'pubblicato') {
      throw new AppError('Quiz non trovato.', 404, 'QUIZ_NOT_FOUND');
    }
    const abilitati = await idQuizAbilitatiStudente(richiedente.id);
    if (!abilitati.map(String).includes(String(quizId))) {
      throw new AppError('Quiz non trovato.', 404, 'QUIZ_NOT_FOUND');
    }
    return quiz;
  }

  if (!quiz) {
    throw new AppError('Quiz non trovato.', 404, 'QUIZ_NOT_FOUND');
  }
  assicuraGestioneQuiz(quiz, richiedente);
  return quiz;
};

// ═════════════════════════════════════════════
// MOTORE `domande` — selezione e correzione
// ═════════════════════════════════════════════

/** Carica tutte le domande giocabili di un quiz personalizzato, con opzioni. */
const caricaDomandeGiocabili = async (quizId, transaction) => {
  const domande = await DomandaQuiz.findAll({
    where: { quiz_id: quizId },
    include: [{ model: OpzioneQuiz, as: 'opzioni' }],
    order: [
      ['ordine', 'ASC'],
      ['created_at', 'ASC'],
      [{ model: OpzioneQuiz, as: 'opzioni' }, 'ordine', 'ASC'],
    ],
    transaction,
  });

  if (domande.length === 0) {
    throw new AppError(
      'Questo quiz non contiene ancora domande.',
      422,
      'EMPTY_QUIZ_POOL'
    );
  }
  return domande;
};

/**
 * DTO di una domanda per lo STUDENTE: nessuna soluzione, opzioni eventualmente
 * mescolate. `punteggio` è il punteggio SRS corrente (utile alla UI, come per
 * i kana/kanji).
 */
const mappaDomandaPerStudente = (domanda, punteggio, mescolaOpzioni) => {
  const opzioni = (domanda.opzioni || [])
    .slice()
    .sort((a, b) => a.ordine - b.ordine)
    .map((o) => o.toStudenteJSON());

  return {
    ...domanda.toStudenteJSON(),
    punteggio,
    opzioni: mescolaOpzioni ? mescola(opzioni) : opzioni,
  };
};

/** Normalizza un testo per il confronto delle risposte brevi. */
const normalizzaTesto = (valore, caseSensitive) => {
  const base = String(valore ?? '').trim().replace(/\s+/g, ' ');
  return caseSensitive ? base : base.toLowerCase();
};

/** Valuta la risposta a una singola domanda. */
const valutaRisposta = (domanda, risposta) => {
  if (domanda.tipo === 'risposta_breve') {
    const caseSensitive = domanda.case_sensitive === true;
    const attese = [domanda.risposta_corretta, ...(domanda.risposte_alternative || [])]
      .filter((v) => typeof v === 'string' && v.length > 0)
      .map((v) => normalizzaTesto(v, caseSensitive));
    const fornita = normalizzaTesto(risposta.testo, caseSensitive);
    return {
      corretto: fornita.length > 0 && attese.includes(fornita),
      rispostaCorretta: domanda.risposta_corretta,
    };
  }

  // Domande a scelta: confronto sull'id dell'opzione.
  const opzioni = domanda.opzioni || [];
  const corretta = opzioni.find((o) => o.corretta === true);
  return {
    corretto: Boolean(corretta) && String(risposta.opzioneId) === String(corretta.id),
    opzioneCorrettaId: corretta ? corretta.id : null,
  };
};

/**
 * Corregge un insieme di risposte contro le domande del quiz.
 *
 * Le domande sconosciute (id non appartenente al quiz) vengono IGNORATE, come
 * già avviene per i kana/kanji non presenti nei dizionari canonici: un client
 * manipolato non può inventare risposte corrette.
 * In caso di risposte duplicate per la stessa domanda vale la più severa
 * (una sola occorrenza errata rende la domanda errata).
 *
 * @param {Array<DomandaQuiz>} domande domande del quiz (con opzioni incluse)
 * @param {Array<object>} risposte     [{ domandaId, opzioneId?, testo? }]
 * @returns {{normalizzate:Array, correzione:Array}}
 */
const correggiRisposte = (domande, risposte) => {
  const perId = new Map(domande.map((d) => [String(d.id), d]));
  const esiti = new Map();

  for (const risposta of risposte) {
    const domanda = perId.get(String(risposta && risposta.domandaId));
    if (!domanda) continue;

    const esito = valutaRisposta(domanda, risposta);
    const chiave = String(domanda.id);

    if (esiti.has(chiave)) {
      const precedente = esiti.get(chiave);
      precedente.corretto = precedente.corretto && esito.corretto;
    } else {
      esiti.set(chiave, {
        domandaId: domanda.id,
        corretto: esito.corretto,
        opzioneCorrettaId: esito.opzioneCorrettaId,
        rispostaCorretta: esito.rispostaCorretta,
        spiegazione: domanda.spiegazione,
      });
    }
  }

  const correzione = Array.from(esiti.values());

  // Forma interna attesa dal motore SRS di quizService: il "carattere" è l'id
  // della domanda e non esiste una colonna secondaria.
  const normalizzate = correzione.map((c) => ({
    carattere: c.domandaId,
    secondaria: {},
    corretto: c.corretto,
  }));

  return { normalizzate, correzione };
};

// ═════════════════════════════════════════════
// ACCESSO LIBERO AI TEMPLATE (motore indicato nel body, senza quizId)
// ═════════════════════════════════════════════

/**
 * Gli endpoint `/generate` e `/submit` accettano un `dominio` (il motore di un
 * template) senza `quizId`: è la modalità di ESERCIZIO LIBERO sui template di
 * piattaforma, utile a chi vuole allenarsi fuori dai quiz assegnati.
 *
 * Una scuola che vuole governare questo accesso imposta
 * `impostazioni.didattica.accessoLiberoTemplate = false`
 * (cfr. PATCH /api/scuole/:id/impostazioni oppure /api/scuole/mia/impostazioni):
 * da quel momento i suoi STUDENTI devono passare da un quiz installato dagli
 * insegnanti (quindi pubblicato e abilitato per una loro aula). Se il valore è
 * assente vale il default `true`.
 *
 * Insegnanti e admin non sono mai bloccati: devono poter provare i template.
 */
const assicuraAccessoDominioLegacy = async (richiedente) => {
  if (richiedente.ruolo !== 'studente') return;
  if (!richiedente.scuola_id) return; // nessun tenant: comportamento predefinito

  const accessoLibero = await impostazioniService.impostazioneDidattica(
    richiedente.scuola_id,
    CHIAVE_TEMPLATE_LIBERO
  );

  if (accessoLibero === false) {
    throw new AppError(
      'La tua scuola ha disattivato l\'esercizio libero sui template: gioca dai quiz assegnati alla tua aula.',
      403,
      'QUIZ_TEMPLATE_NON_ABILITATO'
    );
  }
};

module.exports = {
  elencoTemplate,
  creaQuiz,
  elencoQuiz,
  dettaglioQuiz,
  aggiornaQuiz,
  eliminaQuiz,
  aggiungiDomanda,
  aggiornaDomanda,
  eliminaDomanda,
  abilitaPerAula,
  disabilitaPerAula,
  quizDisponibili,
  caricaQuizPerGioco,
  caricaDomandeGiocabili,
  mappaDomandaPerStudente,
  correggiRisposte,
  assicuraAccessoDominioLegacy,
  // Esportati per riuso/test:
  normalizzaDomanda,
  CHIAVE_TEMPLATE_LIBERO,
  MAX_DOMANDE_INLINE,
  MAX_DOMANDE_PER_QUIZ,
};
