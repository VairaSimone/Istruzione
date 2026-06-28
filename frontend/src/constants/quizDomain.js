/**
 * Costanti di dominio del Quiz Kana (lato frontend).
 *
 * Rispecchiano ESATTAMENTE i valori validi del backend:
 *   - ALFABETI / GRUPPI_VALIDI / CATEGORIE  → src/constants/kanaData.js
 *   - punteggi SRS (0-5, default 3, mastered 5, soglia difficile < 3)
 *   - DIMENSIONE_QUIZ (max 20 kana per partita) → quizService.js
 *
 * Tenute centralizzate per evitare valori "magici" sparsi nei componenti.
 * Le etichette leggibili (alfabeti, gruppi) NON sono qui: sono risolte a
 * runtime tramite le chiavi i18n `quiz.alphabets.*` e `quiz.groups.*`.
 */

export const ALFABETI_QUIZ = Object.freeze(['hiragana', 'katakana']);

/**
 * Righe del gojūon, nello stesso ordine logico del sillabario.
 * Coincidono con GRUPPI_VALIDI del backend (un array vuoto ⇒ "tutte le righe").
 */
export const GRUPPI_KANA = Object.freeze([
  'vowels',
  'k',
  's',
  't',
  'n',
  'h',
  'm',
  'y',
  'r',
  'w',
]);

/** Kana rappresentativo di ogni riga, mostrato come anteprima nel selettore. */
export const ANTEPRIMA_GRUPPO = Object.freeze({
  vowels: 'あ',
  k: 'か',
  s: 'さ',
  t: 'た',
  n: 'な',
  h: 'は',
  m: 'ま',
  y: 'や',
  r: 'ら',
  w: 'わ',
});

// ── Punteggi SRS (allineati a ProgressoKana / quizService) ───────────
export const PUNTEGGIO_SRS_MIN = 0;
export const PUNTEGGIO_SRS_MAX = 5; // "mastered"
export const PUNTEGGIO_SRS_DEFAULT = 3;
export const SOGLIA_SRS_DIFFICILE = 3; // punteggio < 3 ⇒ "da rivedere"

// ── Parametri di gioco (solo per UI; la verità resta nel backend) ────
export const DIMENSIONE_QUIZ = 20; // massimo numero di kana per partita
export const COMBO_SOGLIA = 5; // da 5 risposte consecutive ⇒ XP raddoppiati
export const TIMER_SECONDI = 8; // countdown per domanda in modalità a tempo

/**
 * Romaji alternativi accettati in input oltre alla forma canonica del backend.
 * Il backend memorizza una sola romanizzazione per kana (es. し→"shi"), ma in
 * fase di studio è corretto accettare anche le varianti comuni digitate dagli
 * studenti. La correttezza è calcolata lato client e inviata come `corretto`.
 * Le chiavi sono le forme canoniche restituite da /quiz/generate.
 */
export const ROMAJI_ALTERNATIVI = Object.freeze({
  shi: ['si'],
  chi: ['ti'],
  tsu: ['tu'],
  fu: ['hu'],
  ji: ['zi', 'di'],
  zu: ['du'],
  sha: ['sya'],
  shu: ['syu'],
  sho: ['syo'],
  cha: ['tya'],
  chu: ['tyu'],
  cho: ['tyo'],
  ja: ['jya', 'zya'],
  ju: ['jyu', 'zyu'],
  jo: ['jyo', 'zyo'],
  wo: ['o'],
  n: ['nn', 'n-'],
});
