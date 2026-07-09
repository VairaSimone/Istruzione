'use strict';

const { body, param, query } = require('express-validator');
const Corso = require('../models/Corso');

/**
 * Validator dei CORSI (videolezioni on-demand). Messaggi in italiano,
 * sanitizzazione (`trim`) e cast coerenti con lo stile del progetto.
 */

const LIVELLI_JLPT = Corso.LIVELLI_JLPT;
const STATI_CORSO = Corso.STATI_CORSO;
const URL_MAX = Corso.URL_MAX;

// Opzioni comuni per la validazione degli URL: solo http/https, protocollo
// obbligatorio (nessun file binario: solo riferimenti a risorse esterne).
const OPZIONI_URL = { protocols: ['http', 'https'], require_protocol: true };

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ─────────────────────────────────────────────
// Parametri di rotta (UUID)
// ─────────────────────────────────────────────
const validateCorsoIdParam = [
  param('id').isUUID(4).withMessage("L'identificativo del corso non è valido"),
];

const validateCapitoloParams = [
  param('id').isUUID(4).withMessage("L'identificativo del corso non è valido"),
  param('capitoloId').isUUID(4).withMessage("L'identificativo del capitolo non è valido"),
];

const validateDocumentoParams = [
  param('id').isUUID(4).withMessage("L'identificativo del corso non è valido"),
  param('capitoloId').isUUID(4).withMessage("L'identificativo del capitolo non è valido"),
  param('documentoId').isUUID(4).withMessage("L'identificativo del documento non è valido"),
];

const validateDisponibilitaParams = [
  param('id').isUUID(4).withMessage("L'identificativo del corso non è valido"),
  param('classeId').isUUID(4).withMessage("L'identificativo dell'aula non è valido"),
];

// ─────────────────────────────────────────────
// Campi condivisi CREA/AGGIORNA corso
// ─────────────────────────────────────────────
const campoTitoloCorso = (obbligatorio) => {
  const chain = body('titolo');
  if (!obbligatorio) chain.optional();
  return chain
    .trim()
    .notEmpty()
    .withMessage('Il titolo del corso è obbligatorio')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo del corso deve avere tra 2 e 160 caratteri');
};

const campiOpzionaliCorso = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 10000 })
    .withMessage('La descrizione non può superare i 10000 caratteri'),

  body('copertinaUrl')
    .optional({ nullable: true })
    .trim()
    .isURL(OPZIONI_URL)
    .withMessage("L'URL della copertina deve essere un indirizzo http(s) valido")
    .isLength({ max: URL_MAX })
    .withMessage(`L'URL della copertina non può superare i ${URL_MAX} caratteri`),

  body('livelloJLPT')
    .optional({ nullable: true })
    .trim()
    .isIn(LIVELLI_JLPT)
    .withMessage(`Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`),

  body('stato')
    .optional()
    .trim()
    .isIn(STATI_CORSO)
    .withMessage(`Lo stato deve essere uno di: ${STATI_CORSO.join(', ')}`),

  body('videoScaricabile')
    .optional()
    .isBoolean()
    .withMessage('Il campo videoScaricabile deve essere un booleano')
    .toBoolean(),
];

// Validazione di una singola voce capitolo inline (creazione corso).
// `consentiSotto` abilita un livello di sotto-capitoli (stile Udemy): le sezioni
// di primo livello possono contenere `sottoCapitoli[]`, i sotto-capitoli no
// (profondità massima 1, coerente col service).
const voceCapitoloValida = (voce, consentiSotto = true) => {
  if (!isPlainObject(voce)) return false;
  if (typeof voce.titolo !== 'string' || voce.titolo.trim().length < 2 || voce.titolo.trim().length > 160) {
    return false;
  }
  // I documenti inline (se presenti) devono avere titolo e url stringa.
  if (voce.documenti !== undefined) {
    if (!Array.isArray(voce.documenti)) return false;
    for (const d of voce.documenti) {
      if (!isPlainObject(d)) return false;
      if (typeof d.titolo !== 'string' || d.titolo.trim().length < 1) return false;
      if (typeof d.url !== 'string' || d.url.trim().length < 1) return false;
    }
  }
  // Sotto-capitoli inline (solo al primo livello).
  if (voce.sottoCapitoli !== undefined) {
    if (!consentiSotto) return false;
    if (!Array.isArray(voce.sottoCapitoli)) return false;
    for (const sotto of voce.sottoCapitoli) {
      if (!voceCapitoloValida(sotto, false)) return false;
    }
  }
  return true;
};

