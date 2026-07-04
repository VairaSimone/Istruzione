'use strict';

const { query, param } = require('express-validator');

/**
 * Validator della DASHBOARD (express-validator). `giorni` e `limite` sono
 * facoltativi: il service comunque normalizza/clampa, qui si rifiutano solo
 * valori palesemente errati.
 */

const validateDashboardQuery = [
  query('giorni')
    .optional()
    .isInt({ min: 1, max: 366 })
    .withMessage('Il parametro giorni deve essere un intero tra 1 e 366')
    .toInt(),
  query('limite')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Il parametro limite deve essere un intero tra 1 e 50')
    .toInt(),
];

const validateDashboardAula = [
  param('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
  ...validateDashboardQuery,
];

module.exports = {
  validateDashboardQuery,
  validateDashboardAula,
};
