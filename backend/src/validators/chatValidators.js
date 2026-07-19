'use strict';

const { body, param, query } = require('express-validator');
const { TIPI_FILE } = require('../config/upload');

/**
 * Validator della CHAT D'AULA (express-validator). Messaggi in italiano,
 * sanitizzazione e cast coerenti col resto del progetto. Le regole di
 * autorizzazione (appartenenza all'aula, tenant, permessi di eliminazione)
 * restano nel service: qui si valida solo la FORMA dell'input.
 */

// Lunghezza massima del testo di un messaggio di chat (coerente con la
// messaggistica interna: TEXT sul DB, cap applicativo per evitare abusi).
const MAX_CORPO = 5000;

const validateClasseIdParam = [
  param('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

const validateMessaggioIdParam = [
  param('messaggioId').isUUID(4).withMessage("L'identificativo del messaggio non è valido"),
];

const validateFileIdParam = [
  param('fileId').isUUID(4).withMessage("L'identificativo del file non è valido"),
];

// Il tipo di allegato deve essere uno dei tipi di file gestiti dalla
// piattaforma (immagine / documento / video): seleziona l'uploader corretto.
const validateTipoAllegatoParam = [
  param('tipo')
    .isIn(TIPI_FILE)
    .withMessage(`Il tipo di allegato deve essere uno di: ${TIPI_FILE.join(', ')}`),
];

// ─────────────────────────────────────────────
// Invio messaggio SOLO TESTO
// ─────────────────────────────────────────────
const validateInviaMessaggio = [
  ...validateClasseIdParam,
  body('corpo')
    .trim()
    .notEmpty()
    .withMessage('Il messaggio non può essere vuoto')
    .bail()
    .isLength({ max: MAX_CORPO })
    .withMessage(`Il messaggio non può superare i ${MAX_CORPO} caratteri`),
];

// ─────────────────────────────────────────────
// Invio messaggio CON ALLEGATO (testo facoltativo; il file è verificato dal
// middleware di upload + quota e la sua presenza dal controller)
// ─────────────────────────────────────────────
const validateInviaMessaggioAllegato = [
  ...validateClasseIdParam,
  ...validateTipoAllegatoParam,
  body('corpo')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: MAX_CORPO })
    .withMessage(`Il messaggio non può superare i ${MAX_CORPO} caratteri`),
];

// ─────────────────────────────────────────────
// Elenco messaggi (feed) con cursore per lo scroll all'indietro
// ─────────────────────────────────────────────
const validateElencoMessaggi = [
  ...validateClasseIdParam,
  // Cursore: carica i messaggi PRECEDENTI a questa data (paginazione all'indietro).
  query('primaDi')
    .optional()
    .isISO8601()
    .withMessage('primaDi deve essere una data ISO 8601 valida'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve essere un intero tra 1 e 100')
    .toInt(),
];

module.exports = {
  validateClasseIdParam,
  validateMessaggioIdParam,
  validateFileIdParam,
  validateTipoAllegatoParam,
  validateInviaMessaggio,
  validateInviaMessaggioAllegato,
  validateElencoMessaggi,
};
