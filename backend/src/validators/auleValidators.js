'use strict';

const { body, param, query } = require('express-validator');
const Classe = require('../models/Classe');

/**
 * Validator delle AULE (express-validator), usati prima del middleware
 * `validate`. Coerenti con lo stile degli altri validator del progetto:
 * messaggi in italiano, sanitizzazione (`trim`) e cast (`toInt`/`toBoolean`).
 *
 * Il LIVELLO dell'aula è testo libero (la piattaforma è generica: "A1", "Base",
 * "Terzo anno"…). Qui si valida solo la forma; l'appartenenza al vocabolario
 * eventualmente definito dalla scuola è verificata nel service, che è l'unico a
 * conoscere il tenant del richiedente.
 */

const LIVELLO_MAX = Classe.LIVELLO_MAX;

/**
 * Regola condivisa per il campo livello. `livelloJLPT` resta accettato come
 * ALIAS STORICO finché il frontend non viene aggiornato.
 */
const livelloRule = (chain) =>
  chain
    .optional({ nullable: true })
    .trim()
    .isLength({ max: LIVELLO_MAX })
    .withMessage(`Il livello non può superare i ${LIVELLO_MAX} caratteri`);

// ─────────────────────────────────────────────
// Parametri di rotta (UUID)
// ─────────────────────────────────────────────
const validateClasseIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

const validateMembroParams = [
  param('id').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
  param('utenteId').isUUID(4).withMessage("L'identificativo dell'utente non è valido"),
];

// ─────────────────────────────────────────────
// Campi condivisi CREA/AGGIORNA aula
// ─────────────────────────────────────────────
const campoNome = (obbligatorio) => {
  const chain = body('nome');
  if (!obbligatorio) chain.optional();
  return chain
    .trim()
    .notEmpty()
    .withMessage("Il nome dell'aula è obbligatorio")
    .bail()
    .isLength({ min: 2, max: 120 })
    .withMessage("Il nome dell'aula deve avere tra 2 e 120 caratteri");
};

const campiOpzionaliAula = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 5000 })
    .withMessage('La descrizione non può superare i 5000 caratteri'),

  body('annoScolastico')
    .optional({ nullable: true })
    .trim()
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage("L'anno scolastico deve essere nel formato AAAA/AAAA (es. 2025/2026)"),

  livelloRule(body('livello')),
  livelloRule(body('livelloJLPT')),

  body('colore')
    .optional({ nullable: true })
    .trim()
    .matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .withMessage('Il colore deve essere un valore esadecimale valido (es. #4F46E5)'),

  body('icona')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage("Il nome dell'icona non può superare i 50 caratteri"),
];

const validateCreaClasse = [
  campoNome(true),
  ...campiOpzionaliAula,
  // Facoltativo: ignorato per l'insegnante (usa la propria scuola), usato
  // dall'admin per indicare la scuola dell'aula (obbligatorio per l'admin,
  // vincolo applicato nel service in base al ruolo).
  body('scuolaId')
    .optional({ nullable: true })
    .isUUID(4)
    .withMessage("L'identificativo della scuola non è valido"),
];

const validateAggiornaClasse = [
  ...validateClasseIdParam,
  campoNome(false),
  ...campiOpzionaliAula,
  body('archiviata')
    .optional()
    .isBoolean()
    .withMessage('Il campo archiviata deve essere un booleano')
    .toBoolean(),
];

// ─────────────────────────────────────────────
// Aggiunta membro registrato (studente/insegnante): serve utenteId O email
// ─────────────────────────────────────────────
const validateAggiungiMembro = [
  ...validateClasseIdParam,
  body('utenteId')
    .optional()
    .isUUID(4)
    .withMessage("L'identificativo dell'utente non è valido"),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Formato email non valido'),
  body().custom((value) => {
    if (!value || (!value.utenteId && !value.email)) {
      throw new Error('Specificare utenteId oppure email');
    }
    return true;
  }),
];

// ─────────────────────────────────────────────
// Invito studente in aula (via email)
// ─────────────────────────────────────────────
const validateInvitoStudenteAula = [
  ...validateClasseIdParam,
  body('email')
    .trim()
    .notEmpty()
    .withMessage("L'email è obbligatoria")
    .bail()
    .isEmail()
    .withMessage('Formato email non valido'),
];

// ─────────────────────────────────────────────
// Filtri elenco aule
// ─────────────────────────────────────────────
const validateElencoClassi = [
  livelloRule(query('livello')),

  query('anno')
    .optional()
    .trim()
    .matches(/^\d{4}\/\d{4}$/)
    .withMessage("L'anno scolastico deve essere nel formato AAAA/AAAA (es. 2025/2026)"),

  query('archiviata')
    .optional()
    .isBoolean()
    .withMessage('Il filtro archiviata deve essere un booleano')
    .toBoolean(),

  query('q')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Il termine di ricerca non può superare i 120 caratteri'),

  // Filtro per scuola: usato dall'admin per restringere l'elenco a una scuola.
  query('scuola')
    .optional()
    .isUUID(4)
    .withMessage("L'identificativo della scuola non è valido"),

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
  validateClasseIdParam,
  validateMembroParams,
  validateCreaClasse,
  validateAggiornaClasse,
  validateAggiungiMembro,
  validateInvitoStudenteAula,
  validateElencoClassi,
};
