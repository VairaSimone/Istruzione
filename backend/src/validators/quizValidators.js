'use strict';

const { body, param, query } = require('express-validator');
const { ALFABETI, GRUPPI_VALIDI } = require('../constants/kanaData');
const { LIVELLI_DISPONIBILI } = require('../constants/kanjiData');
const { DOMINI, TIPI_QUIZ_KANJI } = require('../services/quizService');

/**
 * Validator del Quiz (express-validator), usati prima del middleware `validate`.
 * Coerenti con lo stile degli altri validator del progetto.
 *
 * Il Quiz supporta due domini sullo STESSO endpoint:
 *   - 'kana'  (default, retrocompatibile): filtri alfabeto/gruppi/dakuon/yoon;
 *   - 'kanji':                              filtri livello (JLPT)/tipoQuiz/lingua.
 * La validazione è condizionale su `dominio`: quando il campo è assente si
 * applicano le regole kana, così le richieste esistenti restano valide.
 */

// Tetto al numero di risposte per round: protegge da payload abnormi.
// (la partita standard è di 20 round; margine di sicurezza incluso)
const MAX_RISPOSTE = 50;

// Lingue ammesse per i significati dei kanji.
const LINGUE_QUIZ = ['it', 'en'];

// Predicati condizionali riusabili.
//
// Le regole "storiche" (kana/kanji/banca nel body) valgono SOLO quando la
// partita non nasce da un quiz della scuola: con `quizId` il motore, i filtri e
// la forma delle risposte li decide il quiz, e la validazione semantica è nel
// service. Il dominio predefinito (assente) è 'kana' (retrocompatibilità).
const senzaQuiz = (chain) => chain.if(body('quizId').not().exists());
const seKanji = (chain) => senzaQuiz(chain).if((v, { req }) => req.body.dominio === 'kanji');
const seBanca = (chain) => senzaQuiz(chain).if((v, { req }) => req.body.dominio === 'banca');
const seKana = (chain) =>
  senzaQuiz(chain).if((v, { req }) => !req.body.dominio || req.body.dominio === 'kana');

// Identificativo del quiz della scuola (facoltativo su generate/submit).
const campoQuizId = () =>
  body('quizId')
    .optional()
    .isUUID(4)
    .withMessage("L'identificativo del quiz non è valido");

// ─────────────────────────────────────────────
// POST /api/quiz/generate
// ─────────────────────────────────────────────
const validateGenerateQuiz = [
  campoQuizId(),

  body('dominio')
    .optional()
    .isIn(DOMINI).withMessage(`Il dominio deve essere uno di: ${DOMINI.join(', ')}`),

  // — Dominio kana (default) —
  seKana(body('alfabeto'))
    .trim()
    .notEmpty().withMessage("L'alfabeto è obbligatorio")
    .isIn(ALFABETI).withMessage(`L'alfabeto deve essere uno di: ${ALFABETI.join(', ')}`),

  body('gruppi')
    .optional()
    .isArray({ max: GRUPPI_VALIDI.length })
    .withMessage('I gruppi devono essere un array'),

  body('gruppi.*')
    .optional()
    .isIn(GRUPPI_VALIDI)
    .withMessage(`Ogni gruppo deve essere uno di: ${GRUPPI_VALIDI.join(', ')}`),

  body('includiDakuon').optional().isBoolean().withMessage('includiDakuon deve essere booleano').toBoolean(),
  body('includiYoon').optional().isBoolean().withMessage('includiYoon deve essere booleano').toBoolean(),

  // — Dominio kanji —
  seKanji(body('livello'))
    .trim()
    .notEmpty().withMessage('Il livello JLPT è obbligatorio')
    .isIn(LIVELLI_DISPONIBILI)
    .withMessage(`Il livello deve essere uno di: ${LIVELLI_DISPONIBILI.join(', ')}`),

  seKanji(body('tipoQuiz'))
    .optional()
    .isIn(TIPI_QUIZ_KANJI)
    .withMessage(`Il tipo di quiz deve essere uno di: ${TIPI_QUIZ_KANJI.join(', ')}`),

  body('lingua')
    .optional()
    .isIn(LINGUE_QUIZ).withMessage(`La lingua deve essere una di: ${LINGUE_QUIZ.join(', ')}`),

  // — Motore banca —
  // `bancaCodice` è obbligatorio SOLO nell'esercizio libero (dominio='banca'
  // senza quizId): con un quizId la banca è fissata dal template.
  seBanca(body('bancaCodice'))
    .trim()
    .notEmpty().withMessage('Il codice della banca è obbligatorio')
    .isLength({ max: 64 }).withMessage('Codice della banca non valido'),

  // Modalità e sezioni valgono sia in esercizio libero sia come override di un
  // quiz da template: la validazione semantica (contro la banca) è nel service.
  body('modalita')
    .optional()
    .isString().withMessage('La modalità deve essere una stringa')
    .bail()
    .trim()
    .isLength({ max: 64 }).withMessage('Modalità non valida'),

  body('sezioni')
    .optional()
    .isArray({ max: 60 }).withMessage('Le sezioni devono essere un array'),
  body('sezioni.*')
    .optional()
    .isString().withMessage('Ogni sezione deve essere una stringa')
    .bail()
    .trim()
    .isLength({ max: 64 }).withMessage('Sezione non valida'),
];

