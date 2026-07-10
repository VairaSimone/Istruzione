'use strict';

const AppError = require('../utils/AppError');
const { INDICE_KANA, ALFABETI } = require('../constants/kanaData');
const {
  LIVELLI_JLPT,
  INDICE_KANJI,
  livelloValido,
  significatiPerLingua,
} = require('../constants/kanjiData');
const {
  STROKE_VIEWBOX,
  STROKE_LICENZA,
  componentiTratti,
} = require('../constants/strokeData');

/**
 * StrokeService — dati dell'ORDINE DEI TRATTI per il Quiz (Kana e Kanji).
 *
 * Speculare a `quizService` (che gestisce SRS/XP/statistiche), questo service
 * espone i dati grafici dei tratti necessari a:
 *   - la visualizzazione animata dell'ordine di scrittura (frontend SVG);
 *   - gli esercizi di scrittura su canvas (validazione basilare del tratto).
 *
 * I dati sono statici (derivati da KanjiVG) e non dipendono dall'utente: il
 * frontend li recupera una sola volta per alfabeto/livello e li mette in cache.
 *
 * La decomposizione grafica è unificata: sia i kana sia i kanji passano per
 * `componentiTratti` (constants/strokeData), che a sua volta interroga il
 * lookup unico dei tratti. Nessuna logica duplicata tra i due domini.
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
 *   dominio:'kana', alfabeto:string, viewBox:string, licenza:object,
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
    dominio: 'kana',
    alfabeto,
    viewBox: STROKE_VIEWBOX,
    licenza: STROKE_LICENZA,
    totale: caratteri.length,
    caratteri,
  };
};

/**
 * Restituisce l'ordine dei tratti di TUTTI i kanji di un livello JLPT.
 *
 * Parallelo esatto di `getStrokeOrderByAlfabeto` ma sul dominio kanji: itera
 * l'indice canonico dei kanji (`INDICE_KANJI`) filtrato per livello e ne
 * scompone l'ideogramma con la STESSA funzione `componentiTratti` usata per i
 * kana (interfaccia unica di recupero tratti). I kanji privi di dati grafici
 * — ad es. i livelli per cui lo stroke dataset non è ancora stato generato —
 * vengono omessi, così l'endpoint resta coerente e mai in errore.
 *
 * Ogni voce include anche letture e significati (nella lingua richiesta) così
 * che il frontend possa mostrare l'etichetta accanto all'animazione senza una
 * seconda chiamata.
 *
 * @param {string} livello uno di LIVELLI_JLPT ('N5'…'N1')
 * @param {string} [lingua='it'] lingua dei significati (fallback all'inglese)
 * @returns {{
 *   dominio:'kanji', livello:string, viewBox:string, licenza:object,
 *   totale:number,
 *   caratteri:Array<{
 *     kanji:string, onYomi:string[], kunYomi:string[], significati:string[],
 *     componenti:Array<{ carattere:string, strokes:string[] }>
 *   }>
 * }}
 */
const getStrokeOrderKanji = (livello, lingua = 'it') => {
  if (!livelloValido(livello)) {
    throw new AppError(
      `Livello JLPT non valido o non disponibile. Usa uno di: ${LIVELLI_JLPT.join(', ')}.`,
      422,
      'INVALID_JLPT_LEVEL'
    );
  }

  const caratteri = [];
  for (const entry of INDICE_KANJI) {
    if (entry.livello !== livello) continue;

    const componenti = componentiTratti(entry.ideogramma);
    if (!componenti) continue; // stroke data non disponibile ⇒ omesso

    caratteri.push({
      kanji: entry.ideogramma,
      onYomi: entry.onYomi,
      kunYomi: entry.kunYomi,
      significati: significatiPerLingua(entry, lingua),
      componenti,
    });
  }

  return {
    dominio: 'kanji',
    livello,
    viewBox: STROKE_VIEWBOX,
    // I dati grafici dei tratti provengono da KanjiVG (come per i kana): è la
    // fonte da attribuire nel visualizzatore, non il dataset testuale KANJIDIC2.
    licenza: STROKE_LICENZA,
    totale: caratteri.length,
    caratteri,
  };
};

module.exports = {
  getStrokeOrderByAlfabeto,
  getStrokeOrderKanji,
};
