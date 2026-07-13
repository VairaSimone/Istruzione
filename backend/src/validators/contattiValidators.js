'use strict';

const { body, param, query } = require('express-validator');
const { CODICI_TIPO, CODICI_STATO } = require('../constants/tipiRichiestaContatto');

/**
 * Validatori delle RICHIESTE DI CONTATTO (express-validator).
 *
 * L'INVIO è pubblico: i vincoli sono difensivi (lunghezze massime, email valida,
 * tipo tra quelli noti) per fermare payload gonfiati e input malformati prima
 * del service. Il campo `website` è un HONEYPOT anti-bot: deve restare vuoto (la
 * logica di scarto è nel controller, qui ne limitiamo solo la dimensione).
 */

const validateInviaRichiesta = [
  body('nome')
    .exists()
    .withMessage('Il nome è obbligatorio')
    .bail()
    .trim()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il nome deve avere tra 2 e 160 caratteri'),
  body('email')
    .exists()
    .withMessage("L'email è obbligatoria")
    .bail()
    .trim()
    .isEmail()
    .withMessage("L'email non è valida")
    .bail()
    .isLength({ max: 255 })
    .withMessage("L'email non può superare i 255 caratteri")
    .normalizeEmail(),
  body('telefono')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 40 })
    .withMessage('Il telefono non può superare i 40 caratteri'),
  body('messaggio')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 4000 })
    .withMessage('Il messaggio non può superare i 4000 caratteri'),
  body('tipo')
    .optional()
    .isIn(CODICI_TIPO)
    .withMessage(`Il tipo deve essere uno tra: ${CODICI_TIPO.join(', ')}`),
  // Honeypot: presente solo per i bot. Limitiamo la dimensione; il controllo di
  // presenza (scarto silenzioso) avviene nel controller.
  body('website').optional({ nullable: true }).isString().isLength({ max: 200 }),
  // Selettore esplicito del tenant sul dominio globale (facoltativo).
  query('scuola')
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage("L'identificativo della scuola non è valido"),
];

const validateRichiestaIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo della richiesta non è valido"),
];

const validateElencoRichieste = [
  query('scuolaId').optional().isUUID(4).withMessage('scuolaId non è valido'),
  query('stato')
    .optional()
    .isIn(CODICI_STATO)
    .withMessage(`Lo stato deve essere uno tra: ${CODICI_STATO.join(', ')}`),
  query('tipo')
    .optional()
    .isIn(CODICI_TIPO)
    .withMessage(`Il tipo deve essere uno tra: ${CODICI_TIPO.join(', ')}`),
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

const validateAggiornaRichiesta = [
  ...validateRichiestaIdParam,
  body('stato')
    .optional()
    .isIn(CODICI_STATO)
    .withMessage(`Lo stato deve essere uno tra: ${CODICI_STATO.join(', ')}`),
  body('noteInterne')
    .optional({ nullable: true })
    .isString()
    .withMessage('Le note devono essere una stringa')
    .bail()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('Le note non possono superare i 4000 caratteri'),
  body('prendiInCarico')
    .optional()
    .isBoolean()
    .withMessage('Il campo prendiInCarico deve essere booleano')
    .toBoolean(),
  body().custom((value) => {
    const campi = ['stato', 'noteInterne', 'prendiInCarico'];
    if (!value || campi.every((c) => value[c] === undefined)) {
      throw new Error(`Specificare almeno un campo tra: ${campi.join(', ')}`);
    }
    return true;
  }),
];

module.exports = {
  validateInviaRichiesta,
  validateRichiestaIdParam,
  validateElencoRichieste,
  validateAggiornaRichiesta,
};
