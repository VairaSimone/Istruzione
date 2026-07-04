'use strict';

const { body, param, query } = require('express-validator');
const Classe = require('../models/Classe');

/**
 * Validator delle AULE (express-validator), usati prima del middleware
 * `validate`. Coerenti con lo stile degli altri validator del progetto:
 * messaggi in italiano, sanitizzazione (`trim`) e cast (`toInt`/`toBoolean`).
 */

const LIVELLI_JLPT = Classe.LIVELLI_JLPT;

// ─────────────────────────────────────────────
// Parametri di rotta (UUID)
// ─────────────────────────────────────────────
const validateClasseIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

const validateMembroParams = [
  param('id').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
  param('utenteId').isUUID(4).withMessage("L'identificativo dell'utente non è valido"),
];

// ─────────────────────────────────────────────
// Campi condivisi CREA/AGGIORNA aula
// ─────────────────────────────────────────────
const campoNome = (obbligatorio) => {
  const chain = body('nome');
  if (!obbligatorio) chain.optional();
  return chain
    .trim()
    .notEmpty()
    .withMessage("Il nome dell'aula è obbligatorio")
    .bail()
    .isLength({ min: 2, max: 120 })
    .withMessage("Il nome dell'aula deve avere tra 2 e 120 caratteri");
};

const campiOpzionaliAula = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 5000 })
    .withMessage('La descrizione non può superare i 5000 caratteri'),

  body('annoScolastico')
    .optional({ nullable: true })
    .trim()
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage("L'anno scolastico deve essere nel formato AAAA/AAAA (es. 2025/2026)"),

  body('livelloJLPT')
    .optional({ nullable: true })
    .trim()
    .isIn(LIVELLI_JLPT)
    .withMessage(`Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`),

  body('colore')
    .optional({ nullable: true })
    .trim()
    .matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .withMessage('Il colore deve essere un valore esadecimale valido (es. #4F46E5)'),

  body('icona')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage("Il nome dell'icona non può superare i 50 caratteri"),
];

const validateCreaClasse = [campoNome(true), ...campiOpzionaliAula];

const validateAggiornaClasse = [
  ...validateClasseIdParam,
  campoNome(false),
  ...campiOpzionaliAula,
  body('archiviata')
    .optional()
    .isBoolean()
    .withMessage('Il campo archiviata deve essere un booleano')
    .toBoolean(),
];

// ─────────────────────────────────────────────
// Aggiunta membro registrato (studente/insegnante): serve utenteId O email
// ─────────────────────────────────────────────
const validateAggiungiMembro = [
  ...validateClasseIdParam,
  body('utenteId')
    .optional()
    .isUUID(4)
    .withMessage("L'identificativo dell'utente non è valido"),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Formato email non valido'),
  body().custom((value) => {
    if (!value || (!value.utenteId && !value.email)) {
      throw new Error('Specificare utenteId oppure email');
    }
    return true;
  }),
];

// ─────────────────────────────────────────────
// Invito studente in aula (via email)
// ─────────────────────────────────────────────
const validateInvitoStudenteAula = [
  ...validateClasseIdParam,
  body('email')
    .trim()
    .notEmpty()
    .withMessage("L'email è obbligatoria")
    .bail()
    .isEmail()
    .withMessage('Formato email non valido'),
];

// ─────────────────────────────────────────────
// Filtri elenco aule
// ─────────────────────────────────────────────
const validateElencoClassi = [
  query('livello')
    .optional()
    .trim()
    .isIn(LIVELLI_JLPT)
    .withMessage(`Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`),

  query('anno')
    .optional()
    .trim()
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage("L'anno scolastico deve essere nel formato AAAA/AAAA (es. 2025/2026)"),

  query('archiviata')
    .optional()
    .isBoolean()
    .withMessage('Il filtro archiviata deve essere un booleano')
    .toBoolean(),

  query('q')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Il termine di ricerca non può superare i 120 caratteri'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Il parametro page deve essere un intero positivo')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Il parametro limit deve essere un intero tra 1 e 100')
    .toInt(),
];

module.exports = {
  validateClasseIdParam,
  validateMembroParams,
  validateCreaClasse,
  validateAggiornaClasse,
  validateAggiungiMembro,
  validateInvitoStudenteAula,
  validateElencoClassi,
};
