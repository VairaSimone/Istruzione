'use strict';

const { body, param, query } = require('express-validator');
const Compito = require('../models/Compito');

/**
 * Validator dei COMPITI (express-validator), usati prima del middleware
 * `validate`. Messaggi in italiano, sanitizzazione e cast coerenti con lo
 * stile del progetto.
 */

const TIPI_ATTIVITA = Compito.TIPI_ATTIVITA;
const STATI_COMPITO = Compito.STATI_COMPITO;
// Stati PER STUDENTE (derivati) accettati come filtro.
const STATI_STUDENTE = ['assegnato', 'completato', 'in_scadenza', 'scaduto'];

// Dimensione massima serializzata della configurazione attività (16 KB).
const MAX_CONFIG_BYTES = 16 * 1024;

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

// ─────────────────────────────────────────────
// Parametri di rotta
// ─────────────────────────────────────────────
const validateCompitoIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo del compito non è valido"),
];

const validateAssegnazioneParams = [
  param('id').isUUID(4).withMessage("L'identificativo del compito non è valido"),
  param('assegnazioneId').isUUID(4).withMessage("L'identificativo dell'assegnazione non è valido"),
];

const validateConsegnaParams = [
  param('id').isUUID(4).withMessage("L'identificativo del compito non è valido"),
  param('utenteId').isUUID(4).withMessage("L'identificativo dello studente non è valido"),
];

// ─────────────────────────────────────────────
// Campi del compito (condivisi crea/aggiorna)
// ─────────────────────────────────────────────
const campoConfigurazione = body('configurazione')
  .optional({ nullable: true })
  .custom((value) => {
    if (!isPlainObject(value)) {
      throw new Error('La configurazione deve essere un oggetto');
    }
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_CONFIG_BYTES) {
      throw new Error('La configurazione è troppo grande (max 16 KB)');
    }
    return true;
  });

const campiOpzionaliCompito = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 10000 })
    .withMessage('La descrizione non può superare i 10000 caratteri'),

  campoConfigurazione,

  body('tempoLimiteMinuti')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 1440 })
    .withMessage('Il tempo limite deve essere un intero tra 1 e 1440 minuti')
    .toInt(),

  body('punteggioMassimo')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Il punteggio massimo deve essere un intero tra 1 e 1000')
    .toInt(),

  body('stato')
    .optional()
    .trim()
    .isIn(STATI_COMPITO)
    .withMessage(`Lo stato deve essere uno di: ${STATI_COMPITO.join(', ')}`),
];

// Validazione di una singola voce di assegnazione inline: esattamente uno tra
// classeId e utenteId, entrambi UUID se presenti.
const voceAssegnazioneValida = (voce) => {
  if (!isPlainObject(voce)) return false;
  const haClasse = typeof voce.classeId === 'string' && voce.classeId.length > 0;
  const haUtente = typeof voce.utenteId === 'string' && voce.utenteId.length > 0;
  return haClasse !== haUtente; // XOR
};

const validateCreaCompito = [
  body('titolo')
    .trim()
    .notEmpty()
    .withMessage('Il titolo è obbligatorio')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo deve avere tra 2 e 160 caratteri'),

  body('tipoAttivita')
    .trim()
    .notEmpty()
    .withMessage("Il tipo di attività è obbligatorio")
    .bail()
    .isIn(TIPI_ATTIVITA)
    .withMessage(`Il tipo di attività deve essere uno di: ${TIPI_ATTIVITA.join(', ')}`),

  body('dataScadenza')
    .notEmpty()
    .withMessage('La data di scadenza è obbligatoria')
    .bail()
    .isISO8601()
    .withMessage('La data di scadenza deve essere una data valida (ISO 8601)')
    .toDate(),

  ...campiOpzionaliCompito,

  body('assegnazioni')
    .optional()
    .isArray()
    .withMessage('Le assegnazioni devono essere un array')
    .bail()
    .custom((arr) => {
      if (!arr.every(voceAssegnazioneValida)) {
        throw new Error('Ogni assegnazione deve avere esattamente uno tra classeId e utenteId (UUID)');
      }
      return true;
    }),
];

