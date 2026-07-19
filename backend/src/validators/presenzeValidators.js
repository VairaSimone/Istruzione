'use strict';

const { body, param, query } = require('express-validator');
const { CODICI_PRESENZA } = require('../constants/statiPresenza');
const RegistroPresenza = require('../models/RegistroPresenza');
const VocePresenza = require('../models/VocePresenza');

/**
 * Validator del REGISTRO PRESENZE (express-validator), usati prima del
 * middleware `validate`. Messaggi in italiano, coerenti con lo stile del
 * progetto (cfr. `calendarioValidators`).
 */

const ARGOMENTO_MAX = RegistroPresenza.ARGOMENTO_MAX; // 200
const NOTA_MAX = VocePresenza.NOTA_MAX; // 300

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ─────────────────────────────────────────────
// Parametri di rotta
// ─────────────────────────────────────────────
const validateRegistroIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo del registro non è valido"),
];

const validateClasseIdParam = [
  param('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

// ─────────────────────────────────────────────
// Creazione appello
// ─────────────────────────────────────────────
const validateCreaRegistro = [
  body('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),

  body('data')
    .notEmpty()
    .withMessage('La data è obbligatoria')
    .bail()
    .isISO8601()
    .withMessage('La data deve essere valida (ISO 8601)'),

  body('argomento')
    .optional({ nullable: true })
    .isString()
    .withMessage("L'argomento deve essere una stringa")
    .isLength({ max: ARGOMENTO_MAX })
    .withMessage(`L'argomento non può superare i ${ARGOMENTO_MAX} caratteri`),

  body('note')
    .optional({ nullable: true })
    .isString()
    .withMessage('Le note devono essere una stringa')
    .isLength({ max: 5000 })
    .withMessage('Le note non possono superare i 5000 caratteri'),
];

// ─────────────────────────────────────────────
// Aggiornamento appello (metadati)
// ─────────────────────────────────────────────
const validateAggiornaRegistro = [
  ...validateRegistroIdParam,
  body('argomento')
    .optional({ nullable: true })
    .isString()
    .withMessage("L'argomento deve essere una stringa")
    .isLength({ max: ARGOMENTO_MAX })
    .withMessage(`L'argomento non può superare i ${ARGOMENTO_MAX} caratteri`),
  body('note')
    .optional({ nullable: true })
    .isString()
    .withMessage('Le note devono essere una stringa')
    .isLength({ max: 5000 })
    .withMessage('Le note non possono superare i 5000 caratteri'),
];

// ─────────────────────────────────────────────
// Salvataggio voci: array di { utenteId, stato, nota? }
// ─────────────────────────────────────────────
const voceValida = (voce) => {
  if (!isPlainObject(voce)) return false;
  if (typeof voce.utenteId !== 'string' || voce.utenteId.length === 0) return false;
  if (!CODICI_PRESENZA.includes(voce.stato)) return false;
  if (voce.nota !== undefined && voce.nota !== null && typeof voce.nota !== 'string') return false;
  if (typeof voce.nota === 'string' && voce.nota.length > NOTA_MAX) return false;
  return true;
};

const validateSalvaVoci = [
  ...validateRegistroIdParam,
  body('voci')
    .isArray({ min: 1 })
    .withMessage('Le voci devono essere un array non vuoto')
    .bail()
    .custom((arr) => {
      if (!arr.every(voceValida)) {
        throw new Error(
          `Ogni voce deve avere un utenteId (UUID) e uno stato tra: ${CODICI_PRESENZA.join(', ')}`
        );
      }
      return true;
    }),
];

// ─────────────────────────────────────────────
// Elenco registri del docente (filtri opzionali)
// ─────────────────────────────────────────────
const validateElencoRegistri = [
  query('classeId').optional().isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
  query('da').optional().isISO8601().withMessage('Il parametro "da" deve essere una data ISO 8601'),
  query('a').optional().isISO8601().withMessage('Il parametro "a" deve essere una data ISO 8601'),
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina deve essere un intero positivo').toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Il limite deve essere tra 1 e 200').toInt(),
];

// ─────────────────────────────────────────────
// Vista studente (finestra temporale opzionale)
// ─────────────────────────────────────────────
const validateMiePresenze = [
  query('da').optional().isISO8601().withMessage('Il parametro "da" deve essere una data ISO 8601'),
  query('a').optional().isISO8601().withMessage('Il parametro "a" deve essere una data ISO 8601'),
];

module.exports = {
  validateRegistroIdParam,
  validateClasseIdParam,
  validateCreaRegistro,
  validateAggiornaRegistro,
  validateSalvaVoci,
  validateElencoRegistri,
  validateMiePresenze,
};