// ─────────────────────────────────────────────
// POST /api/quiz/submit
// ─────────────────────────────────────────────
const validateSubmitQuiz = [
  campoQuizId(),

  body('dominio')
    .optional()
    .isIn(DOMINI).withMessage(`Il dominio deve essere uno di: ${DOMINI.join(', ')}`),

  body('risposte')
    .isArray({ min: 1, max: MAX_RISPOSTE })
    .withMessage(`Le risposte devono essere un array (1-${MAX_RISPOSTE} elementi)`),

  // — Partita da un quiz della scuola —
  // Forma: { domandaId, opzioneId? , testo? }. Per i quiz da template (motore
  // kana/kanji) restano validi anche i campi storici, che qui non sono imposti:
  // la coerenza la verifica il service, che ignora le risposte non riconosciute.
  body('risposte.*.domandaId')
    .if(body('quizId').exists())
    .optional()
    .isUUID(4).withMessage("L'identificativo della domanda non è valido"),

  body('risposte.*.opzioneId')
    .if(body('quizId').exists())
    .optional({ nullable: true })
    .isUUID(4).withMessage("L'identificativo dell'opzione non è valido"),

  body('risposte.*.testo')
    .if(body('quizId').exists())
    .optional({ nullable: true })
    .isString().withMessage('La risposta deve essere una stringa')
    .bail()
    .trim()
    .isLength({ max: 255 }).withMessage('La risposta non può superare i 255 caratteri'),

  // — Percorso storico (senza `quizId`): campo comune a kana e kanji —
  senzaQuiz(body('risposte.*.corretto'))
    .isBoolean().withMessage('Il campo corretto deve essere booleano').toBoolean(),

  // — Dominio kana (default) —
  seKana(body('risposte.*.kana'))
    .isString().withMessage('Il kana deve essere una stringa')
    .bail()
    .trim()
    .notEmpty().withMessage('Il kana non può essere vuoto')
    .isLength({ max: 8 }).withMessage('Kana non valido'),

  seKana(body('risposte.*.tipo'))
    .isIn(ALFABETI).withMessage(`Il tipo deve essere uno di: ${ALFABETI.join(', ')}`),

  // — Dominio kanji —
  seKanji(body('risposte.*.kanji'))
    .isString().withMessage('Il kanji deve essere una stringa')
    .bail()
    .trim()
    .notEmpty().withMessage('Il kanji non può essere vuoto')
    .isLength({ max: 8 }).withMessage('Kanji non valido'),

  seKanji(body('risposte.*.livelloJLPT'))
    .isIn(LIVELLI_DISPONIBILI)
    .withMessage(`Il livello deve essere uno di: ${LIVELLI_DISPONIBILI.join(', ')}`),

  // — Motore banca (esercizio libero, senza quizId) —
  // `voceId` identifica la voce risposta; la sua esistenza nella banca è
  // verificata dal service (anti-manipolazione). `corretto` è già coperto sopra.
  seBanca(body('risposte.*.voceId'))
    .isString().withMessage("L'identificatore della voce deve essere una stringa")
    .bail()
    .trim()
    .notEmpty().withMessage("L'identificatore della voce non può essere vuoto")
    .isLength({ max: 128 }).withMessage('Identificatore della voce non valido'),

  body('datiBonus').optional().isObject().withMessage('datiBonus deve essere un oggetto'),
  body('datiBonus.maxCombo')
    .optional()
    .isInt({ min: 0, max: 1000 }).withMessage('maxCombo non valido').toInt(),
  body('datiBonus.timerMode')
    .optional()
    .isBoolean().withMessage('timerMode deve essere booleano').toBoolean(),
];

