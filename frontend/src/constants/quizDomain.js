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

// ── Domini del Quiz (allineati a DOMINI del backend quizService) ─────
// Il Quiz supporta due domini sullo stesso flusso: sillabari (kana) e
// ideogrammi (kanji). Il valore viaggia nel body di /generate e /submit;
// la sua assenza equivale a 'kana' (retrocompatibilità).
export const DOMINI_QUIZ = Object.freeze(['kana', 'kanji']);

// ── Livelli JLPT (allineati a LIVELLI_JLPT del backend kanjiData) ────
// Dal più facile (N5) al più difficile (N1). L'ordine è quello mostrato
// nel selettore di livello del Quiz Kanji e della pratica di scrittura.
export const LIVELLI_JLPT = Object.freeze(['N5', 'N4', 'N3', 'N2', 'N1']);

// ── Tipologie del Quiz Kanji (allineate a TIPI_QUIZ_KANJI del backend) ─
//   - production : kanji da richiamare a memoria (autovalutazione);
//   - recognition: kanji → scelta del significato (4 opzioni);
//   - reading    : kanji + tipo di lettura → scelta della lettura (4 opzioni).
export const TIPI_QUIZ_KANJI = Object.freeze(['production', 'recognition', 'reading']);

// Tipo di quiz Kanji predefinito (coincide col default del backend).
export const TIPO_QUIZ_KANJI_DEFAULT = 'recognition';

/**
 * Livelli JLPT per cui il backend fornisce già i DATI DEI TRATTI dei kanji
 * (endpoint /quiz/stroke/kanji/:livello). Gli altri livelli restituiscono un
 * elenco vuoto in modo controllato: la pratica di scrittura mostra allora uno
 * stato "non ancora disponibile". Tenuto qui solo per l'esperienza d'uso: la
 * verità resta il backend, che omette con eleganza i kanji senza tratti.
 */
export const LIVELLI_TRATTI_KANJI = Object.freeze(['N5']);

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
