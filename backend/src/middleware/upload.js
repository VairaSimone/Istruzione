'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const magicBytes = require('../utils/magicBytes');
const {
  UPLOAD_DIR,
  UPLOAD_SUBDIR_CORSI,
  LIMITI_DIMENSIONE,
  estensionePerMime,
  mimeAmmesso,
} = require('../config/upload');

/**
 * Middleware di UPLOAD FILE (videolezioni on-demand) basato su multer + disco.
 *
 * I file vengono salvati su disco in una cartella privata, organizzata per
 * scuola (tenant):  <UPLOAD_DIR>/corsi/<scuola_id | 'globale'>/<uuid><ext>
 *
 * - il nome su disco è un UUID casuale + estensione DERIVATA DAL MIME validato
 *   (mai dal nome file del client, per evitare path traversal / estensioni fasulle);
 * - il MIME viene filtrato per tipo (video/immagine/documento);
 * - il CONTENUTO viene verificato contro il MIME dichiarato (magic bytes);
 * - la dimensione massima dipende dal tipo (cfr. config/upload).
 *
 * ─────────────────────────────────────────────
 * DUE CONTROLLI, NON UNO SOLO
 * ─────────────────────────────────────────────
 * `fileFilter` guarda `file.mimetype`, che NON è il tipo del file: è il
 * `Content-Type` della parte multipart, cioè una stringa scelta dal client. Da
 * solo non prova nulla — un `.exe` dichiarato `video/mp4` lo attraversa intatto
 * e finisce su disco con estensione `.mp4`, servito poi con quel Content-Type.
 *
 * Perciò dopo multer c'è un secondo controllo sui MAGIC BYTES: si leggono i
 * primi byte del file appena scritto e si verifica che siano coerenti col MIME
 * dichiarato. Il primo controllo è un filtro economico che respinge subito il
 * grosso; il secondo è quello che decide.
 *
 * L'ordine è obbligato: multer scrive il file PRIMA che si possa leggerne il
 * contenuto. Se il controllo fallisce il binario viene rimosso: non resta nulla
 * su disco e il controller non viene mai eseguito.
 *
 * L'autenticazione (authenticateJWT) DEVE essere eseguita prima di questi
 * middleware: la cartella di destinazione dipende da `req.user.scuola_id`.
 */

const cartellaScuola = (req) => {
  const scuola = req.user && req.user.scuola_id ? String(req.user.scuola_id) : 'globale';
  return path.join(UPLOAD_DIR, UPLOAD_SUBDIR_CORSI, scuola);
};

/**
 * Costruisce lo storage multer per un dato tipo logico di file. Il MIME viene
 * validato sia nel fileFilter sia qui (per l'estensione): se non ammesso, il
 * fileFilter avrà già respinto la richiesta.
 */
const creaStorage = (tipo) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = cartellaScuola(req);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename: (req, file, cb) => {
      const ext = estensionePerMime(tipo, file.mimetype) || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

// Primo filtro, sul MIME DICHIARATO: economico e respinge subito il grosso.
// Non è una garanzia — il valore lo sceglie il client — ed è per questo che
// dopo multer c'è `verificaContenuto`.
const creaFileFilter = (tipo) => (req, file, cb) => {
  if (!mimeAmmesso(tipo, file.mimetype)) {
    return cb(
      new AppError(
        `Tipo di file non ammesso per il caricamento (${file.mimetype}).`,
        415,
        'UNSUPPORTED_FILE_TYPE'
      )
    );
  }
  cb(null, true);
};

/** Rimuove un binario appena scritto, best-effort. */
const rimuovi = async (percorso) => {
  if (!percorso) return;
  try {
    await fsp.unlink(percorso);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[UPLOAD] Impossibile rimuovere ${percorso}: ${err.message}`);
    }
  }
};

/**
 * Verifica che il CONTENUTO del file corrisponda al MIME dichiarato.
 * In caso di discordanza rimuove il binario e produce un 415.
 *
 * Applica a `req.file` e a `req.files` (array o mappa per campo): oggi si usa
 * solo `.single()`, ma il giorno in cui servisse `.array()` il controllo non
 * deve scoprirsi scoperto in silenzio.
 */
const verificaContenuto = async (req) => {
  const daControllare = [];
  if (req.file) daControllare.push(req.file);
  if (Array.isArray(req.files)) daControllare.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    for (const gruppo of Object.values(req.files)) {
      if (Array.isArray(gruppo)) daControllare.push(...gruppo);
    }
  }

  for (const file of daControllare) {
    if (!file || !file.path) continue;

    let testa;
    const handle = await fsp.open(file.path, 'r');
    try {
      const buffer = Buffer.alloc(magicBytes.BYTE_DA_LEGGERE);
      const { bytesRead } = await handle.read(buffer, 0, magicBytes.BYTE_DA_LEGGERE, 0);
      testa = buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }

    if (!magicBytes.coerente(testa, file.mimetype)) {
      await Promise.all(daControllare.map((f) => rimuovi(f.path)));
      logger.warn(
        `[UPLOAD] Contenuto incoerente col MIME dichiarato: "${file.originalname}" dichiarato ${file.mimetype} (utente ${req.user ? req.user.id : 'anonimo'}).`
      );
      throw new AppError(
        `Il contenuto del file non corrisponde al tipo dichiarato (${file.mimetype}).`,
        415,
        'FILE_CONTENT_MISMATCH'
      );
    }
  }
};

/**
 * Restituisce un middleware che accetta UN singolo file nel campo `campo` per il
 * tipo indicato, con storage e limiti coerenti. Gli errori di multer vengono
 * normalizzati in AppError (413 se supera la dimensione massima). A monte del
 * controller, il contenuto viene verificato contro il MIME dichiarato.
 */
const uploadSingolo = (tipo, campo = 'file') => {
  const uploader = multer({
    storage: creaStorage(tipo),
    fileFilter: creaFileFilter(tipo),
    limits: { fileSize: LIMITI_DIMENSIONE[tipo], files: 1 },
  }).single(campo);

  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (!err) {
        // Il file è su disco: solo ora se ne può leggere il contenuto.
        return verificaContenuto(req).then(next).catch(next);
      }

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = Math.round(LIMITI_DIMENSIONE[tipo] / (1024 * 1024));
          return next(
            new AppError(
              `Il file supera la dimensione massima consentita (${maxMb} MB).`,
              413,
              'FILE_TOO_LARGE'
            )
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new AppError(
              `Campo file non atteso. Usa il campo "${campo}".`,
              400,
              'UNEXPECTED_FILE_FIELD'
            )
          );
        }
        return next(new AppError(`Errore nel caricamento del file: ${err.message}`, 400, 'UPLOAD_ERROR'));
      }

      // AppError dal fileFilter o altri errori.
      return next(err);
    });
  };
};

module.exports = {
  uploadVideo: uploadSingolo('video', 'file'),
  uploadImmagine: uploadSingolo('immagine', 'file'),
  uploadDocumento: uploadSingolo('documento', 'file'),
};
