'use strict';

const { body, param, query } = require('express-validator');
const { CODICI_EVENTO } = require('../constants/tipiEvento');
const EventoCalendario = require('../models/EventoCalendario');

/**
 * Validator del CALENDARIO (express-validator), usati prima del middleware
 * `validate`. Messaggi in italiano, sanitizzazione e cast coerenti con lo stile
 * del progetto (cfr. `compitiValidators`).
 */

const LINK_MAX = EventoCalendario.LINK_MAX; // 2048

// Pattern esadecimale per il colore opzionale (#RGB o #RRGGBB).
const COLORE_REGEX = EventoCalendario.COLORE_REGEX;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ─────────────────────────────────────────────
// Parametri di rotta
// ─────────────────────────────────────────────
const validateEventoIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo dell'evento non è valido"),
];

const validateDestinatarioParams = [
  param('id').isUUID(4).withMessage("L'identificativo dell'evento non è valido"),
  param('destinatarioId').isUUID(4).withMessage("L'identificativo del destinatario non è valido"),
];

// ─────────────────────────────────────────────
// Campi dell'evento (condivisi crea/aggiorna)
// ─────────────────────────────────────────────
const campoLinkVideochiamata = body('linkVideochiamata')
  .optional({ nullable: true })
  .trim()
  .if((value) => value !== null && value !== '')
  .isURL({ protocols: ['http', 'https'], require_protocol: true })
  .withMessage('Il link della videochiamata deve essere un URL valido (http/https)')
  .bail()
  .isLength({ max: LINK_MAX })
  .withMessage(`Il link non può superare i ${LINK_MAX} caratteri`);

const campiOpzionaliEvento = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 10000 })
    .withMessage('La descrizione non può superare i 10000 caratteri'),

  body('tipo')
    .optional()
    .trim()
    .isIn(CODICI_EVENTO)
    .withMessage(`Il tipo deve essere uno di: ${CODICI_EVENTO.join(', ')}`),

  body('dataFine')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('La data di fine deve essere una data valida (ISO 8601)')
    .toDate(),

  body('tuttoIlGiorno')
    .optional()
    .isBoolean()
    .withMessage('Il campo "tutto il giorno" deve essere booleano')
    .toBoolean(),

  body('luogo')
    .optional({ nullable: true })
    .isString()
    .withMessage('Il luogo deve essere una stringa')
    .isLength({ max: 200 })
    .withMessage('Il luogo non può superare i 200 caratteri'),

  campoLinkVideochiamata,

  body('colore')
    .optional({ nullable: true })
    .trim()
    .if((value) => value !== null && value !== '')
    .matches(COLORE_REGEX)
    .withMessage('Il colore deve essere un valore esadecimale valido (es. #4F46E5)'),
];

// Validazione di una singola voce di destinatario inline: esattamente uno tra
// classeId e utenteId, entrambi UUID se presenti.
const voceDestinatarioValida = (voce) => {
  if (!isPlainObject(voce)) return false;
  const haClasse = typeof voce.classeId === 'string' && voce.classeId.length > 0;
  const haUtente = typeof voce.utenteId === 'string' && voce.utenteId.length > 0;
  return haClasse !== haUtente; // XOR
};

// ─────────────────────────────────────────────
// Creazione evento (con destinatari facoltativi inline)
// ─────────────────────────────────────────────
const validateCreaEvento = [
  body('titolo')
    .trim()
    .notEmpty()
    .withMessage('Il titolo è obbligatorio')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo deve avere tra 2 e 160 caratteri'),

  body('dataInizio')
    .notEmpty()
    .withMessage('La data di inizio è obbligatoria')
    .bail()
    .isISO8601()
    .withMessage('La data di inizio deve essere una data valida (ISO 8601)')
    .toDate(),

  ...campiOpzionaliEvento,

  body('destinatari')
    .optional()
    .isArray()
    .withMessage('I destinatari devono essere un array')
    .bail()
    .custom((arr) => {
      if (!arr.every(voceDestinatarioValida)) {
        throw new Error('Ogni destinatario deve avere esattamente uno tra classeId e utenteId (UUID)');
      }
      return true;
    }),
];

// ─────────────────────────────────────────────
// Aggiornamento evento (tutti i campi opzionali)
// ─────────────────────────────────────────────
const validateAggiornaEvento = [
  ...validateEventoIdParam,
  body('titolo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Il titolo non può essere vuoto')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo deve avere tra 2 e 160 caratteri'),

  body('dataInizio')
    .optional()
    .isISO8601()
    .withMessage('La data di inizio deve essere una data valida (ISO 8601)')
    .toDate(),

  ...campiOpzionaliEvento,
];

// ─────────────────────────────────────────────
// Destinatario (endpoint dedicato): classeId XOR utenteId
// ─────────────────────────────────────────────
const validateAggiungiDestinatario = [
  ...validateEventoIdParam,
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
// Elenco eventi del docente (filtri opzionali)
// ─────────────────────────────────────────────
const validateElencoEventi = [
  query('tipo').optional().trim().isIn(CODICI_EVENTO)
    .withMessage(`Il tipo deve essere uno di: ${CODICI_EVENTO.join(', ')}`),
  query('q').optional().trim().isLength({ max: 160 }).withMessage('La ricerca è troppo lunga'),
  query('da').optional().isISO8601().withMessage('Il parametro "da" deve essere una data ISO 8601').toDate(),
  query('a').optional().isISO8601().withMessage('Il parametro "a" deve essere una data ISO 8601').toDate(),
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina deve essere un intero positivo').toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Il limite deve essere tra 1 e 200').toInt(),
];

// ─────────────────────────────────────────────
// Feed del calendario (studenti + insegnanti)
//   ?da / ?a  → finestra temporale (ISO 8601, facoltativa)
//   ?tipoVoce → filtro sorgente: evento | compito (facoltativo)
// ─────────────────────────────────────────────
const validateFeedCalendario = [
  query('da').optional().isISO8601().withMessage('Il parametro "da" deve essere una data ISO 8601').toDate(),
  query('a').optional().isISO8601().withMessage('Il parametro "a" deve essere una data ISO 8601').toDate(),
  query('tipoVoce').optional().trim().isIn(['evento', 'compito'])
    .withMessage('Il filtro tipoVoce deve essere "evento" o "compito"'),
];

module.exports = {
  validateEventoIdParam,
  validateDestinatarioParams,
  validateCreaEvento,
  validateAggiornaEvento,
  validateAggiungiDestinatario,
  validateElencoEventi,
  validateFeedCalendario,
};
