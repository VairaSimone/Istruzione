'use strict';

const AppError = require('../utils/AppError');
const { INDICE_KANA, ALFABETI } = require('../constants/kanaData');
const {
  STROKE_VIEWBOX,
  STROKE_LICENZA,
  componentiTratti,
} = require('../constants/strokeData');

/**
 * StrokeService — dati dell'ORDINE DEI TRATTI per il Quiz Kana.
 *
 * Speculare a `quizService` (che gestisce SRS/XP/statistiche), questo service
 * espone i dati grafici dei tratti necessari a:
 *   - la visualizzazione animata dell'ordine di scrittura (frontend SVG);
 *   - gli esercizi di scrittura su canvas (validazione basilare del tratto).
 *
 * I dati sono statici (derivati da KanjiVG) e non dipendono dall'utente: il
 * frontend li recupera una sola volta per alfabeto e li mette in cache a lungo.
 */

/**
 * Restituisce l'ordine dei tratti di TUTTI i kana di un alfabeto.
 *
 * Per ogni voce dell'indice canonico (`INDICE_KANA`) ne riusa categoria/gruppo
 * e ne scompone il carattere nei componenti grafici (gli yōon hanno due
 * componenti). Le voci prive di dati grafici vengono semplicemente omesse,
 * così l'API resta coerente anche se un glifo non fosse mappato.
 *
 * @param {string} alfabeto 'hiragana' | 'katakana'
 * @returns {{
 *   alfabeto:string,
 *   viewBox:string,
 *   licenza:object,
 *   totale:number,
 *   caratteri:Array<{
 *     kana:string, romaji:string, categoria:string, gruppo:string,
 *     componenti:Array<{ carattere:string, strokes:string[] }>
 *   }>
 * }}
 */
const getStrokeOrderByAlfabeto = (alfabeto) => {
  if (!ALFABETI.includes(alfabeto)) {
    throw new AppError(
      'Alfabeto non valido. Usa "hiragana" o "katakana".',
      422,
      'INVALID_ALPHABET'
    );
  }

  const caratteri = [];
  for (const entry of INDICE_KANA) {
    if (entry.tipo !== alfabeto) continue;

    const componenti = componentiTratti(entry.kana);
    if (!componenti) continue; // glifo non mappato ⇒ omesso

    caratteri.push({
      kana: entry.kana,
      romaji: entry.romaji,
      categoria: entry.categoria,
      gruppo: entry.gruppo,
      componenti,
    });
  }

  return {
    alfabeto,
    viewBox: STROKE_VIEWBOX,
    licenza: STROKE_LICENZA,
    totale: caratteri.length,
    caratteri,
  };
};

module.exports = {
  getStrokeOrderByAlfabeto,
};
