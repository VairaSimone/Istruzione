'use strict';

const path = require('path');

/**
 * Configurazione centralizzata dell'UPLOAD DI FILE (videolezioni on-demand).
 *
 * A differenza della versione originale del progetto — che memorizzava SOLO
 * riferimenti (URL) a risorse esterne — i corsi ora accettano il CARICAMENTO di
 * file dal PC dell'insegnante (video, immagini di copertina, documenti allegati).
 *
 * I file NON vengono mai serviti staticamente: sono salvati su disco in una
 * cartella privata, organizzata per scuola (tenant), e distribuiti solo tramite
 * un endpoint protetto (cfr. fileController) che verifica autenticazione,
 * appartenenza alla scuola / iscrizione all'aula e policy di download.
 *
 * Tutti i valori sono sovrascrivibili via variabili d'ambiente, così da poter
 * adattare limiti e percorso di archiviazione senza toccare il codice.
 */

// Cartella radice dove vengono salvati i file caricati. Default: `<backend>/uploads`.
// In produzione conviene puntarla a un volume dedicato (montaggio persistente).
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');

// Sottocartella (dentro UPLOAD_DIR) usata per i corsi/videolezioni.
const UPLOAD_SUBDIR_CORSI = 'corsi';

// Tipi logici di file gestiti dalla piattaforma.
const TIPI_FILE = ['video', 'immagine', 'documento'];

// Conversione MB → byte.
const MB = 1024 * 1024;

const intEnv = (chiave, predefinito) => {
  const v = parseInt(process.env[chiave], 10);
  return Number.isFinite(v) && v > 0 ? v : predefinito;
};

// Dimensioni massime per tipo (in byte). Sovrascrivibili via env.
const LIMITI_DIMENSIONE = {
  video: intEnv('UPLOAD_MAX_VIDEO_MB', 1024) * MB, //  1 GB
  immagine: intEnv('UPLOAD_MAX_IMMAGINE_MB', 10) * MB, // 10 MB
  documento: intEnv('UPLOAD_MAX_DOCUMENTO_MB', 100) * MB, // 100 MB
};

// Il limite più alto (usato come guardia globale del middleware multer prima di
// conoscere il tipo effettivo del campo).
const LIMITE_DIMENSIONE_MAX = Math.max(...Object.values(LIMITI_DIMENSIONE));

/**
 * MIME type ammessi per tipo, con l'estensione canonica da usare su disco.
 * Il salvataggio NON si fida del nome file del client: l'estensione è derivata
 * dal MIME type validato (mappa sotto), non dal `originalname`.
 */
const MIME_AMMESSI = {
  video: {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-matroska': '.mkv',
  },
  immagine: {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    // Nota: SVG volutamente escluso (rischio XSS se servito inline).
  },
  documento: {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/zip': '.zip',
  },
};

/** Restituisce l'estensione canonica per un dato tipo+mime, o null se non ammesso. */
const estensionePerMime = (tipo, mime) => {
  const mappa = MIME_AMMESSI[tipo];
  if (!mappa) return null;
  return Object.prototype.hasOwnProperty.call(mappa, mime) ? mappa[mime] : null;
};

/** True se il MIME è ammesso per il tipo indicato. */
const mimeAmmesso = (tipo, mime) => estensionePerMime(tipo, mime) !== null;

module.exports = {
  UPLOAD_DIR,
  UPLOAD_SUBDIR_CORSI,
  TIPI_FILE,
  LIMITI_DIMENSIONE,
  LIMITE_DIMENSIONE_MAX,
  MIME_AMMESSI,
  estensionePerMime,
  mimeAmmesso,
};
