'use strict';

const AppError = require('../../utils/AppError');
const { ALFABETI, GRUPPI_VALIDI } = require('../kanaData');
const { LIVELLI_DISPONIBILI } = require('../kanjiData');

/**
 * CATALOGO DEI TEMPLATE DI QUIZ (registro in codice).
 *
 * Un TEMPLATE è un quiz "di piattaforma" con un MOTORE dedicato (logica di
 * generazione delle domande scritta in codice, non righe di database). Il quiz
 * di giapponese storico — kana e kanji — vive qui: non è più un contenuto
 * cablato nell'applicazione, ma un template che ogni SCUOLA decide se
 * INSTALLARE o meno.
 *
 * Installare un template significa creare una riga in `quiz` con
 * `template_codice` valorizzato e una `configurazione` JSON che ne fissa i
 * parametri (es. \"solo hiragana, senza yōon\"). Una stessa scuola può installare
 * lo stesso template più volte con configurazioni diverse (es. un quiz per gli
 * hiragana e uno per i katakana).
 *
 * I QUIZ PERSONALIZZATI (motore `domande`) non hanno template: le domande sono
 * righe in `domande_quiz` create dagli insegnanti e possono riguardare qualsiasi
 * materia (matematica, storia, inglese…). Non c'è nulla di giapponese nel motore.
 *
 * ─────────────────────────────────────────────
 * COME AGGIUNGERE UN NUOVO TEMPLATE (in futuro)
 * ─────────────────────────────────────────────
 *   1. se serve un nuovo MOTORE, implementarne la generazione in `quizService`
 *      (funzione `generate<Motore>QuizPool`) e mapparla nel dispatcher;
 *   2. aggiungere qui un descrittore al vettore `TEMPLATE`:
 *        { codice, nome, descrizione, materia, categoria, esempio, motore,
 *          configurazioneDefault, campiSovrascrivibili, valida }
 *   3. nessuna migrazione richiesta: `quiz.template_codice` è una stringa e
 *      `quiz.configurazione` un blob JSON libero.
 *
 * Un template NON deve stare in questo file per forza: la sua implementazione
 * (dizionari + motore) può vivere in un modulo separato ed essere importata
 * qui. Il registro è l'unico punto di aggancio.
 *
 * Ogni descrittore espone `valida(configurazione)` che NORMALIZZA il blob
 * (scartando le chiavi sconosciute) e lancia 422 se un valore non è ammesso:
 * il database non contiene quindi mai configurazioni non interpretabili.
 */

// Tipologie del quiz kanji (usate anche dal motore in quizService).
const TIPI_QUIZ_KANJI = ['production', 'recognition', 'reading'];

// Lingue ammesse per i significati dei kanji.
const LINGUE_QUIZ = ['it', 'en'];

// ─────────────────────────────────────────────
// Helper di validazione dei blob di configurazione
// ─────────────────────────────────────────────

/** True se il valore è \"non impostato\" (il campo resta scelto a runtime). */
const nonImpostato = (v) => v === undefined || v === null || v === '';

const erroreConfig = (messaggio) =>
  new AppError(messaggio, 422, 'INVALID_QUIZ_CONFIG');

/** Valida un valore contro un elenco chiuso; `undefined` se non impostato. */
const valoreTraAmmessi = (valore, ammessi, etichetta) => {
  if (nonImpostato(valore)) return undefined;
  if (!ammessi.includes(valore)) {
    throw erroreConfig(`${etichetta} deve essere uno di: ${ammessi.join(', ')}.`);
  }
  return valore;
};

/** Valida un booleano; `undefined` se non impostato. */
const valoreBooleano = (valore, etichetta) => {
  if (nonImpostato(valore)) return undefined;
  if (typeof valore !== 'boolean') {
    throw erroreConfig(`${etichetta} deve essere un booleano.`);
  }
  return valore;
};

/** Valida un array di stringhe contenuto in `ammessi`; `undefined` se assente. */
const valoreArray = (valore, ammessi, etichetta) => {
  if (nonImpostato(valore)) return undefined;
  if (!Array.isArray(valore)) {
    throw erroreConfig(`${etichetta} deve essere un array.`);
  }
  for (const v of valore) {
    if (!ammessi.includes(v)) {
      throw erroreConfig(`${etichetta}: valore non ammesso \"${v}\".`);
    }
  }
  // De-duplica preservando l'ordine.
  return [...new Set(valore)];
};

/** Rimuove le chiavi `undefined` (così il JSON persistito resta minimale). */
const compatta = (oggetto) =>
  Object.fromEntries(Object.entries(oggetto).filter(([, v]) => v !== undefined));

// ─────────────────────────────────────────────
// TEMPLATE: kana (hiragana / katakana)
// ─────────────────────────────────────────────
const validaConfigurazioneKana = (configurazione = {}) => {
  if (configurazione === null || typeof configurazione !== 'object' || Array.isArray(configurazione)) {
    throw erroreConfig('La configurazione deve essere un oggetto JSON.');
  }
  return compatta({
    alfabeto: valoreTraAmmessi(configurazione.alfabeto, ALFABETI, "L'alfabeto"),
    gruppi: valoreArray(configurazione.gruppi, GRUPPI_VALIDI, 'I gruppi'),
    includiDakuon: valoreBooleano(configurazione.includiDakuon, 'includiDakuon'),
    includiYoon: valoreBooleano(configurazione.includiYoon, 'includiYoon'),
  });
};

