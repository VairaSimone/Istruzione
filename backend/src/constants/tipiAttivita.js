'use strict';

const AppError = require('../utils/AppError');

/**
 * REGISTRO DEI TIPI DI ATTIVITÀ assegnabili in un COMPITO.
 *
 * Prima della generalizzazione, `compiti.tipo_attivita` era un ENUM MySQL con i
 * valori `quiz_kana | quiz_kanji | tracciamento | vocabolario`: una scelta che
 * legava lo schema del database alla materia insegnata e che richiedeva una
 * migrazione ALTER TABLE per ogni nuova attività.
 *
 * Ora la colonna è una STRING validata contro questo registro:
 *
 *   - i tipi sono NEUTRI rispetto alla materia;
 *   - aggiungerne uno non richiede migrazioni (è una voce di questo file);
 *   - i parametri specifici restano nel blob JSON `compiti.configurazione`
 *     (es. `{ quizId }` per il tipo `quiz`), già presente e libero.
 *
 * ─────────────────────────────────────────────
 * MIGRAZIONE DEI VALORI STORICI
 * ─────────────────────────────────────────────
 * `MAPPA_LEGACY` traduce i vecchi valori nei nuovi. È usata sia dalla migrazione
 * del database sia dai validator, così un client non ancora aggiornato continua
 * a funzionare inviando `quiz_kana`: il backend lo normalizza in `quiz` e
 * conserva l'informazione di dettaglio nella `configurazione`.
 */

/**
 * @typedef {Object} DescrittoreTipoAttivita
 * @property {string}   codice      valore persistito (stabile)
 * @property {string}   nome        etichetta leggibile (fallback IT)
 * @property {string}   descrizione cosa rappresenta
 * @property {string[]} [richiede]  chiavi obbligatorie nella `configurazione`
 * @property {string}   [funzionalita] funzionalità che deve essere attiva
 */

/** @type {DescrittoreTipoAttivita[]} */
const TIPI_ATTIVITA = [
  {
    codice: 'quiz',
    nome: 'Quiz',
    descrizione:
      'Svolgimento di un quiz della scuola: personalizzato oppure generato da un template di piattaforma.',
    richiede: ['quizId'],
    funzionalita: 'quiz',
  },
  {
    codice: 'corso',
    nome: 'Corso',
    descrizione: 'Visione di un corso on-demand (o di un suo capitolo).',
    richiede: ['corsoId'],
    funzionalita: 'corsi',
  },
  {
    codice: 'pratica_scrittura',
    nome: 'Pratica di scrittura',
    descrizione: 'Esercizio dei tratti sul canvas, per le materie con scrittura guidata.',
    funzionalita: 'praticaScrittura',
  },
  {
    codice: 'lettura',
    nome: 'Lettura / studio',
    descrizione: 'Studio di materiale indicato dall’insegnante, senza correzione automatica.',
  },
  {
    codice: 'consegna',
    nome: 'Elaborato da consegnare',
    descrizione: 'Attività libera con consegna e valutazione manuale da parte dell’insegnante.',
  },
  {
    codice: 'personalizzato',
    nome: 'Attività personalizzata',
    descrizione:
      'Attività definita interamente dalla configurazione: predisposta per moduli futuri senza modifiche allo schema.',
  },
];

/** Traduzione dei valori storici (ENUM giapponese) nei codici neutri. */
const MAPPA_LEGACY = Object.freeze({
  quiz_kana: 'quiz',
  quiz_kanji: 'quiz',
  tracciamento: 'pratica_scrittura',
  vocabolario: 'personalizzato',
});

const CODICI_ATTIVITA = TIPI_ATTIVITA.map((t) => t.codice);
const MAPPA = new Map(TIPI_ATTIVITA.map((t) => [t.codice, t]));

/** True se il codice appartiene al registro (dopo eventuale traduzione legacy). */
const esiste = (codice) => MAPPA.has(codice);

/** Descrittore o `null`. */
const trova = (codice) => MAPPA.get(codice) || null;

/**
 * Normalizza un valore in arrivo dal client:
 *   - traduce i valori storici;
 *   - lancia 422 se il codice non è nel registro.
 *
 * @param {string} codice
 * @returns {string} codice canonico
 */
const normalizza = (codice) => {
  if (typeof codice !== 'string' || codice.trim() === '') {
    throw new AppError('Il tipo di attività è obbligatorio.', 422, 'INVALID_ACTIVITY_TYPE');
  }
  const c = codice.trim();
  const tradotto = MAPPA_LEGACY[c] || c;
  if (!esiste(tradotto)) {
    throw new AppError(
      `Tipo di attività non valido. Usa uno di: ${CODICI_ATTIVITA.join(', ')}.`,
      422,
      'INVALID_ACTIVITY_TYPE'
    );
  }
  return tradotto;
};

/** Valori accettati in ingresso: canonici + alias storici (per i validator). */
const CODICI_ACCETTATI = [...CODICI_ATTIVITA, ...Object.keys(MAPPA_LEGACY)];

/**
 * Verifica che la `configurazione` contenga le chiavi obbligatorie del tipo.
 * @param {string} codice codice canonico
 * @param {object} configurazione
 */
const validaConfigurazione = (codice, configurazione) => {
  const tipo = trova(codice);
  if (!tipo || !tipo.richiede || !tipo.richiede.length) return;

  const config = configurazione && typeof configurazione === 'object' ? configurazione : {};
  const mancanti = tipo.richiede.filter((k) => config[k] === undefined || config[k] === null || config[k] === '');
  if (mancanti.length) {
    throw new AppError(
      `Il tipo di attività "${codice}" richiede nella configurazione: ${mancanti.join(', ')}.`,
      422,
      'INVALID_ACTIVITY_CONFIG'
    );
  }
};

/** Catalogo esponibile al client (senza logica). */
const catalogoPubblico = () =>
  TIPI_ATTIVITA.map((t) => ({
    codice: t.codice,
    nome: t.nome,
    descrizione: t.descrizione,
    richiede: t.richiede || [],
    funzionalita: t.funzionalita || null,
  }));

module.exports = {
  TIPI_ATTIVITA,
  CODICI_ATTIVITA,
  CODICI_ACCETTATI,
  MAPPA_LEGACY,
  esiste,
  trova,
  normalizza,
  validaConfigurazione,
  catalogoPubblico,
};
