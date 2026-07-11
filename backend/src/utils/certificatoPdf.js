'use strict';

const PDFDocument = require('pdfkit');
const logger = require('./logger');

/**
 * certificatoPdf — RENDERING del certificato di fine corso in PDF.
 *
 * È una funzione PURA di presentazione: riceve lo snapshot del modello (colori,
 * testi, orientamento) già risolto, i valori da stampare e — facoltativi — i
 * BYTE di logo e firma (PNG/JPEG); restituisce un Buffer PDF. Nessun accesso al
 * database o al disco vive qui: la risoluzione dei file (e il controllo di
 * appartenenza alla scuola) è responsabilità del certificatoService. Questo
 * separa il dominio dalla presentazione e rende il renderer testabile in
 * isolamento.
 *
 * FONT: si usano i font standard del PDF (Helvetica), inclusi in PDFKit; non
 * serve caricare file di font. Coprono l'alfabeto latino con i diacritici usati
 * in italiano (à, è, é, ò, ù…). Gli alfabeti non latini non sono garantiti: in
 * quel caso andrà registrato un font dedicato (evoluzione futura).
 */

// Dimensioni del foglio A4 in punti PostScript (1 pt = 1/72").
const A4 = { larghezza: 595.28, altezza: 841.89 };

// Mappa dei MIME immagine che PDFKit sa incorporare.
const MIME_IMMAGINE_SUPPORTATI = new Set(['image/png', 'image/jpeg', 'image/jpg']);

/** True se il MIME è incorporabile in un PDF da PDFKit. */
const immagineIncorporabile = (mime) => MIME_IMMAGINE_SUPPORTATI.has(String(mime || '').toLowerCase());

/** Colore valido o fallback, per non far mai fallire il rendering su un colore vuoto. */
const colore = (valore, fallback) =>
  typeof valore === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(valore) ? valore : fallback;

/** Testo non vuoto o null. */
const testo = (valore) => {
  if (valore === undefined || valore === null) return null;
  const s = String(valore).trim();
  return s.length ? s : null;
};

/**
 * Incorpora un'immagine centrata orizzontalmente entro un box, preservando le
 * proporzioni. Best-effort: un'immagine corrotta non deve rompere il PDF.
 *
 * @returns {number} altezza effettivamente occupata (0 se non disegnata)
 */
const disegnaImmagineCentrata = (doc, buffer, { y, maxLarghezza, maxAltezza }) => {
  if (!buffer) return 0;
  try {
    const immagine = doc.openImage(buffer);
    const scala = Math.min(maxLarghezza / immagine.width, maxAltezza / immagine.height, 1);
    const larghezza = immagine.width * scala;
    const altezza = immagine.height * scala;
    const x = (doc.page.width - larghezza) / 2;
    doc.image(immagine, x, y, { width: larghezza, height: altezza });
    return altezza;
  } catch (err) {
    logger.warn(`[CERTIFICATO] Immagine non incorporabile nel PDF: ${err.message}`);
    return 0;
  }
};

/**
 * Genera il PDF del certificato.
 *
 * @param {Object} args
 * @param {Object} args.modello             snapshot del modello (colori, orientamento…)
 * @param {string} args.titolo              intestazione grande
 * @param {?string} args.sottotitolo        riga sopra il nome studente
 * @param {string} args.nomeStudente        nome completo dello studente
 * @param {string} args.corpo               corpo già con i segnaposto sostituiti
 * @param {?string} args.esito              esito/voto (facoltativo)
 * @param {?string} args.firmatarioNome
 * @param {?string} args.firmatarioTitolo
 * @param {?string} args.dataTesto          data di completamento già formattata
 * @param {?string} args.piePagina
 * @param {?string} args.codice             codice di verifica (null ⇒ non stampato)
 * @param {?{buffer:Buffer, mime:string}} args.logo
 * @param {?{buffer:Buffer, mime:string}} args.firma
 * @returns {Promise<Buffer>}
 */
