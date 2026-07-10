/**
 * TIPI DI ATTIVITÀ dei compiti (lato frontend).
 *
 * Rispecchia `backend/src/constants/tipiAttivita.js`. I codici sono NEUTRI:
 * non nominano una materia. Prima della generalizzazione erano un ENUM di
 * database legato al giapponese (`quiz_kana`, `quiz_kanji`, `tracciamento`,
 * `vocabolario`); oggi sono voci di un registro, e aggiungerne uno non richiede
 * alcuna migrazione.
 *
 * Le etichette leggibili non stanno qui: sono risolte a runtime dalle chiavi
 * i18n `compiti.tipi.<codice>` e `compiti.tipiDescrizione.<codice>`.
 */

export const TIPI_ATTIVITA = Object.freeze({
  QUIZ: 'quiz',
  CORSO: 'corso',
  PRATICA_SCRITTURA: 'pratica_scrittura',
  LETTURA: 'lettura',
  CONSEGNA: 'consegna',
  PERSONALIZZATO: 'personalizzato',
});

/** Codici canonici, nell'ordine mostrato nei selettori. */
export const CODICI_ATTIVITA = Object.freeze([
  TIPI_ATTIVITA.QUIZ,
  TIPI_ATTIVITA.CORSO,
  TIPI_ATTIVITA.PRATICA_SCRITTURA,
  TIPI_ATTIVITA.LETTURA,
  TIPI_ATTIVITA.CONSEGNA,
  TIPI_ATTIVITA.PERSONALIZZATO,
]);

/**
 * Chiave della `configurazione` richiesta da ciascun tipo. `null` ⇒ nessun
 * riferimento obbligatorio (la configurazione resta libera).
 */
export const RIFERIMENTO_RICHIESTO = Object.freeze({
  [TIPI_ATTIVITA.QUIZ]: 'quizId',
  [TIPI_ATTIVITA.CORSO]: 'corsoId',
  [TIPI_ATTIVITA.PRATICA_SCRITTURA]: null,
  [TIPI_ATTIVITA.LETTURA]: null,
  [TIPI_ATTIVITA.CONSEGNA]: null,
  [TIPI_ATTIVITA.PERSONALIZZATO]: null,
});

/**
 * Traduzione dei codici STORICI, ancora presenti nei compiti creati prima
 * della generalizzazione (e in eventuali risposte di un backend non aggiornato).
 * Serve solo in LETTURA: il frontend invia sempre i codici canonici.
 */
const MAPPA_LEGACY = Object.freeze({
  quiz_kana: TIPI_ATTIVITA.QUIZ,
  quiz_kanji: TIPI_ATTIVITA.QUIZ,
  tracciamento: TIPI_ATTIVITA.PRATICA_SCRITTURA,
  vocabolario: TIPI_ATTIVITA.PERSONALIZZATO,
});

/**
 * Normalizza un codice in arrivo dal backend al codice canonico.
 * Un codice ignoto viene restituito invariato: meglio mostrare il codice grezzo
 * che nascondere il compito.
 */
export const normalizzaTipoAttivita = (codice) => MAPPA_LEGACY[codice] ?? codice;

/** Chiave i18n dell'etichetta, robusta anche sui codici storici. */
export const etichettaTipoAttivita = (codice) =>
  `compiti.tipi.${normalizzaTipoAttivita(codice)}`;
