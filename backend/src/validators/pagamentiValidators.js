'use strict';

const { body, query } = require('express-validator');

/**
 * Validator del modulo PAGAMENTI. Messaggi in italiano, coerenti con lo stile
 * del progetto. La validazione di dominio (corso acquistabile, scuola operativa,
 * appartenenza al tenant) resta nel service: qui si valida solo la forma.
 */

// Facoltativo: usato dall'admin per indicare la scuola su cui operare. Per lo
// staff è ignorato (usa la propria scuola).
const scuolaIdOpzionaleBody = body('scuolaId')
  .optional({ nullable: true })
  .isUUID(4)
  .withMessage("L'identificativo della scuola non è valido");

const scuolaIdOpzionaleQuery = query('scuolaId')
  .optional({ nullable: true })
  .isUUID(4)
  .withMessage("L'identificativo della scuola non è valido");

const validateConfigQuery = [scuolaIdOpzionaleQuery];

const validateAggiornaConfig = [
  body('attivi')
    .exists()
    .withMessage('Il campo attivi è obbligatorio')
    .bail()
    .isBoolean()
    .withMessage('Il campo attivi deve essere un booleano')
    .toBoolean(),
  scuolaIdOpzionaleBody,
];

const validateOnboarding = [scuolaIdOpzionaleBody];

const validateStatoOnboarding = [scuolaIdOpzionaleQuery];

const validateCheckout = [
  body('corsoId')
    .exists()
    .withMessage("L'identificativo del corso è obbligatorio")
    .bail()
    .isUUID(4)
    .withMessage("L'identificativo del corso non è valido"),
];

const validateElencoScuola = [
  query('stato')
    .optional()
    .trim()
    .isIn(['in_attesa', 'completato', 'fallito', 'annullato', 'rimborsato'])
    .withMessage('Stato pagamento non valido'),
  scuolaIdOpzionaleQuery,
];

module.exports = {
  validateConfigQuery,
  validateAggiornaConfig,
  validateOnboarding,
  validateStatoOnboarding,
  validateCheckout,
  validateElencoScuola,
};
