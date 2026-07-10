'use strict';

const { body, param, query } = require('express-validator');
const Quiz = require('../models/Quiz');
const DomandaQuiz = require('../models/DomandaQuiz');
const { CODICI_TEMPLATE } = require('../constants/quizTemplates');

/**
 * Validator della GESTIONE DEI QUIZ (staff: insegnante | admin).
 *
 * Qui si controlla soltanto la FORMA del payload (tipi, lunghezze, enum). I
 * vincoli che richiedono di vedere l'insieme — «una domanda a scelta ha
 * esattamente una opzione corretta», «un quiz da template non ha domande», il
 * tenant, l'appartenenza all'aula — vivono nel `quizGestioneService`, che resta
 * l'unica fonte di verità anche per i chiamanti interni.
 *
 * Messaggi in italiano, `trim` e cast coerenti con gli altri validator.
 */

const STATI_QUIZ = Quiz.STATI_QUIZ;
const TIPI_DOMANDA = DomandaQuiz.TIPI_DOMANDA;
const OPZIONI_MIN = DomandaQuiz.OPZIONI_MIN;
const OPZIONI_MAX = DomandaQuiz.OPZIONI_MAX;
const TESTO_MAX = DomandaQuiz.TESTO_MAX;
const RISPOSTA_MAX = DomandaQuiz.RISPOSTA_MAX;
const MAX_RISPOSTE_ALTERNATIVE = DomandaQuiz.MAX_RISPOSTE_ALTERNATIVE;
const URL_MAX = DomandaQuiz.URL_MAX;

// Solo http/https, protocollo obbligatorio (nessun `javascript:` o `data:`).
const OPZIONI_URL = { protocols: ['http', 'https'], require_protocol: true };

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Numero massimo di domande accettate nel body di creazione del quiz.
const MAX_DOMANDE_INLINE = 50;

// ─────────────────────────────────────────────
// Parametri di rotta (UUID)
// ─────────────────────────────────────────────
const validateQuizIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo del quiz non è valido"),
];

const validateDomandaParams = [
  param('id').isUUID(4).withMessage("L'identificativo del quiz non è valido"),
  param('domandaId').isUUID(4).withMessage("L'identificativo della domanda non è valido"),
];