const validateCreaCorso = [
  campoTitoloCorso(true),
  ...campiOpzionaliCorso,

  // Facoltativo: ignorato per l'insegnante (usa la propria scuola), usato
  // dall'admin per indicare la scuola del corso (obbligatorio per l'admin,
  // vincolo applicato nel service in base al ruolo).
  body('scuolaId')
    .optional({ nullable: true })
    .isUUID(4)
    .withMessage("L'identificativo della scuola non è valido"),

  // Capitoli inline facoltativi (validazione di forma; i dettagli sono
  // rifiniti nel service). Il controllo fine degli URL avviene comunque a
  // livello di modello.
  body('capitoli')
    .optional()
    .isArray({ max: 20 })
    .withMessage('I capitoli devono essere un array (max 20 in creazione)')
    .bail()
    .custom((arr) => {
      for (const voce of arr) {
        if (!voceCapitoloValida(voce)) {
          throw new Error('Ogni capitolo deve avere un titolo valido (2-160 caratteri), eventuali documenti con titolo e url, ed eventuali sotto-capitoli validi');
        }
      }
      return true;
    }),
];

const validateAggiornaCorso = [
  ...validateCorsoIdParam,
  campoTitoloCorso(false),
  ...campiOpzionaliCorso,
];

// ─────────────────────────────────────────────
// Campi condivisi CREA/AGGIORNA capitolo
// ─────────────────────────────────────────────
const campoTitoloCapitolo = (obbligatorio) => {
  const chain = body('titolo');
  if (!obbligatorio) chain.optional();
  return chain
    .trim()
    .notEmpty()
    .withMessage('Il titolo del capitolo è obbligatorio')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('Il titolo del capitolo deve avere tra 2 e 160 caratteri');
};

const campiOpzionaliCapitolo = [
  body('descrizione')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descrizione deve essere una stringa')
    .isLength({ max: 10000 })
    .withMessage('La descrizione non può superare i 10000 caratteri'),

  body('videoUrl')
    .optional({ nullable: true })
    .trim()
    .isURL(OPZIONI_URL)
    .withMessage("L'URL del video deve essere un indirizzo http(s) valido")
    .isLength({ max: URL_MAX })
    .withMessage(`L'URL del video non può superare i ${URL_MAX} caratteri`),

  body('videoDurataSecondi')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 86400 })
    .withMessage('La durata del video deve essere un intero tra 0 e 86400 secondi')
    .toInt(),

  // Override della policy di download: true/false esplicito, oppure null per
  // ereditare dal corso. `optional({ nullable: true })` lascia passare null.
  body('scaricabile')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('Il campo scaricabile deve essere un booleano')
    .toBoolean(),

  body('ordine')
    .optional()
    .isInt({ min: 0 })
    .withMessage("L'ordine deve essere un intero maggiore o uguale a 0")
    .toInt(),

  // Padre del capitolo: null/omesso = sezione di primo livello; UUID = il
  // capitolo diventa un sotto-capitolo (stile Udemy). La profondità massima
  // (1 livello di annidamento) è applicata nel service.
  body('capitoloPadreId')
    .optional({ nullable: true })
    .isUUID(4)
    .withMessage("L'identificativo del capitolo padre non è valido"),
];

const validateCreaCapitolo = [
  ...validateCorsoIdParam,
  campoTitoloCapitolo(true),
  ...campiOpzionaliCapitolo,
];

const validateAggiornaCapitolo = [
  ...validateCapitoloParams,
  campoTitoloCapitolo(false),
  ...campiOpzionaliCapitolo,
];

