'use strict';

const { body, param, query } = require('express-validator');
const Scuola = require('../models/Scuola');
const { normalizzaImpostazioni } = require('../constants/impostazioniScuola');

/**
 * Validator delle SCUOLE (express-validator), coerenti con lo stile del
 * progetto: messaggi in italiano, sanitizzazione (`trim`) e cast.
 *
 * Il blob `impostazioni` NON è più libero: è validato contro lo schema
 * dichiarativo di `constants/impostazioniScuola.js`. Qui si esegue una
 * validazione "in anticipo" (per restituire 422 prima di toccare il service) e
 * si applica un tetto alla dimensione serializzata, come difesa da payload
 * gonfiati. La verità sui singoli campi resta una sola: lo schema.
 */

const DIMENSIONE_MAX_IMPOSTAZIONI = 40000; // ~40KB serializzati

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

const slugRule = () =>
  body('slug')
    .optional()
    .trim()
    .isLength({ min: 2, max: Scuola.SLUG_MAX })
    .withMessage(`Lo slug deve avere tra 2 e ${Scuola.SLUG_MAX} caratteri`)
    .bail()
    .matches(Scuola.SLUG_REGEX)
    .withMessage('Lo slug può contenere solo lettere minuscole, cifre e trattini (es. liceo-manzoni)');

const impostazioniRule = (campo = 'impostazioni', obbligatorio = false) => {
  const chain = body(campo);
  if (!obbligatorio) chain.optional();
  else chain.exists().withMessage('Le impostazioni sono obbligatorie').bail();
  return chain.custom((value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Le impostazioni devono essere un oggetto JSON (coppie chiave/valore)');
    }
    if (JSON.stringify(value).length > DIMENSIONE_MAX_IMPOSTAZIONI) {
      throw new Error('Le impostazioni superano la dimensione massima consentita');
    }
    // Validazione contro lo schema: rilancia un messaggio leggibile sul campo
    // colpevole (es. «aspetto.colorePrimario — deve essere un colore esadecimale»).
    try {
      normalizzaImpostazioni(value);
    } catch (err) {
      throw new Error(err.message);
    }
    return true;
  });
};

const validateScuolaIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo della scuola non è valido"),
];

const validateCreaScuola = [
  nomeScuolaRule(true),
  slugRule(),
  body('attiva').optional().isBoolean().withMessage('Il campo attiva deve essere booleano').toBoolean(),
  body('predefinita')
    .optional()
    .isBoolean()
    .withMessage('Il campo predefinita deve essere booleano')
    .toBoolean(),
  impostazioniRule('impostazioni', false),
];

const validateAggiornaScuola = [
  ...validateScuolaIdParam,
  nomeScuolaRule(false),
  slugRule(),
  body('attiva').optional().isBoolean().withMessage('Il campo attiva deve essere booleano').toBoolean(),
  body('predefinita')
    .optional()
    .isBoolean()
    .withMessage('Il campo predefinita deve essere booleano')
    .toBoolean(),
  impostazioniRule('impostazioni', false),
  body().custom((value) => {
    const campi = ['nome', 'slug', 'impostazioni', 'attiva', 'predefinita'];
    if (!value || campi.every((c) => value[c] === undefined)) {
      throw new Error(`Specificare almeno un campo tra: ${campi.join(', ')}`);
    }
    return true;
  }),
];

const validateAggiornaImpostazioni = [
  ...validateScuolaIdParam,
  impostazioniRule('impostazioni', true),
];

/** Merge sulle impostazioni della PROPRIA scuola: nessun `:id` nel percorso. */
const validateAggiornaMieImpostazioni = [impostazioniRule('impostazioni', true)];

const validateElencoScuole = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Il termine di ricerca non può superare i 160 caratteri'),
  query('attiva')
    .optional()
    .isBoolean()
    .withMessage('Il filtro attiva deve essere booleano')
    .toBoolean(),
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
  validateAggiornaMieImpostazioni,
  validateElencoScuole,
};
