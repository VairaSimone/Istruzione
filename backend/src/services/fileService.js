'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const FileCaricato = require('../models/FileCaricato');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { UPLOAD_DIR } = require('../config/upload');

/**
 * fileService — livello di STORAGE dei file caricati (videolezioni on-demand).
 *
 * Responsabilità:
 *   - persistere il metadato di un file appena caricato (multer → riga
 *     file_caricati), salvando il percorso RELATIVO rispetto a UPLOAD_DIR;
 *   - eliminare un file (riga DB + binario su disco, best-effort);
 *   - risolvere in modo sicuro il percorso assoluto (guardia anti path-traversal);
 *   - distribuire il file al client con supporto alle RANGE request (necessario
 *     per lo streaming/seek dei video) e Content-Disposition coerente con la
 *     policy di download.
 *
 * L'AUTORIZZAZIONE all'accesso NON vive qui: è responsabilità di corsiService
 * (che conosce corsi/aule/iscrizioni). Qui si gestiscono solo i byte.
 */

/** Percorso relativo (rispetto a UPLOAD_DIR), sempre con separatori POSIX. */
const percorsoRelativo = (percorsoAssoluto) =>
  path.relative(UPLOAD_DIR, percorsoAssoluto).split(path.sep).join('/');

/**
 * Percorso assoluto sicuro di un file caricato. Verifica che il percorso
 * risolto resti DENTRO UPLOAD_DIR (difesa in profondità contro path traversal,
 * anche se i percorsi sono generati internamente).
 */
const percorsoAssoluto = (fileCaricato) => {
  const assoluto = path.resolve(UPLOAD_DIR, fileCaricato.percorso);
  const radice = path.resolve(UPLOAD_DIR);
  if (assoluto !== radice && !assoluto.startsWith(radice + path.sep)) {
    throw new AppError('Percorso file non valido.', 400, 'INVALID_FILE_PATH');
  }
  return assoluto;
};

/**
 * Crea la riga file_caricati per un file appena caricato da multer.
 * @param {{tipo:string, file:object, richiedente:object, transaction?:object}} args
 *   `file` è l'oggetto multer (req.file): { path, originalname, mimetype, size }.
 * @returns {Promise<FileCaricato>}
 */
const persistiFile = async ({ tipo, file, richiedente, transaction }) => {
  if (!file) {
    throw new AppError('Nessun file caricato.', 400, 'NO_FILE');
  }

  return FileCaricato.create(
    {
      tipo,
      percorso: percorsoRelativo(file.path),
      nome_originale: file.originalname,
      mime_type: file.mimetype,
      dimensione_byte: file.size,
      scuola_id: richiedente.scuola_id || null,
      caricato_da: richiedente.id,
    },
    { transaction }
  );
};

/** Rimuove il binario dal disco (best-effort: logga ma non solleva). */
const rimuoviBinario = async (fileCaricato) => {
  try {
    await fsp.unlink(percorsoAssoluto(fileCaricato));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[FILE] Impossibile eliminare il binario ${fileCaricato.percorso}: ${err.message}`);
    }
  }
};

/**
 * Elimina completamente un file: prima il binario su disco, poi la riga DB.
 * Accetta l'id o l'istanza. No-op se l'id non esiste.
 */
const eliminaFileCaricato = async (fileOId, transaction) => {
  const file =
    fileOId && typeof fileOId === 'object'
      ? fileOId
      : await FileCaricato.findByPk(fileOId, { transaction });
  if (!file) return;

  await rimuoviBinario(file);
  await file.destroy({ transaction });
  logger.info(`[FILE] Eliminato file ${file.id} (${file.tipo})`);
};

/**
 * Distribuisce il file al client con supporto alle RANGE request (streaming
 * video con seek).
 *
 * Content-Disposition: `attachment` per default, `inline` solo per video e
 * immagini — e solo se il chiamante non chiede esplicitamente lo scaricamento.
 * Un documento non viene MAI servito inline, qualunque cosa passi il chiamante:
 * un PDF aperto nel viewer del browser è codice eseguito, non un allegato.
 *
 * @param {object} req
 * @param {object} res
 * @param {FileCaricato} fileCaricato
 * @param {{disposition?: 'inline'|'attachment'}} [opzioni] richiesta, non ordine
 */
const inviaFile = async (req, res, fileCaricato, opzioni = {}) => {
  const assoluto = percorsoAssoluto(fileCaricato);

  let stat;
  try {
    stat = await fsp.stat(assoluto);
  } catch (err) {
    throw new AppError('File non disponibile sul server.', 404, 'FILE_NOT_FOUND');
  }

  // ── Content-Disposition: default SICURO per tipo ──
  //
  // Il default era `inline` per qualunque cosa. Su un documento significa
  // aprirlo dentro il browser: un PDF `inline` viene eseguito dal viewer, e un
  // PDF può contenere JavaScript. I chiamanti oggi passano `attachment` per i
  // documenti (cfr. `corsiService.risolviAccessoFile`), ma quella è cortesia del
  // chiamante, non una garanzia: chi aggiunge un nuovo endpoint e omette
  // l'opzione riapre il buco senza accorgersene.
  //
  // Ora `inline` va CHIESTO, e vale solo dove serve davvero (video e immagini,
  // che devono stare dentro <video>/<img>). Per tutto il resto si scarica.
  // `inline` è ammesso solo per ciò che il browser deve incorporare; un
  // chiamante può comunque forzare `attachment` (es. video scaricabile).
  const inlineAmmesso = fileCaricato.tipo === 'video' || fileCaricato.tipo === 'immagine';
  const disposition =
    inlineAmmesso && opzioni.disposition !== 'attachment' ? 'inline' : 'attachment';

  // Nome file "sicuro" per l'header (RFC 5987): fallback ASCII + versione UTF-8.
  const nome = fileCaricato.nome_originale || 'file';
  const nomeAscii = nome.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  const nomeUtf8 = encodeURIComponent(nome);

  const total = stat.size;

  // Header comuni. CORP cross-origin: consente al frontend (origine diversa) di
  // incorporare il media via <video>/<img>; l'accesso resta protetto a monte
  // dall'autenticazione (cookie) e dai controlli di corsiService.
  res.setHeader('Content-Type', fileCaricato.mime_type || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${nomeAscii}"; filename*=UTF-8''${nomeUtf8}`
  );

  const range = req.headers.range;

  // Richiesta parziale (seek del player): rispondiamo 206 con la porzione.
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      let start = match[1] === '' ? null : parseInt(match[1], 10);
      let end = match[2] === '' ? null : parseInt(match[2], 10);

      if (start === null && end !== null) {
        // Suffix range: ultimi N byte.
        start = Math.max(total - end, 0);
        end = total - 1;
      } else {
        if (start === null) start = 0;
        if (end === null || end >= total) end = total - 1;
      }

      if (start > end || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);

      const stream = fs.createReadStream(assoluto, { start, end });
      stream.on('error', () => res.destroy());
      return stream.pipe(res);
    }
  }

  // Risposta completa.
  res.status(200);
  res.setHeader('Content-Length', total);
  const stream = fs.createReadStream(assoluto);
  stream.on('error', () => res.destroy());
  return stream.pipe(res);
};

module.exports = {
  persistiFile,
  eliminaFileCaricato,
  rimuoviBinario,
  percorsoAssoluto,
  inviaFile,
};