// ─────────────────────────────────────────────
// Documento del capitolo
// ─────────────────────────────────────────────
const validateCreaDocumento = [
  ...validateCapitoloParams,
  body('titolo')
    .trim()
    .notEmpty()
    .withMessage('Il titolo del documento è obbligatorio')
    .bail()
    .isLength({ min: 1, max: 200 })
    .withMessage('Il titolo del documento deve avere tra 1 e 200 caratteri'),
  body('url')
    .trim()
    .notEmpty()
    .withMessage("L'URL del documento è obbligatorio")
    .bail()
    .isURL(OPZIONI_URL)
    .withMessage("L'URL del documento deve essere un indirizzo http(s) valido")
    .isLength({ max: URL_MAX })
    .withMessage(`L'URL del documento non può superare i ${URL_MAX} caratteri`),
  body('ordine')
    .optional()
    .isInt({ min: 0 })
    .withMessage("L'ordine deve essere un intero maggiore o uguale a 0")
    .toInt(),
];

// ─────────────────────────────────────────────
// Disponibilità (rendi disponibile a un'aula)
// ─────────────────────────────────────────────
const validateRendiDisponibile = [
  ...validateCorsoIdParam,
  body('classeId')
    .notEmpty()
    .withMessage("L'identificativo dell'aula è obbligatorio")
    .bail()
    .isUUID(4)
    .withMessage("L'identificativo dell'aula non è valido"),
];

// ─────────────────────────────────────────────
// Filtri elenco corsi (staff)
// ─────────────────────────────────────────────
const validateElencoCorsi = [
  query('stato')
    .optional()
    .trim()
    .isIn(STATI_CORSO)
    .withMessage(`Lo stato deve essere uno di: ${STATI_CORSO.join(', ')}`),

  query('livello')
    .optional()
    .trim()
    .isIn(LIVELLI_JLPT)
    .withMessage(`Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`),

  query('q')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Il termine di ricerca non può superare i 160 caratteri'),

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

// ─────────────────────────────────────────────
// Filtri elenco corsi (studente): niente stato/scuola (impliciti)
// ─────────────────────────────────────────────
const validateElencoCorsiStudente = [
  query('livello')
    .optional()
    .trim()
    .isIn(LIVELLI_JLPT)
    .withMessage(`Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`),

  query('q')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Il termine di ricerca non può superare i 160 caratteri'),

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

// ─────────────────────────────────────────────
// Servizio file protetto + upload multipart
// ─────────────────────────────────────────────

// GET /api/corsi/files/:fileId
const validateFileIdParam = [
  param('fileId').isUUID(4).withMessage("L'identificativo del file non è valido"),
];

// POST /api/corsi/:id/copertina  (campo file gestito da multer; nessun campo testo)
const validateUploadCopertina = [...validateCorsoIdParam];

// POST /api/corsi/:id/capitoli/:capitoloId/video
// Il file è gestito da multer; la durata è un campo testo opzionale del form.
const validateUploadVideo = [
  ...validateCapitoloParams,
  body('videoDurataSecondi')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 86400 })
    .withMessage('La durata del video deve essere un intero tra 0 e 86400 secondi')
    .toInt(),
];

// POST /api/corsi/:id/capitoli/:capitoloId/documenti/upload
// Il file è gestito da multer; titolo/ordine sono campi testo opzionali del form
// (in mancanza del titolo si usa il nome originale del file).
const validateUploadDocumento = [
  ...validateCapitoloParams,
  body('titolo')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Il titolo del documento deve avere tra 1 e 200 caratteri'),
  body('ordine')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage("L'ordine deve essere un intero maggiore o uguale a 0")
    .toInt(),
];

module.exports = {
  validateCorsoIdParam,
  validateCapitoloParams,
  validateDocumentoParams,
  validateDisponibilitaParams,
  validateFileIdParam,
  validateCreaCorso,
  validateAggiornaCorso,
  validateCreaCapitolo,
  validateAggiornaCapitolo,
  validateCreaDocumento,
  validateUploadCopertina,
  validateUploadVideo,
  validateUploadDocumento,
  validateRendiDisponibile,
  validateElencoCorsi,
  validateElencoCorsiStudente,
};
