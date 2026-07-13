'use strict';

const AppError = require('../../utils/AppError');
const { ALFABETI, GRUPPI_VALIDI } = require('../kanaData');
const { LIVELLI_DISPONIBILI } = require('../kanjiData');
const {
  CODICI_BANCA,
  trovaBanca,
  catalogoBanca,
} = require('../bancaData');

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
// TEMPLATE: banca dati (motore generico `banca`)
//
// La `configurazione` di un quiz-banca fissa la MODALITÀ di interrogazione
// (direzione: es. "simbolo → nome") e, facoltativamente, un sottoinsieme di
// SEZIONI della banca (per costruire mini-quiz su un solo tema). La banca in sé
// è fissata dal template (`banca`), non è scelta dall'utente.
//
// `validaConfigBanca(bancaCodice)` restituisce un validatore legato alla banca,
// che accetta solo modalità e sezioni realmente esistenti in quel dizionario.
// ─────────────────────────────────────────────
const validaConfigBanca = (bancaCodice) => (configurazione = {}) => {
  if (configurazione === null || typeof configurazione !== 'object' || Array.isArray(configurazione)) {
    throw erroreConfig('La configurazione deve essere un oggetto JSON.');
  }
  const banca = trovaBanca(bancaCodice);
  if (!banca) {
    // Difesa: un template registrato deve puntare a una banca esistente.
    throw erroreConfig(`Banca dati non disponibile: ${bancaCodice}.`);
  }
  const codiciModalita = banca.modalita.map((m) => m.codice);
  const codiciSezione = banca.sezioni.map((s) => s.codice);

  return compatta({
    modalita: valoreTraAmmessi(configurazione.modalita, codiciModalita, 'La modalità'),
    sezioni: valoreArray(configurazione.sezioni, codiciSezione, 'Le sezioni'),
  });
};

/** Costruisce il descrittore di template per una banca dati registrata. */
const templateDaBanca = (bancaCodice) => {
  const cat = catalogoBanca(bancaCodice);
  return {
    codice: `banca-${bancaCodice}`,
    nome: cat.nome.it,
    descrizione: cat.descrizione.it,
    materia: cat.materia,
    categoria: cat.categoria,
    // Banche dati sostanziali (non i template dimostrativi kana/kanji):
    // disponibili nel catalogo e installabili dagli insegnanti.
    esempio: false,
    funzionalitaRichiesta: 'quiz',
    motore: 'banca',
    // Riferimento alla sorgente statica delle voci.
    banca: bancaCodice,
    // Default: nessuna modalità/sezione fissata ⇒ lo studente sceglie (o si usa
    // la prima modalità e tutte le sezioni).
    configurazioneDefault: {},
    campiSovrascrivibili: ['modalita', 'sezioni'],
    // Metadati (modalità/sezioni localizzate) per la UI di configurazione.
    metadati: cat,
    valida: validaConfigBanca(bancaCodice),
  };
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
  // Template a BANCA DATI: generati dai dizionari statici di `constants/bancaData`.
  // Aggiungere una banca lì e importarla nell'indice è sufficiente: qui vengono
  // registrate automaticamente. Ogni banca è un template installabile a sé.
  ...CODICI_BANCA.map(templateDaBanca),
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
    // Per i template a banca dati: codice della banca sorgente + metadati
    // (modalità e sezioni localizzate) per costruire il pannello di configurazione.
    ...(t.banca ? { banca: t.banca } : {}),
    ...(t.metadati ? { metadati: t.metadati } : {}),
    configurazioneDefault: t.configurazioneDefault,
    campiSovrascrivibili: t.campiSovrascrivibili,
  }));

/**
 * Motore effettivo di un template (kana/kanji/banca). Diverso dal CODICE del
 * template: più template distinti (banca-webdev, banca-chimica…) condividono lo
 * stesso motore `banca`. Restituisce `null` se il codice non è nel catalogo.
 */
const motoreDelTemplate = (codice) => {
  const template = trovaTemplate(codice);
  return template ? template.motore : null;
};


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
  motoreDelTemplate,
  catalogoPubblico,
  risolviFiltri,
};
