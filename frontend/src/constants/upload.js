/**
 * Costanti di UPLOAD dei file delle videolezioni.
 *
 * Rispecchiano `backend/src/config/upload.js`: stessi MIME type ammessi e
 * stessi limiti di dimensione. La validazione lato client è solo un aiuto per
 * l'utente (feedback immediato, niente upload inutili da 1 GB): la validazione
 * che conta resta quella del backend, che rifiuta con 415 UNSUPPORTED_FILE_TYPE
 * o 413 FILE_TOO_LARGE.
 *
 * I limiti sono sovrascrivibili via variabili d'ambiente Vite, per restare
 * allineati a `UPLOAD_MAX_*_MB` del backend senza ricompilare le costanti:
 *   VITE_UPLOAD_MAX_VIDEO_MB · VITE_UPLOAD_MAX_IMMAGINE_MB · VITE_UPLOAD_MAX_DOCUMENTO_MB
 */

const MB = 1024 * 1024;

const intEnv = (valore, predefinito) => {
  const n = Number.parseInt(valore, 10);
  return Number.isFinite(n) && n > 0 ? n : predefinito;
};

/** Tipi logici di file gestiti dalla piattaforma. */
export const TIPI_FILE = Object.freeze(['video', 'immagine', 'documento']);

/**
 * MIME type ammessi per tipo. Nota: l'SVG è volutamente escluso dalle immagini
 * (rischio XSS se servito inline), coerentemente con il backend.
 */
export const MIME_AMMESSI = Object.freeze({
  video: Object.freeze([
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ]),
  immagine: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  documento: Object.freeze([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
  ]),
});

/** Dimensione massima per tipo, in byte. */
export const LIMITI_DIMENSIONE = Object.freeze({
  video: intEnv(import.meta.env.VITE_UPLOAD_MAX_VIDEO_MB, 1024) * MB,
  immagine: intEnv(import.meta.env.VITE_UPLOAD_MAX_IMMAGINE_MB, 10) * MB,
  documento: intEnv(import.meta.env.VITE_UPLOAD_MAX_DOCUMENTO_MB, 100) * MB,
});

/** Valore dell'attributo `accept` di `<input type="file">` per ogni tipo. */
export const ACCEPT_PER_TIPO = Object.freeze({
  video: MIME_AMMESSI.video.join(','),
  immagine: MIME_AMMESSI.immagine.join(','),
  documento: MIME_AMMESSI.documento.join(','),
});

/** true se il MIME del file è ammesso per il tipo indicato. */
export const mimeAmmesso = (tipo, mime) =>
  Boolean(MIME_AMMESSI[tipo]) && MIME_AMMESSI[tipo].includes(mime);

/**
 * Valida un File lato client. Restituisce `null` se va bene, altrimenti una
 * chiave i18n con i parametri per il messaggio d'errore:
 *   { key: 'upload.errors.tipo' | 'upload.errors.dimensione', params: {...} }
 */
export const validaFile = (tipo, file) => {
  if (!file) return null;

  if (!mimeAmmesso(tipo, file.type)) {
    return { key: 'upload.errors.tipo', params: {} };
  }

  const limite = LIMITI_DIMENSIONE[tipo];
  if (limite && file.size > limite) {
    return { key: 'upload.errors.dimensione', params: { max: limite / MB } };
  }

  return null;
};