const validateAggiornaCompito = [
  ...validateCompitoIdParam,
  body('titolo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Il titolo non può essere vuoto')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo deve avere tra 2 e 160 caratteri'),

  body('tipoAttivita')
    .optional()
    .trim()
    .isIn(TIPI_ATTIVITA)
    .withMessage(`Il tipo di attività deve essere uno di: ${TIPI_ATTIVITA.join(', ')}`),

  body('dataScadenza')
    .optional()
    .isISO8601()
    .withMessage('La data di scadenza deve essere una data valida (ISO 8601)')
    .toDate(),

  ...campiOpzionaliCompito,
];

// ─────────────────────────────────────────────
// Assegnazione (endpoint dedicato): classeId XOR utenteId
// ─────────────────────────────────────────────
const validateAssegna = [
  ...validateCompitoIdParam,
  body('classeId').optional().isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
  body('utenteId').optional().isUUID(4).withMessage("L'identificativo dello studente non è valido"),
  body().custom((value) => {
    const haClasse = !!(value && value.classeId);
    const haUtente = !!(value && value.utenteId);
    if (haClasse === haUtente) {
      throw new Error('Specificare esattamente uno tra classeId e utenteId');
    }
    return true;
  }),
];

// ─────────────────────────────────────────────
// Valutazione consegna (docente)
// ─────────────────────────────────────────────
const validateValutaConsegna = [
  ...validateConsegnaParams,
  body('punteggioOttenuto')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Il punteggio ottenuto deve essere un intero tra 0 e 1000')
    .toInt(),
  body('feedback')
    .optional({ nullable: true })
    .isString()
    .withMessage('Il feedback deve essere una stringa')
    .isLength({ max: 5000 })
    .withMessage('Il feedback non può superare i 5000 caratteri'),
  body().custom((value) => {
    if (!value || (value.punteggioOttenuto === undefined && value.feedback === undefined)) {
      throw new Error('Specificare almeno un campo tra punteggioOttenuto e feedback');
    }
    return true;
  }),
];

// ─────────────────────────────────────────────
// Consegna studente
// ─────────────────────────────────────────────
const validateConsegnaStudente = [
  ...validateCompitoIdParam,
  body('punteggioOttenuto')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Il punteggio ottenuto deve essere un intero tra 0 e 1000')
    .toInt(),
  body('tempoImpiegatoSecondi')
    .optional()
    .isInt({ min: 0, max: 86400 })
    .withMessage('Il tempo impiegato deve essere un intero tra 0 e 86400 secondi')
    .toInt(),
];

// ─────────────────────────────────────────────
// Filtri elenco compiti (docente)
// ─────────────────────────────────────────────
const validateElencoCompiti = [
  query('stato')
    .optional()
    .trim()
    .isIn(STATI_COMPITO)
    .withMessage(`Lo stato deve essere uno di: ${STATI_COMPITO.join(', ')}`),
  query('tipo')
    .optional()
    .trim()
    .isIn(TIPI_ATTIVITA)
    .withMessage(`Il tipo deve essere uno di: ${TIPI_ATTIVITA.join(', ')}`),
  query('q')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Il termine di ricerca non può superare i 160 caratteri'),
  query('page').optional().isInt({ min: 1 }).withMessage('page deve essere un intero positivo').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve essere un intero tra 1 e 100')
    .toInt(),
];

// ─────────────────────────────────────────────
// Filtri elenco compiti (studente)
// ─────────────────────────────────────────────
const validateElencoStudente = [
  query('stato')
    .optional()
    .trim()
    .isIn(STATI_STUDENTE)
    .withMessage(`Lo stato deve essere uno di: ${STATI_STUDENTE.join(', ')}`),
  query('page').optional().isInt({ min: 1 }).withMessage('page deve essere un intero positivo').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve essere un intero tra 1 e 100')
    .toInt(),
];

module.exports = {
  validateCompitoIdParam,
  validateAssegnazioneParams,
  validateConsegnaParams,
  validateCreaCompito,
  validateAggiornaCompito,
  validateAssegna,
  validateValutaConsegna,
  validateConsegnaStudente,
  validateElencoCompiti,
  validateElencoStudente,
};
