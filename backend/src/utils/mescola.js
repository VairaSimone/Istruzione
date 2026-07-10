'use strict';

/**
 * MESCOLAMENTO DI UN ARRAY — algoritmo di Fisher-Yates (variante di Durstenfeld).
 *
 * Estratto qui perché la stessa identica implementazione era duplicata in
 * `quizService`, `quizGestioneService` e `statisticheService`: tre copie da
 * mantenere allineate, con il rischio che una divergesse dalle altre.
 *
 * ATTENZIONE — la funzione mescola l'array SUL POSTO e lo restituisce, così
 * come facevano le tre copie originali. I chiamanti che non vogliono mutare
 * l'originale devono passare una copia: `mescola([...caratteri])`.
 *
 * Usa `Math.random()`: adeguato alla selezione didattica dei quiz, NON adatto a
 * scopi crittografici (per token e segreti si usa `crypto`, cfr. `tokenHash`).
 *
 * @template T
 * @param {T[]} arr array da mescolare (mutato)
 * @returns {T[]} lo stesso array, mescolato
 */
const mescola = (arr) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

module.exports = { mescola };
