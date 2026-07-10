/**
 * Costanti dei QUIZ DELLE SCUOLE (template installabili + quiz personalizzati).
 *
 * Rispecchiano ESATTAMENTE i valori del backend:
 *   - `Quiz.STATI_QUIZ`, `Quiz.DIMENSIONE_ROUND_*`, `Quiz.MATERIA_MAX`
 *   - `DomandaQuiz.TIPI_DOMANDA`, `OPZIONI_MIN/MAX`, `TESTO_MAX`, `RISPOSTA_MAX`
 *   - `constants/quizTemplates/index.js` → `CODICI_TEMPLATE`, `MOTORI`
 *
 * Le etichette leggibili non stanno qui: sono risolte a runtime dalle chiavi
 * i18n `quizGestione.*`.
 */

/** Stato di pubblicazione di un quiz (identico a corsi e compiti). */
export const STATI_QUIZ = Object.freeze(['bozza', 'pubblicato', 'archiviato']);

/**
 * Codici dei template di piattaforma installabili. Il catalogo autorevole
 * arriva da `GET /quiz/templates`: questa lista serve solo ai filtri e alla
 * validazione ottimistica dei form, e va tenuta allineata al registro del
 * backend.
 *
 * `kana` e `kanji` sono i template DI ESEMPIO forniti con la piattaforma: una
 * scuola li installa se insegna giapponese, altrimenti non li incontra mai.
 * Quando il catalogo si allargherà ad altre materie, questa lista crescerà —
 * senza che nulla nel resto del frontend debba cambiare, perché i form leggono
 * il catalogo dall'API.
 */
export const CODICI_TEMPLATE = Object.freeze(['kana', 'kanji']);

/** Valore sentinella del filtro "solo quiz senza template". */
export const FILTRO_PERSONALIZZATO = 'personalizzato';

/**
 * Motore di un quiz:
 *   - 'kana' / 'kanji' → template di piattaforma, domande generate in codice;
 *   - 'domande'        → quiz personalizzato, domande scritte dagli insegnanti.
 */
export const MOTORI_QUIZ = Object.freeze(['kana', 'kanji', 'domande']);

/** Tipi di domanda di un quiz personalizzato. */
export const TIPI_DOMANDA = Object.freeze([
  'scelta_multipla',
  'vero_falso',
  'risposta_breve',
]);

// ── Limiti (allineati ai modelli e ai validator del backend) ──────────
export const OPZIONI_MIN = 2;
export const OPZIONI_MAX = 6;
export const DOMANDA_TESTO_MAX = 2000;
export const DOMANDA_RISPOSTA_MAX = 255;
export const OPZIONE_TESTO_MAX = 500;
export const MAX_RISPOSTE_ALTERNATIVE = 10;
export const MAX_DOMANDE_PER_QUIZ = 500;

export const QUIZ_TITOLO_MIN = 2;
export const QUIZ_TITOLO_MAX = 160;
export const QUIZ_MATERIA_MAX = 80;
export const QUIZ_CATEGORIA_MAX = 80;
export const QUIZ_DESCRIZIONE_MAX = 10000;

export const DIMENSIONE_ROUND_MIN = 1;
export const DIMENSIONE_ROUND_MAX = 50;
export const DIMENSIONE_ROUND_DEFAULT = 20;

/**
 * Impostazione di scuola che governa l'ESERCIZIO LIBERO sui template (giocare
 * un motore di template senza passare da un quiz installato dagli insegnanti).
 * Vive in `impostazioni.didattica.accessoLiberoTemplate`.
 * Assente o `true` ⇒ accesso libero; `false` ⇒ solo quiz assegnati all'aula.
 */
export const CHIAVE_TEMPLATE_LIBERO = 'accessoLiberoTemplate';

/**
 * Campi della `configurazione` che ogni template può fissare. Se la scuola li
 * valorizza, lo studente non può più sovrascriverli: la schermata di setup
 * nasconde il controllo corrispondente e mostra il valore imposto.
 */
export const CAMPI_CONFIGURAZIONE_TEMPLATE = Object.freeze({
  kana: ['alfabeto', 'gruppi', 'includiDakuon', 'includiYoon'],
  kanji: ['livello', 'tipoQuiz', 'lingua'],
});

/** Tono del Badge per lo stato del quiz (coerente con corsi/compiti). */
export const STATO_QUIZ_TONE = Object.freeze({
  bozza: 'gold',
  pubblicato: 'matcha',
  archiviato: 'neutral',
});
