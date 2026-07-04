'use strict';

const { body, param, query } = require('express-validator');
const Messaggio = require('../models/Messaggio');

/**
 * Validator della MESSAGGISTICA (express-validator). Messaggi in italiano,
 * sanitizzazione e cast coerenti col resto del progetto. Le regole di
 * autorizzazione (aule condivise, proprietà del compito) restano nel service.
 */

const TIPI_MESSAGGIO = Messaggio.TIPI_MESSAGGIO;
const MAX_CORPO = 5000;

const validateMessaggioIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo del messaggio non è valido"),
];

// ─────────────────────────────────────────────
// Invio messaggio
// ─────────────────────────────────────────────
const validateInviaMessaggio = [
  body('tipo')
    .optional()
    .trim()
    .isIn(TIPI_MESSAGGIO)
    .withMessage(`Il tipo deve essere uno di: ${TIPI_MESSAGGIO.join(', ')}`),

  body('oggetto')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 160 })
    .withMessage("L'oggetto non può superare i 160 caratteri"),

  body('corpo')
    .trim()
    .notEmpty()
    .withMessage('Il corpo del messaggio è obbligatorio')
    .bail()
    .isLength({ max: MAX_CORPO })
    .withMessage(`Il corpo non può superare i ${MAX_CORPO} caratteri`),

  body('studenteId').optional().isUUID(4).withMessage("L'identificativo dello studente non è valido"),
  body('classeId').optional().isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
  body('compitoId').optional().isUUID(4).withMessage("L'identificativo del compito non è valido"),
  body('notaSuUtenteId').optional().isUUID(4).withMessage("L'identificativo dello studente non è valido"),
  body('consentiRisposte').optional().isBoolean().withMessage('consentiRisposte deve essere un booleano').toBoolean(),

  // Coerenza del bersaglio: per i messaggi "veri" esattamente uno tra
  // studenteId e classeId. Le note private non richiedono destinatari.
  body().custom((value) => {
    const tipo = (value && value.tipo) || 'messaggio';
    if (tipo !== 'nota_privata') {
      const haStud = !!(value && value.studenteId);
      const haClasse = !!(value && value.classeId);
      if (haStud === haClasse) {
        throw new Error('Specificare esattamente uno tra studenteId e classeId');
      }
    }
    return true;
  }),
];

// ─────────────────────────────────────────────
// Feedback su compito
// ─────────────────────────────────────────────
const validateFeedbackCompito = [
  body('compitoId').isUUID(4).withMessage("L'identificativo del compito non è valido"),
  body('studenteId').isUUID(4).withMessage("L'identificativo dello studente non è valido"),
  body('corpo')
    .trim()
    .notEmpty()
    .withMessage('Il testo del feedback è obbligatorio')
    .bail()
    .isLength({ max: MAX_CORPO })
    .withMessage(`Il feedback non può superare i ${MAX_CORPO} caratteri`),
  body('punteggio')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Il punteggio deve essere un intero tra 0 e 1000')
    .toInt(),
];

// ─────────────────────────────────────────────
// Risposta
// ─────────────────────────────────────────────
const validateRispondi = [
  ...validateMessaggioIdParam,
  body('corpo')
    .trim()
    .notEmpty()
    .withMessage('Il corpo della risposta è obbligatorio')
    .bail()
    .isLength({ max: MAX_CORPO })
    .withMessage(`Il corpo non può superare i ${MAX_CORPO} caratteri`),
];

// ─────────────────────────────────────────────
// Filtri elenco
// ─────────────────────────────────────────────
const validateElencoRicevuti = [
  query('nonLetti').optional().isBoolean().withMessage('nonLetti deve essere un booleano').toBoolean(),
  query('page').optional().isInt({ min: 1 }).withMessage('page deve essere un intero positivo').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve essere un intero tra 1 e 100')
    .toInt(),
];

const validateElencoPaginato = [
  query('page').optional().isInt({ min: 1 }).withMessage('page deve essere un intero positivo').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve essere un intero tra 1 e 100')
    .toInt(),
];

module.exports = {
  validateMessaggioIdParam,
  validateInviaMessaggio,
  validateFeedbackCompito,
  validateRispondi,
  validateElencoRicevuti,
  validateElencoPaginato,
};
