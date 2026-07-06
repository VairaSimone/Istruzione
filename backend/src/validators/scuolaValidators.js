'use strict';

const { body, param, query } = require('express-validator');

/**
 * Validator delle SCUOLE (express-validator), coerenti con lo stile del
 * progetto: messaggi in italiano, sanitizzazione (`trim`) e cast.
 *
 * Il blob `impostazioni` è volutamente libero: si verifica solo che sia un
 * oggetto JSON (non array, non null) e che non superi una dimensione ragionevole.
 * La semantica delle chiavi è demandata all'applicazione (schema aperto).
 */

const DIMENSIONE_MAX_IMPOSTAZIONI = 20000; // ~20KB serializzati

const nomeScuolaRule = (obbligatorio) => {
  const chain = body('nome');
  if (!obbligatorio) chain.optional();
  return chain
    .trim()
    .notEmpty()
    .withMessage('Il nome della scuola è obbligatorio')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il nome della scuola deve avere tra 2 e 160 caratteri');
};

const impostazioniRule = (campo = 'impostazioni', obbligatorio = false) => {
  const chain = body(campo);
  if (!obbligatorio) chain.optional();
  else chain.exists().withMessage('Le impostazioni sono obbligatorie').bail();
  return chain
    .custom((value) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Le impostazioni devono essere un oggetto JSON (coppie chiave/valore)');
      }
      if (JSON.stringify(value).length > DIMENSIONE_MAX_IMPOSTAZIONI) {
        throw new Error('Le impostazioni superano la dimensione massima consentita');
      }
      return true;
    });
};

const validateScuolaIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo della scuola non è valido"),
];

const validateCreaScuola = [
  nomeScuolaRule(true),
  impostazioniRule('impostazioni', false),
];

const validateAggiornaScuola = [
  ...validateScuolaIdParam,
  nomeScuolaRule(false),
  impostazioniRule('impostazioni', false),
  body().custom((value) => {
    if (!value || (value.nome === undefined && value.impostazioni === undefined)) {
      throw new Error('Specificare almeno un campo tra nome e impostazioni');
    }
    return true;
  }),
];

const validateAggiornaImpostazioni = [
  ...validateScuolaIdParam,
  impostazioniRule('impostazioni', true),
];

const validateElencoScuole = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Il termine di ricerca non può superare i 160 caratteri'),
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
  validateScuolaIdParam,
  validateCreaScuola,
  validateAggiornaScuola,
  validateAggiornaImpostazioni,
  validateElencoScuole,
};