const generaCertificatoPdf = (args) =>
  new Promise((resolve, reject) => {
    try {
      const modello = args.modello || {};
      const orizzontale = (modello.orientamento || 'orizzontale') === 'orizzontale';

      const larghezza = orizzontale ? A4.altezza : A4.larghezza;
      const altezza = orizzontale ? A4.larghezza : A4.altezza;

      const cTitolo = colore(modello.coloreTitolo, '#1F2937');
      const cTesto = colore(modello.coloreTesto, '#374151');
      const cBordo = colore(modello.coloreBordo, '#4F46E5');
      const cSfondo = colore(modello.coloreSfondo, '#FFFFFF');
      const cTenue = '#6B7280';

      const doc = new PDFDocument({
        size: [larghezza, altezza],
        margin: 0,
        info: {
          Title: testo(args.titolo) || 'Certificato',
          Author: testo(args.firmatarioNome) || 'Piattaforma didattica',
          Subject: testo(args.nomeStudente) || undefined,
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Sfondo ──────────────────────────────────────────────
      if (cSfondo.toUpperCase() !== '#FFFFFF') {
        doc.rect(0, 0, larghezza, altezza).fill(cSfondo);
      }

      // ── Cornice decorativa (doppio filo) ────────────────────
      const margine = 28;
      doc
        .lineWidth(3)
        .strokeColor(cBordo)
        .rect(margine, margine, larghezza - margine * 2, altezza - margine * 2)
        .stroke();
      doc
        .lineWidth(1)
        .strokeColor(cBordo)
        .rect(margine + 8, margine + 8, larghezza - (margine + 8) * 2, altezza - (margine + 8) * 2)
        .stroke();

      // Area di contenuto interna.
      const padLaterale = margine + 44;
      const larghezzaContenuto = larghezza - padLaterale * 2;
      let y = margine + 40;

      // ── Logo ────────────────────────────────────────────────
      if (args.logo && immagineIncorporabile(args.logo.mime)) {
        const hLogo = disegnaImmagineCentrata(doc, args.logo.buffer, {
          y,
          maxLarghezza: 200,
          maxAltezza: 72,
        });
        if (hLogo) y += hLogo + 18;
      }

      // ── Titolo ──────────────────────────────────────────────
      doc
        .fillColor(cTitolo)
        .font('Helvetica-Bold')
        .fontSize(orizzontale ? 34 : 30)
        .text(testo(args.titolo) || 'Certificato', padLaterale, y, {
          width: larghezzaContenuto,
          align: 'center',
        });
      y = doc.y + 10;

      // Filetto ornamentale sotto il titolo.
      const lineaLarg = Math.min(160, larghezzaContenuto);
      doc
        .lineWidth(2)
        .strokeColor(cBordo)
        .moveTo((larghezza - lineaLarg) / 2, y)
        .lineTo((larghezza + lineaLarg) / 2, y)
        .stroke();
      y += 22;

      // ── Sottotitolo ─────────────────────────────────────────
      const sottotitolo = testo(args.sottotitolo);
      if (sottotitolo) {
        doc
          .fillColor(cTesto)
          .font('Helvetica')
          .fontSize(13)
          .text(sottotitolo, padLaterale, y, { width: larghezzaContenuto, align: 'center' });
        y = doc.y + 8;
      }

      // ── Nome studente ───────────────────────────────────────
      doc
        .fillColor(cTitolo)
        .font('Helvetica-Bold')
        .fontSize(orizzontale ? 26 : 24)
        .text(testo(args.nomeStudente) || '—', padLaterale, y, {
          width: larghezzaContenuto,
          align: 'center',
        });
      y = doc.y + 16;

      // ── Corpo ───────────────────────────────────────────────
      const corpo = testo(args.corpo);
      if (corpo) {
        doc
          .fillColor(cTesto)
          .font('Helvetica')
          .fontSize(13)
          .text(corpo, padLaterale, y, { width: larghezzaContenuto, align: 'center', lineGap: 3 });
        y = doc.y + 12;
      }

      // ── Esito (facoltativo) ─────────────────────────────────
      const esito = testo(args.esito);
      if (esito) {
        doc
          .fillColor(cTitolo)
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(esito, padLaterale, y, { width: larghezzaContenuto, align: 'center' });
        y = doc.y + 8;
      }

      // ── Blocco inferiore: data (sx) e firma (dx) ────────────
      const yBase = altezza - margine - 84;
      const larghezzaColonna = (larghezzaContenuto - 40) / 2;

      // Data (colonna sinistra).
      const dataTesto = testo(args.dataTesto);
      if (dataTesto) {
        doc
          .fillColor(cTesto)
          .font('Helvetica')
          .fontSize(11)
          .text('Data', padLaterale, yBase + 30, { width: larghezzaColonna, align: 'center' });
        doc
          .fillColor(cTitolo)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(dataTesto, padLaterale, yBase + 44, { width: larghezzaColonna, align: 'center' });
        doc
          .lineWidth(0.75)
          .strokeColor(cTenue)
          .moveTo(padLaterale + 20, yBase + 26)
          .lineTo(padLaterale + larghezzaColonna - 20, yBase + 26)
          .stroke();
      }

      // Firma (colonna destra).
      const xFirma = padLaterale + larghezzaContenuto - larghezzaColonna;
      let yContenutoFirma = yBase;
      if (args.firma && immagineIncorporabile(args.firma.mime)) {
        try {
          const immagine = doc.openImage(args.firma.buffer);
          const scala = Math.min(larghezzaColonna / immagine.width, 46 / immagine.height, 1);
          const w = immagine.width * scala;
          const h = immagine.height * scala;
          doc.image(immagine, xFirma + (larghezzaColonna - w) / 2, yBase - h + 24, { width: w, height: h });
        } catch (err) {
          logger.warn(`[CERTIFICATO] Firma non incorporabile: ${err.message}`);
        }
      }
      doc
        .lineWidth(0.75)
        .strokeColor(cTenue)
        .moveTo(xFirma + 20, yContenutoFirma + 26)
        .lineTo(xFirma + larghezzaColonna - 20, yContenutoFirma + 26)
        .stroke();
      const firmatarioNome = testo(args.firmatarioNome);
      if (firmatarioNome) {
        doc
          .fillColor(cTitolo)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(firmatarioNome, xFirma, yContenutoFirma + 30, { width: larghezzaColonna, align: 'center' });
      }
      const firmatarioTitolo = testo(args.firmatarioTitolo);
      if (firmatarioTitolo) {
        doc
          .fillColor(cTesto)
          .font('Helvetica')
          .fontSize(11)
          .text(firmatarioTitolo, xFirma, yContenutoFirma + 46, { width: larghezzaColonna, align: 'center' });
      }

      // ── Piè di pagina: codice di verifica + nota ────────────
      const yPie = altezza - margine - 22;
      const righePie = [];
      const codice = testo(args.codice);
      if (codice) righePie.push(`Codice di verifica: ${codice}`);
      const piePagina = testo(args.piePagina);
      if (piePagina) righePie.push(piePagina);
      if (righePie.length) {
        doc
          .fillColor(cTenue)
          .font('Helvetica')
          .fontSize(8.5)
          .text(righePie.join('   ·   '), padLaterale, yPie, {
            width: larghezzaContenuto,
            align: 'center',
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

module.exports = {
  generaCertificatoPdf,
  immagineIncorporabile,
  A4,
};