// ─────────────────────────────────────────────
// TEMPLATE: kanji (per livello JLPT)
// ─────────────────────────────────────────────
const validaConfigurazioneKanji = (configurazione = {}) => {
  if (configurazione === null || typeof configurazione !== 'object' || Array.isArray(configurazione)) {
    throw erroreConfig('La configurazione deve essere un oggetto JSON.');
  }
  return compatta({
    livello: valoreTraAmmessi(configurazione.livello, LIVELLI_DISPONIBILI, 'Il livello JLPT'),
    tipoQuiz: valoreTraAmmessi(configurazione.tipoQuiz, TIPI_QUIZ_KANJI, 'Il tipo di quiz'),
    lingua: valoreTraAmmessi(configurazione.lingua, LINGUE_QUIZ, 'La lingua'),
  });
};

// ─────────────────────────────────────────────
// REGISTRO
// ─────────────────────────────────────────────
const TEMPLATE = [
  {
    codice: 'kana',
    nome: 'Giapponese — Hiragana e Katakana',
    descrizione:
      'Quiz sui sillabari giapponesi con ripetizione spaziata (SRS), gruppi selezionabili, dakuon e yōon.',
    materia: 'Giapponese',
    categoria: 'Sistemi di scrittura',
    // Template DI ESEMPIO fornito con la piattaforma. Non viene installato
    // automaticamente in nessuna scuola: è disponibile nel catalogo.
    esempio: true,
    // La pratica dei tratti richiede la funzionalità omonima; il quiz in sé no.
    funzionalitaRichiesta: 'quiz',
    motore: 'kana',
    // Nessun campo fissato: la scuola può lasciare la scelta allo studente.
    configurazioneDefault: {},
    // Campi che, se NON fissati nella configurazione del quiz, lo studente può
    // scegliere al momento della generazione della partita.
    campiSovrascrivibili: ['alfabeto', 'gruppi', 'includiDakuon', 'includiYoon'],
    valida: validaConfigurazioneKana,
  },
  {
    codice: 'kanji',
    nome: 'Giapponese — Kanji JLPT',
    descrizione:
      'Quiz sui kanji per livello JLPT (N5–N1) con tre modalità: riconoscimento, lettura e produzione.',
    materia: 'Giapponese',
    categoria: 'Ideogrammi',
    esempio: true,
    funzionalitaRichiesta: 'quiz',
    motore: 'kanji',
    configurazioneDefault: { tipoQuiz: 'recognition' },
    campiSovrascrivibili: ['livello', 'tipoQuiz', 'lingua'],
    valida: validaConfigurazioneKanji,
  },
];

const CODICI_TEMPLATE = TEMPLATE.map((t) => t.codice);

/** Restituisce il descrittore del template o `null` se il codice non esiste. */
const trovaTemplate = (codice) =>
  TEMPLATE.find((t) => t.codice === codice) || null;

/** Come `trovaTemplate` ma lancia 422 se il codice non è nel catalogo. */
const trovaTemplateObbligatorio = (codice) => {
  const template = trovaTemplate(codice);
  if (!template) {
    throw new AppError(
      `Template di quiz non valido. Usa uno di: ${CODICI_TEMPLATE.join(', ')}.`,
      422,
      'INVALID_QUIZ_TEMPLATE'
    );
  }
  return template;
};

/** Catalogo esponibile al client (senza le funzioni di validazione). */
const catalogoPubblico = () =>
  TEMPLATE.map((t) => ({
    codice: t.codice,
    nome: t.nome,
    descrizione: t.descrizione,
    materia: t.materia,
    categoria: t.categoria || null,
    esempio: Boolean(t.esempio),
    funzionalitaRichiesta: t.funzionalitaRichiesta || 'quiz',
    motore: t.motore,
    configurazioneDefault: t.configurazioneDefault,
    campiSovrascrivibili: t.campiSovrascrivibili,
  }));


/**
 * Risolve i filtri effettivi di una partita generata da un quiz-template.
 *
 * Precedenza: configurazione della SCUOLA (vincolante) → override dello
 * STUDENTE (ammesso solo sui campi non fissati) → default del template.
 * In questo modo la scuola può \"congelare\" un quiz (es. solo katakana) senza
 * che il client possa aggirare la scelta.
 *
 * @param {object} template     descrittore del template
 * @param {object} configurazione configurazione persistita sul quiz
 * @param {object} override     campi proposti dal client
 * @returns {object} filtri risolti (già validati)
 */
const risolviFiltri = (template, configurazione = {}, override = {}) => {
  const configValida = template.valida(configurazione || {});
  const overrideValido = template.valida(override || {});

  const filtri = { ...template.configurazioneDefault };

  for (const campo of template.campiSovrascrivibili) {
    if (configValida[campo] !== undefined) {
      // Campo fissato dalla scuola: l'override del client viene ignorato.
      filtri[campo] = configValida[campo];
    } else if (overrideValido[campo] !== undefined) {
      filtri[campo] = overrideValido[campo];
    }
  }

  return filtri;
};

module.exports = {
  TEMPLATE,
  CODICI_TEMPLATE,
  TIPI_QUIZ_KANJI,
  LINGUE_QUIZ,
  trovaTemplate,
  trovaTemplateObbligatorio,
  catalogoPubblico,
  risolviFiltri,
};
