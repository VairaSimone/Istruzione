'use strict';

const { body, param } = require('express-validator');
const { ALFABETI, GRUPPI_VALIDI } = require('../constants/kanaData');

/**
 * Validator del Quiz Kana (express-validator), usati prima del middleware
 * `validate`. Coerenti con lo stile degli altri validator del progetto.
 */

// Tetto al numero di risposte per round: protegge da payload abnormi.
// (la partita standard è di 20 round; margine di sicurezza incluso)
const MAX_RISPOSTE = 50;

// ─────────────────────────────────────────────
// POST /api/quiz/generate
// ─────────────────────────────────────────────
const validateGenerateQuiz = [
  body('alfabeto')
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
];

// ─────────────────────────────────────────────
// POST /api/quiz/submit
// ─────────────────────────────────────────────
const validateSubmitQuiz = [
  body('risposte')
    .isArray({ min: 1, max: MAX_RISPOSTE })
    .withMessage(`Le risposte devono essere un array (1-${MAX_RISPOSTE} elementi)`),

  body('risposte.*.kana')
    .isString().withMessage('Il kana deve essere una stringa')
    .bail()
    .trim()
    .notEmpty().withMessage('Il kana non può essere vuoto')
    .isLength({ max: 8 }).withMessage('Kana non valido'),

  body('risposte.*.tipo')
    .isIn(ALFABETI).withMessage(`Il tipo deve essere uno di: ${ALFABETI.join(', ')}`),

  body('risposte.*.corretto')
    .isBoolean().withMessage('Il campo corretto deve essere booleano').toBoolean(),

  body('datiBonus').optional().isObject().withMessage('datiBonus deve essere un oggetto'),
  body('datiBonus.maxCombo')
    .optional()
    .isInt({ min: 0, max: 1000 }).withMessage('maxCombo non valido').toInt(),
  body('datiBonus.timerMode')
    .optional()
    .isBoolean().withMessage('timerMode deve essere booleano').toBoolean(),
];

// ─────────────────────────────────────────────
// GET /api/quiz/stroke/:alfabeto
// ─────────────────────────────────────────────
const validateStrokeOrder = [
  param('alfabeto')
    .trim()
    .notEmpty().withMessage("L'alfabeto è obbligatorio")
    .isIn(ALFABETI).withMessage(`L'alfabeto deve essere uno di: ${ALFABETI.join(', ')}`),
];

module.exports = {
  validateGenerateQuiz,
  validateSubmitQuiz,
  validateStrokeOrder,
};
