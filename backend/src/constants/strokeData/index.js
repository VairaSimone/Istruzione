'use strict';

const hiragana = require('./hiragana.json');
const katakana = require('./katakana.json');

/**
 * Costanti dell'ORDINE DEI TRATTI (stroke order) dei kana.
 *
 * Fonte di verità per i dati grafici dei tratti, speculare a `kanaData.js` per
 * la parte testuale del Quiz. I dataset JSON sono generati offline da KanjiVG
 * tramite `scripts/generaStrokeData.js` (vedi quel file per i dettagli) e qui
 * vengono solo caricati ed esposti con utility di lookup.
 *
 * Struttura dei dataset (keyed per singolo carattere):
 *   { 'あ': { strokes: ['<d1>', '<d2>', ...] }, ... }
 *
 * Le coordinate dei path sono nel sistema nativo di KanjiVG: viewBox
 * "0 0 109 109", con l'ordine dell'array che coincide con l'ordine dei tratti.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  ATTRIBUZIONE / LICENZA (share-alike — obbligatoria)
 *  I dati derivano da KanjiVG (https://kanjivg.tagaini.net),
 *  Copyright (C) Ulrich Apel et al., licenza Creative Commons
 *  Attribution-Share Alike 3.0 (https://creativecommons.org/licenses/by-sa/3.0/).
 *  L'attribuzione è propagata al client nel payload dell'API (campo `licenza`).
 * ──────────────────────────────────────────────────────────────────────────
 */

// viewBox nativo dei path KanjiVG: il frontend lo usa per scalare/animare.
const STROKE_VIEWBOX = '0 0 109 109';

// Attribuzione esposta al client (requisito share-alike di KanjiVG).
const STROKE_LICENZA = Object.freeze({
  fonte: 'KanjiVG',
  url: 'https://kanjivg.tagaini.net',
  licenza: 'CC BY-SA 3.0',
  licenzaUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
});

// Mappa per tipo, così il lookup è O(1) e indipendente dal blocco Unicode.
const SORGENTI_TRATTI = {
  hiragana,
  katakana,
};

/**
 * Restituisce l'array di tratti (stringhe `d`) di un singolo carattere kana,
 * cercandolo in entrambi i dataset, oppure `null` se assente.
 * @param {string} carattere singolo code point (es. 'き', 'ゃ')
 * @returns {string[]|null}
 */
const trattiPerCarattere = (carattere) => {
  for (const tipo of Object.keys(SORGENTI_TRATTI)) {
    const entry = SORGENTI_TRATTI[tipo][carattere];
    if (entry) return entry.strokes;
  }
  return null;
};

/**
 * Scompone una stringa kana nei suoi componenti grafici con i relativi tratti.
 * Gli yōon (es. 'きゃ') sono composti da due caratteri: ognuno è reso come un
 * glifo a sé, così il frontend può mostrarli in celle affiancate.
 *
 * @param {string} kana es. 'か', 'が', 'きゃ'
 * @returns {Array<{ carattere:string, strokes:string[] }> | null}
 *          `null` se ANCHE UN SOLO componente manca dai dataset.
 */
const componentiTratti = (kana) => {
  const componenti = [];
  for (const carattere of Array.from(kana)) {
    const strokes = trattiPerCarattere(carattere);
    if (!strokes) return null;
    componenti.push({ carattere, strokes });
  }
  return componenti;
};

module.exports = {
  STROKE_VIEWBOX,
  STROKE_LICENZA,
  trattiPerCarattere,
  componentiTratti,
};
