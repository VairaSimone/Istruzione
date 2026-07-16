'use strict';

/**
 * magicBytes — riconoscimento del tipo REALE di un file dal suo contenuto.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ SERVE
 * ─────────────────────────────────────────────
 * `file.mimetype` di multer NON è il tipo del file: è il `Content-Type` della
 * parte multipart, cioè una stringa che sceglie il CLIENT. Un `.exe` rinominato
 * e dichiarato `video/mp4` passa qualunque whitelist basata su quel campo, e
 * finisce su disco con estensione `.mp4`.
 *
 * Qui il tipo si legge dai primi byte del file, che il client non può falsificare
 * senza produrre davvero un file di quel formato.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ NON UNA LIBRERIA
 * ─────────────────────────────────────────────
 * `file-type` risolverebbe il caso generale, ma dalla v19 è ESM-only (questo è
 * un progetto CommonJS) e porta un albero di dipendenze per riconoscere centinaia
 * di formati. A noi ne servono ~19: esattamente quelli della whitelist di
 * `config/upload.js`, chiusa e nostra. Il progetto ha già scelto altre volte di
 * non aggiungere dipendenze per problemi di questa taglia (gli scheduler sono
 * `setInterval`): la stessa logica vale qui.
 *
 * ─────────────────────────────────────────────
 * COSA NON FA
 * ─────────────────────────────────────────────
 * Non è un antivirus e non valida la struttura interna dei formati. Dice se i
 * primi byte sono coerenti con il tipo DICHIARATO — che è tutto ciò che serve
 * per impedire il travestimento. I formati senza firma (`text/plain`, `text/csv`)
 * non sono riconoscibili per costruzione: per loro si verifica che il contenuto
 * sia testo plausibile e nulla più (un .txt non è pericoloso proprio perché non
 * ha una struttura da sfruttare).
 */

/**
 * Byte da leggere dalla testa del file. Le firme più lunghe che ci interessano
 * (Matroska, i box ISO-BMFF) stanno abbondantemente in questa finestra.
 * @type {number}
 */
const BYTE_DA_LEGGERE = 4096;

/** Confronta una sequenza di byte a un dato offset. */
const inizia = (buf, byte, offset = 0) => {
  if (buf.length < offset + byte.length) return false;
  for (let i = 0; i < byte.length; i++) {
    if (buf[offset + i] !== byte[i]) return false;
  }
  return true;
};

/** Confronta una stringa ASCII a un dato offset. */
const ascii = (buf, testo, offset = 0) => inizia(buf, Buffer.from(testo, 'ascii'), offset);

// ─────────────────────────────────────────────
// Riconoscitori per FAMIGLIA di formato
// ─────────────────────────────────────────────

/** ISO Base Media File Format: MP4, MOV, e derivati. Box `ftyp` a offset 4. */
const isoBmff = (buf) => ascii(buf, 'ftyp', 4);

/** ZIP (e tutto ciò che ci è costruito sopra: docx, xlsx, pptx). */
const zip = (buf) =>
  inizia(buf, [0x50, 0x4b, 0x03, 0x04]) || // normale
  inizia(buf, [0x50, 0x4b, 0x05, 0x06]) || // vuoto
  inizia(buf, [0x50, 0x4b, 0x07, 0x08]); //  spanned

/** Compound File Binary: i vecchi .doc/.xls/.ppt di Office. */
const cfb = (buf) => inizia(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** RIFF con sotto-tipo (AVI, WEBP…). */
const riff = (buf, sottotipo) => ascii(buf, 'RIFF') && ascii(buf, sottotipo, 8);

/**
 * Testo plausibile: nessun byte NUL e pochissimi caratteri di controllo.
 * I file di testo non hanno firma; questo è il massimo che si possa dire.
 */
const testoPlausibile = (buf) => {
  if (buf.length === 0) return true; // file vuoto: innocuo
  let controllo = 0;
  for (const b of buf) {
    if (b === 0x00) return false; // un NUL non sta in un file di testo
    // Ammessi: tab, LF, CR, form feed e tutto il resto stampabile/UTF-8.
    if (b < 0x09 || (b > 0x0d && b < 0x20)) controllo++;
  }
  return controllo / buf.length < 0.05;
};

/**
 * Verificatori per MIME. Ogni voce riceve i primi byte e dice se il contenuto è
 * COERENTE con quel MIME. Le chiavi combaciano una a una con `MIME_AMMESSI` di
 * `config/upload.js`: aggiungere un MIME là senza aggiungerlo qui fa fallire il
 * controllo di coerenza dei test, non la produzione (cfr. `mimeNonVerificabili`).
 *
 * @type {Object<string, (buf: Buffer) => boolean>}
 */
const VERIFICATORI = {
  // ── Video ──
  'video/mp4': (b) => isoBmff(b),
  'video/webm': (b) => inizia(b, [0x1a, 0x45, 0xdf, 0xa3]), // EBML (WebM e Matroska)
  'video/x-matroska': (b) => inizia(b, [0x1a, 0x45, 0xdf, 0xa3]),
  'video/ogg': (b) => ascii(b, 'OggS'),
  // MOV e MP4 condividono il contenitore ISO-BMFF: il brand (`qt  `, `isom`,
  // `mp42`…) li distingue, ma non ci interessa distinguerli — sono entrambi
  // video leciti, e restringere il brand rifiuterebbe file validi per nulla.
  'video/quicktime': (b) => isoBmff(b),
  'video/x-msvideo': (b) => riff(b, 'AVI '),

  // ── Immagini ──
  'image/jpeg': (b) => inizia(b, [0xff, 0xd8, 0xff]),
  'image/png': (b) => inizia(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (b) => ascii(b, 'GIF87a') || ascii(b, 'GIF89a'),
  'image/webp': (b) => riff(b, 'WEBP'),

  // ── Documenti ──
  'application/pdf': (b) => ascii(b, '%PDF-'),
  'application/msword': (b) => cfb(b),
  'application/vnd.ms-excel': (b) => cfb(b),
  'application/vnd.ms-powerpoint': (b) => cfb(b),
  // OOXML: sono archivi ZIP. Distinguere docx da xlsx richiederebbe di aprire
  // l'archivio e leggere `[Content_Types].xml`: non serve. Ciò che conta è che
  // non sia un eseguibile travestito, e uno ZIP non lo è.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => zip(b),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => zip(b),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (b) => zip(b),
  'application/zip': (b) => zip(b),
  'text/plain': (b) => testoPlausibile(b),
  'text/csv': (b) => testoPlausibile(b),
};

/** True se per questo MIME esiste un verificatore. */
const verificabile = (mime) => Object.prototype.hasOwnProperty.call(VERIFICATORI, mime);

/**
 * Verifica che i byte iniziali siano coerenti con il MIME dichiarato.
 *
 * FAIL-CLOSED: un MIME per cui non esiste un verificatore è respinto. Non
 * dovrebbe mai capitare — la whitelist di `config/upload.js` e questa mappa sono
 * la stessa lista — ma se qualcuno aggiungesse un tipo di là dimenticandosi di
 * qua, la conseguenza dev'essere un upload rifiutato, non un controllo saltato
 * in silenzio.
 *
 * @param {Buffer} buf   primi byte del file (cfr. BYTE_DA_LEGGERE)
 * @param {string} mime  MIME dichiarato dal client, già passato dalla whitelist
 * @returns {boolean}
 */
const coerente = (buf, mime) => {
  if (!verificabile(mime)) return false;
  return VERIFICATORI[mime](buf);
};

module.exports = {
  BYTE_DA_LEGGERE,
  VERIFICATORI,
  verificabile,
  coerente,
};
