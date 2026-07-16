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
 *   - nessun file nella richiesta;
 *   - richiedente senza scuola (admin globale, `scuola_id = null`);
 *   - scuola senza limite di storage impostato (`limite_storage_byte = null`).
 *
 * ─────────────────────────────────────────────
 * IL PROBLEMA DEL «CONTROLLA POI SCRIVI» (TOCTOU)
 * ─────────────────────────────────────────────
 * L'occupato è un `SUM(dimensione_byte)` su `file_caricati`: conta solo ciò che
 * è GIÀ nel database. Ma tra questo controllo e la INSERT del controller passa
 * tempo, e in quel tempo la riga non esiste ancora. Con N upload concorrenti
 * sulla stessa scuola, tutti leggevano lo stesso «occupato» di partenza, tutti
 * concludevano che c'era spazio e tutti passavano: la quota veniva superata di
 * N−1 file senza che un solo controllo fallisse.
 *
 * ─────────────────────────────────────────────
 * LA PRENOTAZIONE
 * ─────────────────────────────────────────────
 * Un upload in corso è spazio GIÀ occupato su disco: solo, il database non lo sa
 * ancora. Perciò lo teniamo noi. Quando il controllo passa, i byte vengono
 * PRENOTATI in un registro in memoria e sommati all'occupato letto dal database;
 * la prenotazione si rilascia quando la risposta si chiude — a quel punto o la
 * riga esiste (e la conta il SUM) o il file è stato scartato.
 *
 * Così N richieste concorrenti si vedono a vicenda, e la prima che non ci sta
 * viene respinta invece di passare perché nessuna delle altre ha ancora fatto in
 * tempo a scrivere.
 *
 * LIMITE, dichiarato: il registro è in-process, come la cache delle impostazioni
 * e i rate limiter. In un deploy multi-istanza due processi non vedono le
 * reciproche prenotazioni, e lo sforamento torna possibile — ma limitato alla
 * concorrenza FRA ISTANZE, non più fra richieste della stessa istanza, che è il
 * caso reale. La soluzione definitiva è quella di B19: stato condiviso (Redis),
 * oppure un `SELECT … FOR UPDATE` che copra anche la INSERT del controller.
 */

/**
 * Byte prenotati e non ancora presenti in `file_caricati`, per scuola.
 * @type {Map<string, number>}
 */
const _prenotati = new Map();

/** Byte attualmente in volo per la scuola. */
const inVolo = (scuolaId) => _prenotati.get(String(scuolaId)) || 0;

const prenota = (scuolaId, byte) => {
  const chiave = String(scuolaId);
  _prenotati.set(chiave, (_prenotati.get(chiave) || 0) + byte);
};

const rilascia = (scuolaId, byte) => {
  const chiave = String(scuolaId);
  const residuo = (_prenotati.get(chiave) || 0) - byte;
  if (residuo > 0) _prenotati.set(chiave, residuo);
  else _prenotati.delete(chiave);
};

/**
 * Tutti i file della richiesta, qualunque forma abbia usato multer.
 *
 * Il middleware guardava solo `req.file`. Oggi è coerente — si usa solo
 * `.single()` — ma un futuro `.array()` o `.fields()` sarebbe passato indenne e
 * nulla lo avrebbe segnalato: la quota si sarebbe scoperta scavalcata solo
 * guardando il disco pieno.
 *
 * @returns {Array<{path?: string, size?: number}>}
 */
const fileDellaRichiesta = (req) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    for (const gruppo of Object.values(req.files)) {
      if (Array.isArray(gruppo)) files.push(...gruppo);
    }
  }
  return files;
};

/** Rimuove i binari già a terra, best-effort. */
const rimuoviBinari = async (files) => {
  await Promise.all(
    files
      .filter((f) => f && f.path)
      .map(async (f) => {
        try {
          await fsp.unlink(f.path);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            logger.warn(
              `[QUOTA] Impossibile rimuovere il file oltre-quota ${f.path}: ${err.message}`
            );
          }
        }
      })
  );
};

const verificaQuotaStorage = async (req, res, next) => {
  const files = fileDellaRichiesta(req);
  if (!files.length) return next();

  const scuolaId = req.user && req.user.scuola_id ? req.user.scuola_id : null;
  if (!scuolaId) return next(); // admin globale: nessuna quota

  const richiesto = files.reduce((tot, f) => tot + Number((f && f.size) || 0), 0);

  try {
    const scuola = await Scuola.findByPk(scuolaId);
    // Scuola inesistente o senza limite: lascia decidere ai controlli a valle.
    if (!scuola || scuola.limite_storage_byte === null || scuola.limite_storage_byte === undefined) {
      return next();
    }

    // I byte già prenotati da altre richieste in corso contano come occupati:
    // sono su disco, il database non lo sa ancora.
    await quotaService.assicuraSpazioStorage(scuola, richiesto + inVolo(scuolaId));

    // Da qui la richiesta ha diritto al proprio spazio: lo prenota finché la
    // riga non è scritta (o finché la richiesta non finisce comunque).
    prenota(scuolaId, richiesto);
    let rilasciato = false;
    const liberaUnaVolta = () => {
      if (rilasciato) return;
      rilasciato = true;
      rilascia(scuolaId, richiesto);
    };
    // `finish` = risposta inviata; `close` = connessione caduta prima. Servono
    // entrambi: senza `close` una prenotazione resterebbe appesa per sempre.
    res.on('finish', liberaUnaVolta);
    res.on('close', liberaUnaVolta);

    return next();
  } catch (err) {
    // Quota superata (o altro errore): rimuovi i binari appena caricati.
    await rimuoviBinari(files);
    return next(err);
  }
};

module.exports = { verificaQuotaStorage };