const validateAbilitazioneParams = [
  param('id').isUUID(4).withMessage("L'identificativo del quiz non è valido"),
  param('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

// ─────────────────────────────────────────────
// Campi di una DOMANDA (riusati inline e nelle route dedicate)
//
// `prefisso` è '' per le route della singola domanda, 'domande.*.' per le
// domande annidate nel body di creazione del quiz.
// ─────────────────────────────────────────────
const campiDomanda = (prefisso, obbligatorio) => {
  const testo = body(`${prefisso}testo`);
  if (!obbligatorio) testo.optional();

  return [
    body(`${prefisso}tipo`)
      .optional()
      .isIn(TIPI_DOMANDA)
      .withMessage(`Il tipo di domanda deve essere uno di: ${TIPI_DOMANDA.join(', ')}`),

    testo
      .isString()
      .withMessage('Il testo della domanda deve essere una stringa')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('Il testo della domanda è obbligatorio')
      .bail()
      .isLength({ max: TESTO_MAX })
      .withMessage(`Il testo della domanda non può superare i ${TESTO_MAX} caratteri`),

    body(`${prefisso}spiegazione`)
      .optional({ nullable: true })
      .isString()
      .withMessage('La spiegazione deve essere una stringa')
      .isLength({ max: TESTO_MAX })
      .withMessage(`La spiegazione non può superare i ${TESTO_MAX} caratteri`),

    body(`${prefisso}mediaUrl`)
      .optional({ nullable: true })
      .trim()
      .isURL(OPZIONI_URL)
      .withMessage("L'URL del media non è valido")
      .bail()
      .isLength({ max: URL_MAX })
      .withMessage(`L'URL del media non può superare i ${URL_MAX} caratteri`),

    // — Risposta breve —
    body(`${prefisso}rispostaCorretta`)
      .optional({ nullable: true })
      .isString()
      .withMessage('La risposta corretta deve essere una stringa')
      .bail()
      .trim()
      .isLength({ max: RISPOSTA_MAX })
      .withMessage(`La risposta corretta non può superare i ${RISPOSTA_MAX} caratteri`),

    body(`${prefisso}risposteAlternative`)
      .optional()
      .isArray({ max: MAX_RISPOSTE_ALTERNATIVE })
      .withMessage(`Le risposte alternative devono essere un array (max ${MAX_RISPOSTE_ALTERNATIVE})`),

    body(`${prefisso}risposteAlternative.*`)
      .isString()
      .withMessage('Ogni risposta alternativa deve essere una stringa')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('Le risposte alternative non possono essere vuote')
      .bail()
      .isLength({ max: RISPOSTA_MAX })
      .withMessage(`Ogni risposta alternativa non può superare i ${RISPOSTA_MAX} caratteri`),

    body(`${prefisso}caseSensitive`)
      .optional()
      .isBoolean()
      .withMessage('caseSensitive deve essere booleano')
      .toBoolean(),

    // — Vero/Falso in forma abbreviata —
    body(`${prefisso}rispostaVeroFalso`)
      .optional()
      .isBoolean()
      .withMessage('rispostaVeroFalso deve essere booleano')
      .toBoolean(),

    // — Domande a scelta —
    body(`${prefisso}opzioni`)
      .optional()
      .isArray({ min: OPZIONI_MIN, max: OPZIONI_MAX })
      .withMessage(`Le opzioni devono essere un array (${OPZIONI_MIN}-${OPZIONI_MAX} elementi)`),

    body(`${prefisso}opzioni.*.testo`)
      .isString()
      .withMessage("Il testo dell'opzione deve essere una stringa")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("Il testo dell'opzione è obbligatorio")
      .bail()
      .isLength({ max: 500 })
      .withMessage("Il testo dell'opzione non può superare i 500 caratteri"),

    body(`${prefisso}opzioni.*.corretta`)
      .isBoolean()
      .withMessage("Il campo corretta dell'opzione deve essere booleano")
      .toBoolean(),

    body(`${prefisso}opzioni.*.ordine`)
      .optional()
      .isInt({ min: 0, max: 10000 })
      .withMessage("L'ordine dell'opzione deve essere un intero non negativo")
      .toInt(),

    body(`${prefisso}ordine`)
      .optional()
      .isInt({ min: 0, max: 10000 })
      .withMessage("L'ordine della domanda deve essere un intero non negativo")
      .toInt(),
  ];
};

// ─────────────────────────────────────────────
// Campi condivisi CREA/AGGIORNA quiz
// ─────────────────────────────────────────────
const campoTitolo = (obbligatorio) => {
  const chain = body('titolo');
  if (!obbligatorio) chain.optional();
  return chain
    .trim()
    .notEmpty()
    .withMessage('Il titolo del quiz è obbligatorio')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo del quiz deve avere tra 2 e 160 caratteri');
};

const campiOpzionaliQuiz = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 10000 })
    .withMessage('La descrizione non può superare i 10000 caratteri'),

  body('categoria')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: Quiz.CATEGORIA_MAX })
    .withMessage(`La categoria non può superare i ${Quiz.CATEGORIA_MAX} caratteri`),

  body('materia')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: Quiz.MATERIA_MAX })
    .withMessage(`La materia non può superare i ${Quiz.MATERIA_MAX} caratteri`),

  body('stato')
    .optional()
    .trim()
    .isIn(STATI_QUIZ)
    .withMessage(`Lo stato deve essere uno di: ${STATI_QUIZ.join(', ')}`),

  body('dimensioneRound')
    .optional()
    .isInt({ min: Quiz.DIMENSIONE_ROUND_MIN, max: Quiz.DIMENSIONE_ROUND_MAX })
    .withMessage(
      `La dimensione del round deve essere un intero tra ${Quiz.DIMENSIONE_ROUND_MIN} e ${Quiz.DIMENSIONE_ROUND_MAX}`
    )
    .toInt(),

  body('mescolaDomande')
    .optional()
    .isBoolean()
    .withMessage('mescolaDomande deve essere booleano')
    .toBoolean(),

  body('configurazione')
    .optional()
    .custom(isPlainObject)
    .withMessage('La configurazione deve essere un oggetto JSON'),
];

