'use strict';

const { body, param, query } = require('express-validator');
const Scuola = require('../models/Scuola');
const { normalizzaDominio } = require('../utils/dominio');
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

// ── Regole per le QUOTE (tutte facoltative; null/'' ⇒ illimitato) ──

// Limite di storage in GB: numero >= 0, con un tetto ragionevole (1 PB).
const limiteStorageRule = () =>
  body('limiteStorageGb')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null || v === '') return true;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error('Il limite di storage (GB) deve essere un numero maggiore o uguale a 0');
      }
      if (n > 1024 * 1024) {
        throw new Error('Il limite di storage (GB) è troppo elevato');
      }
      return true;
    });

// Limite intero non negativo (utenti / insegnanti).
const limiteInteroRule = (campo, etichetta) => () =>
  body(campo)
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null || v === '') return true;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`${etichetta} deve essere un numero intero maggiore o uguale a 0`);
      }
      return true;
    });

const limiteUtentiRule = limiteInteroRule('limiteUtenti', 'Il limite utenti');
const limiteInsegnantiRule = limiteInteroRule('limiteInsegnanti', 'Il limite insegnanti');

// Commissione della piattaforma (percentuale, decisa dall'admin): numero in
// [0, 100] con al più 2 decimali, oppure null/'' (nessuna commissione).
const commissionePiattaformaRule = () =>
  body('commissionePiattaformaPercentuale')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null || v === '') return true;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error('La commissione deve essere una percentuale tra 0 e 100');
      }
      return true;
    });

// Dominio personalizzato in fase di creazione (facoltativo).
const dominioRule = () =>
  body('dominio')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null || v === '') return true;
      if (!normalizzaDominio(v)) {
        throw new Error('Il dominio non è valido (es. liceo-manzoni.it)');
      }
      return true;
    });

const validateCreaScuola = [
  nomeScuolaRule(true),
  slugRule(),
  body('attiva').optional().isBoolean().withMessage('Il campo attiva deve essere booleano').toBoolean(),
  body('predefinita')
    .optional()
    .isBoolean()
    .withMessage('Il campo predefinita deve essere booleano')
    .toBoolean(),
  limiteStorageRule(),
  limiteUtentiRule(),
  limiteInsegnantiRule(),
  dominioRule(),
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
  limiteStorageRule(),
  limiteUtentiRule(),
  limiteInsegnantiRule(),
  commissionePiattaformaRule(),
  impostazioniRule('impostazioni', false),
  body().custom((value) => {
    const campi = [
      'nome',
      'slug',
      'impostazioni',
      'attiva',
      'predefinita',
      'limiteStorageGb',
      'limiteUtenti',
      'limiteInsegnanti',
      'commissionePiattaformaPercentuale',
    ];
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
