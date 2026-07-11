'use strict';

const { body, param, query } = require('express-validator');
const Certificato = require('../models/Certificato');

/**
 * Validator delle CERTIFICAZIONI (express-validator), usati prima del middleware
 * `validate`. Messaggi in italiano, sanitizzazione e cast coerenti con lo stile
 * del progetto (cfr. `calendarioValidators`).
 */

const STATI = Certificato.STATI_CERTIFICATO; // ['valido', 'revocato']

// Formato del codice pubblico: CERT-XXXX-XXXX-XXXX (alfabeto senza ambigui).
const CODICE_REGEX = /^CERT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/i;

// Data "solo giorno" in formato ISO (YYYY-MM-DD).
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─────────────────────────────────────────────
// Parametri di rotta
// ─────────────────────────────────────────────
const validateCertificatoIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo del certificato non è valido"),
];

const validateFileIdParam = [
  param('fileId').isUUID(4).withMessage("L'identificativo del file non è valido"),
];

const validateVerificaCodice = [
  param('codice')
    .trim()
    .toUpperCase()
    .matches(CODICE_REGEX)
    .withMessage('Il codice di verifica non è valido (formato atteso: CERT-XXXX-XXXX-XXXX)'),
];

// ─────────────────────────────────────────────
// Rilascio
// ─────────────────────────────────────────────
const validateEmetti = [
  body('utenteId')
    .exists({ checkNull: true })
    .withMessage('Lo studente destinatario (utenteId) è obbligatorio')
    .bail()
    .isUUID(4)
    .withMessage("L'identificativo dello studente non è valido"),

  body('corsoId')
    .optional({ nullable: true })
    .isUUID(4)
    .withMessage("L'identificativo del corso non è valido"),

  body('nomeCorso')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Il nome del percorso deve essere una stringa')
    .isLength({ max: 200 })
    .withMessage('Il nome del percorso non può superare i 200 caratteri'),

  body('esito')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage("L'esito deve essere una stringa")
    .isLength({ max: 120 })
    .withMessage("L'esito non può superare i 120 caratteri"),

  body('titolo')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Il titolo deve essere una stringa')
    .isLength({ max: 200 })
    .withMessage('Il titolo non può superare i 200 caratteri'),

  body('dataCompletamento')
    .optional({ nullable: true })
    .isString()
    .withMessage('La data di completamento deve essere una stringa (AAAA-MM-GG)')
    .bail()
    .matches(DATA_REGEX)
    .withMessage('La data di completamento deve essere nel formato AAAA-MM-GG')
    .bail()
    .isISO8601()
    .withMessage('La data di completamento non è una data valida'),
];

// ─────────────────────────────────────────────
// Revoca
// ─────────────────────────────────────────────
const validateRevoca = [
  param('id').isUUID(4).withMessage("L'identificativo del certificato non è valido"),
  body('motivo')
    .optional({ nullable: true })
    .trim()
    .isString()
    .withMessage('Il motivo deve essere una stringa')
    .isLength({ max: 255 })
    .withMessage('Il motivo non può superare i 255 caratteri'),
];

// ─────────────────────────────────────────────
// Elenco
// ─────────────────────────────────────────────
const validateElenco = [
  query('utenteId').optional().isUUID(4).withMessage("L'identificativo dello studente non è valido"),
  query('corsoId').optional().isUUID(4).withMessage("L'identificativo del corso non è valido"),
  query('scuolaId').optional().isUUID(4).withMessage("L'identificativo della scuola non è valido"),
  query('stato')
    .optional()
    .isIn(STATI)
    .withMessage(`Lo stato deve essere uno di: ${STATI.join(', ')}`),
  query('q')
    .optional()
    .trim()
    .isString()
    .withMessage('Il termine di ricerca deve essere una stringa')
    .isLength({ max: 120 })
    .withMessage('Il termine di ricerca non può superare i 120 caratteri'),
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina deve essere un intero positivo').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Il limite deve essere tra 1 e 100').toInt(),
];

module.exports = {
  validateCertificatoIdParam,
  validateFileIdParam,
  validateVerificaCodice,
  validateEmetti,
  validateRevoca,
  validateElenco,
};