// ─────────────────────────────────────────────
// GET /api/quiz/stroke/:alfabeto  (kana)
// ─────────────────────────────────────────────
const validateStrokeOrder = [
  param('alfabeto')
    .trim()
    .notEmpty().withMessage("L'alfabeto è obbligatorio")
    .isIn(ALFABETI).withMessage(`L'alfabeto deve essere uno di: ${ALFABETI.join(', ')}`),
];

// ─────────────────────────────────────────────
// GET /api/quiz/stroke/kanji/:livello  (kanji)
// ─────────────────────────────────────────────
const validateStrokeOrderKanji = [
  param('livello')
    .trim()
    .notEmpty().withMessage('Il livello JLPT è obbligatorio')
    .isIn(LIVELLI_DISPONIBILI)
    .withMessage(`Il livello deve essere uno di: ${LIVELLI_DISPONIBILI.join(', ')}`),

  query('lingua')
    .optional()
    .isIn(LINGUE_QUIZ).withMessage(`La lingua deve essere una di: ${LINGUE_QUIZ.join(', ')}`),
];

// ─────────────────────────────────────────────
// POST /api/quiz/scrittura
// Numero di tratti validati sul canvas in una sessione. Tetto rigido (50)
// allineato al limite difensivo del gamificationService.
// ─────────────────────────────────────────────
const MAX_TRATTI_SCRITTURA = 50;
const MAX_CARATTERI_ERRATI = 50;

const validateRegistraScrittura = [
  body('trattiValidati')
    .exists().withMessage('Il numero di tratti validati è obbligatorio')
    .bail()
    .isInt({ min: 1, max: MAX_TRATTI_SCRITTURA })
    .withMessage(`I tratti validati devono essere un intero tra 1 e ${MAX_TRATTI_SCRITTURA}`)
    .toInt(),

  // Caratteri con ordine dei tratti sbagliato nella sessione (facoltativo).
  body('caratteriErrati')
    .optional()
    .isArray({ max: MAX_CARATTERI_ERRATI })
    .withMessage(`caratteriErrati deve essere un array (max ${MAX_CARATTERI_ERRATI})`),

  body('caratteriErrati.*.kana')
    .if(body('caratteriErrati').exists())
    .isString().withMessage('Il kana deve essere una stringa')
    .bail()
    .trim()
    .notEmpty().withMessage('Il kana non può essere vuoto')
    .isLength({ max: 8 }).withMessage('Kana non valido'),

  body('caratteriErrati.*.tipo')
    .if(body('caratteriErrati').exists())
    .isIn(ALFABETI).withMessage(`Il tipo deve essere uno di: ${ALFABETI.join(', ')}`),
];

module.exports = {
  validateGenerateQuiz,
  validateSubmitQuiz,
  validateStrokeOrder,
  validateStrokeOrderKanji,
  validateRegistraScrittura,
};