// ─────────────────────────────────────────────
// POST /api/quiz/gestione
// ─────────────────────────────────────────────
const validateCreaQuiz = [
  campoTitolo(true),
  ...campiOpzionaliQuiz,

  // Presente ⇒ installazione di un template di piattaforma; assente ⇒ quiz
  // personalizzato (motore `domande`).
  body('templateCodice')
    .optional({ nullable: true })
    .trim()
    .isIn(CODICI_TEMPLATE)
    .withMessage(`Il template deve essere uno di: ${CODICI_TEMPLATE.join(', ')}`),

  // Obbligatorio solo per l'admin (che non ha una scuola propria).
  body('scuolaId')
    .optional()
    .isUUID(4)
    .withMessage("L'identificativo della scuola non è valido"),

  body('domande')
    .optional()
    .isArray({ max: MAX_DOMANDE_INLINE })
    .withMessage(`Le domande devono essere un array (max ${MAX_DOMANDE_INLINE} in creazione)`),

  ...campiDomanda('domande.*.', true),
];

// ─────────────────────────────────────────────
// PATCH /api/quiz/gestione/:id
// ─────────────────────────────────────────────
const validateAggiornaQuiz = [
  ...validateQuizIdParam,
  campoTitolo(false),
  ...campiOpzionaliQuiz,

  // Ammesso nel payload solo per essere rifiutato dal service se diverso da
  // quello attuale (il template di un quiz è immutabile).
  body('templateCodice')
    .optional({ nullable: true })
    .trim()
    .isIn(CODICI_TEMPLATE)
    .withMessage(`Il template deve essere uno di: ${CODICI_TEMPLATE.join(', ')}`),
];

// ─────────────────────────────────────────────
// POST   /api/quiz/gestione/:id/domande
// PATCH  /api/quiz/gestione/:id/domande/:domandaId
// ─────────────────────────────────────────────
const validateCreaDomanda = [...validateQuizIdParam, ...campiDomanda('', true)];

const validateAggiornaDomanda = [...validateDomandaParams, ...campiDomanda('', false)];

// ─────────────────────────────────────────────
// POST /api/quiz/gestione/:id/aule
// ─────────────────────────────────────────────
const validateAbilitaPerAula = [
  ...validateQuizIdParam,
  body('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

// ─────────────────────────────────────────────
// GET /api/quiz/gestione        (elenco staff)
// GET /api/quiz/templates       (catalogo)
// GET /api/quiz/disponibili     (vista giocatore)
// ─────────────────────────────────────────────
const validateElencoQuiz = [
  query('stato')
    .optional()
    .trim()
    .isIn(STATI_QUIZ)
    .withMessage(`Lo stato deve essere uno di: ${STATI_QUIZ.join(', ')}`),

  query('categoria')
    .optional()
    .trim()
    .isLength({ max: Quiz.CATEGORIA_MAX })
    .withMessage(`La categoria non può superare i ${Quiz.CATEGORIA_MAX} caratteri`),

  query('materia')
    .optional()
    .trim()
    .isLength({ max: Quiz.MATERIA_MAX })
    .withMessage(`La materia non può superare i ${Quiz.MATERIA_MAX} caratteri`),

  // `personalizzato` filtra i quiz senza template.
  query('template')
    .optional()
    .trim()
    .isIn([...CODICI_TEMPLATE, 'personalizzato'])
    .withMessage(
      `Il filtro template deve essere uno di: ${[...CODICI_TEMPLATE, 'personalizzato'].join(', ')}`
    ),

  query('q')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Il termine di ricerca non può superare i 160 caratteri'),

  query('scuola').optional().isUUID(4).withMessage("L'identificativo della scuola non è valido"),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La pagina deve essere un intero maggiore di zero')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Il limite deve essere un intero tra 1 e 100')
    .toInt(),
];

const validateCatalogoTemplate = [
  query('scuola').optional().isUUID(4).withMessage("L'identificativo della scuola non è valido"),
];

const validateQuizDisponibili = [
  query('categoria')
    .optional()
    .trim()
    .isLength({ max: Quiz.CATEGORIA_MAX })
    .withMessage(`La categoria non può superare i ${Quiz.CATEGORIA_MAX} caratteri`),

  query('materia')
    .optional()
    .trim()
    .isLength({ max: Quiz.MATERIA_MAX })
    .withMessage(`La materia non può superare i ${Quiz.MATERIA_MAX} caratteri`),

  query('scuola').optional().isUUID(4).withMessage("L'identificativo della scuola non è valido"),
];

module.exports = {
  validateQuizIdParam,
  validateDomandaParams,
  validateAbilitazioneParams,
  validateCreaQuiz,
  validateAggiornaQuiz,
  validateCreaDomanda,
  validateAggiornaDomanda,
  validateAbilitaPerAula,
  validateElencoQuiz,
  validateCatalogoTemplate,
  validateQuizDisponibili,
};
