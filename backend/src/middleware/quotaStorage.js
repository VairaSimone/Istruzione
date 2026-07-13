'use strict';

const fsp = require('fs/promises');

const Scuola = require('../models/Scuola');
const quotaService = require('../services/quotaService');
const logger = require('../utils/logger');

/**
 * Middleware di ENFORCEMENT della quota STORAGE della scuola.
 *
 * Va montato SUBITO DOPO il middleware di upload (multer) e PRIMA del controller
 * che persiste la riga `file_caricati`:
 *
 *     uploadImmagine → verificaQuotaStorage → controller
 *
 * Multer scrive il file su disco prima di arrivare qui, quindi a questo punto
 * `req.file` esiste già. Se il nuovo file farebbe superare la quota della
 * scuola, RIMUOVIAMO il binario appena scritto (per non lasciare spazzatura su
 * disco) e respingiamo la richiesta con 413: il controller non verrà eseguito e
 * nessuna riga verrà creata.
 *
 * Casi in cui la quota NON si applica (passa oltre):
 *   - nessun file nella richiesta (`req.file` assente);
 *   - richiedente senza scuola (admin globale, `scuola_id = null`);
 *   - scuola senza limite di storage impostato (`limite_storage_byte = null`).
 */
const verificaQuotaStorage = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const scuolaId = req.user && req.user.scuola_id ? req.user.scuola_id : null;
    if (!scuolaId) return next(); // admin globale: nessuna quota

    const scuola = await Scuola.findByPk(scuolaId);
    // Scuola inesistente o senza limite: lascia decidere ai controlli a valle.
    if (!scuola || scuola.limite_storage_byte === null || scuola.limite_storage_byte === undefined) {
      return next();
    }

    await quotaService.assicuraSpazioStorage(scuola, req.file.size);
    return next();
  } catch (err) {
    // Quota superata (o altro errore): rimuovi il binario appena caricato.
    if (req.file && req.file.path) {
      try {
        await fsp.unlink(req.file.path);
      } catch (unlinkErr) {
        if (unlinkErr.code !== 'ENOENT') {
          logger.warn(
            `[QUOTA] Impossibile rimuovere il file oltre-quota ${req.file.path}: ${unlinkErr.message}`
          );
        }
      }
    }
    return next(err);
  }
};

module.exports = { verificaQuotaStorage };
