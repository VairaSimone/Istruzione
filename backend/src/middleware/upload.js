'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const AppError = require('../utils/AppError');
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
 * - la dimensione massima dipende dal tipo (cfr. config/upload).
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

/**
 * Restituisce un middleware che accetta UN singolo file nel campo `campo` per il
 * tipo indicato, con storage e limiti coerenti. Gli errori di multer vengono
 * normalizzati in AppError (413 se supera la dimensione massima).
 */
const uploadSingolo = (tipo, campo = 'file') => {
  const uploader = multer({
    storage: creaStorage(tipo),
    fileFilter: creaFileFilter(tipo),
    limits: { fileSize: LIMITI_DIMENSIONE[tipo], files: 1 },
  }).single(campo);

  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (!err) return next();

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
