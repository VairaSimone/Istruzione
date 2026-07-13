'use strict';

const { body, param } = require('express-validator');
const { DOMINIO_MAX, dominioValido } = require('../utils/dominio');

/**
 * Validatori dei DOMINI (express-validator), coerenti con lo stile del progetto:
 * messaggi in italiano, sanitizzazione e cast. La normalizzazione vera del
 * dominio avviene nel modello/service; qui si intercettano gli input palesemente
 * invalidi con un 422 leggibile prima di toccare il database.
 */

const validateDominioIdParam = [
  param('dominioId').isUUID(4).withMessage("L'identificativo del dominio non è valido"),
];

const dominioRule = () =>
  body('dominio')
    .exists()
    .withMessage('Il dominio è obbligatorio')
    .bail()
    .isString()
    .withMessage('Il dominio deve essere una stringa')
    .bail()
    .trim()
    .isLength({ min: 3, max: DOMINIO_MAX })
    .withMessage(`Il dominio deve avere tra 3 e ${DOMINIO_MAX} caratteri`)
    .bail()
    .custom((value) => {
      if (!dominioValido(value)) {
        throw new Error('Il dominio non è valido (es. liceo-manzoni.it)');
      }
      return true;
    });

const validateAggiungiDominio = [
  dominioRule(),
  body('principale')
    .optional()
    .isBoolean()
    .withMessage('Il campo principale deve essere booleano')
    .toBoolean(),
  body('note')
    .optional({ nullable: true })
    .isString()
    .withMessage('Le note devono essere una stringa')
    .bail()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Le note non possono superare i 255 caratteri'),
];

const validateAggiornaDominio = [
  ...validateDominioIdParam,
  body('verificato')
    .optional()
    .isBoolean()
    .withMessage('Il campo verificato deve essere booleano')
    .toBoolean(),
  body('principale')
    .optional()
    .isBoolean()
    .withMessage('Il campo principale deve essere booleano')
    .toBoolean(),
  body('note')
    .optional({ nullable: true })
    .isString()
    .withMessage('Le note devono essere una stringa')
    .bail()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Le note non possono superare i 255 caratteri'),
  body().custom((value) => {
    const campi = ['verificato', 'principale', 'note'];
    if (!value || campi.every((c) => value[c] === undefined)) {
      throw new Error(`Specificare almeno un campo tra: ${campi.join(', ')}`);
    }
    return true;
  }),
];

module.exports = {
  validateDominioIdParam,
  validateAggiungiDominio,
  validateAggiornaDominio,
};
