'use strict';

/**
 * REGISTRO DEI TIPI DI NOTIFICA EMAIL.
 *
 * È la FONTE DI VERITÀ unica per le notifiche recapitate via email. Da qui
 * derivano:
 *
 *   - la validazione del `tipo` scritto nella coda (`models/NotificaEmail`);
 *   - il RAGGRUPPAMENTO nel digest (ogni tipo diventa una sezione dell'email);
 *   - le PREFERENZE utente (ogni categoria è disattivabile singolarmente);
 *   - le chiavi i18n usate per intestazioni e testi del digest.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ UN DIGEST E NON UN'EMAIL PER EVENTO
 * ─────────────────────────────────────────────
 * Uno studente di un'aula affollata può ricevere decine di messaggi e compiti
 * in poche ore. Inviare un'email per ciascuno significherebbe intasare la sua
 * casella (e farsi marcare come spam). La piattaforma quindi ACCODA le notifiche
 * e le recapita in un DIGEST periodico: un'unica email che riepiloga tutto ciò
 * che è successo dall'ultimo invio, con un TETTO massimo di email al giorno per
 * utente (cfr. `notificheService`). Le notifiche non ancora recapitate restano
 * in coda e confluiscono nel digest successivo.
 *
 * ─────────────────────────────────────────────
 * COME AGGIUNGERE UN TIPO DI NOTIFICA
 * ─────────────────────────────────────────────
 *   1. aggiungere un descrittore al vettore `TIPI_NOTIFICA` qui sotto;
 *   2. aggiungere le chiavi i18n corrispondenti in `locales/{it,en}` sotto
 *      `email.digest.tipi.<chiave>`;
 *   3. chiamare `notificheService.accodaNotifica({ tipo: '<chiave>', ... })` dal
 *      punto di dominio che genera l'evento.
 * Nessuna migrazione: il `tipo` è una colonna STRING validata contro il registro.
 */

/**
 * @typedef {Object} DescrittoreNotifica
 * @property {string}  chiave            identificatore stabile (persistito nel DB)
 * @property {string}  categoria         gruppo di preferenza (attivabile/disattivabile)
 * @property {string}  i18nSezione       suffisso della chiave i18n della sezione digest
 * @property {number}  ordine            ordinamento della sezione nel digest (crescente)
 * @property {boolean} defaultAttiva     valore predefinito nelle preferenze utente
 */

/** @type {DescrittoreNotifica[]} */
const TIPI_NOTIFICA = [
  {
    chiave: 'nuovo_messaggio',
    categoria: 'messaggi',
    i18nSezione: 'nuovoMessaggio',
    ordine: 10,
    defaultAttiva: true,
  },
  {
    // Recapitata ai membri di un'aula: nuovi messaggi nella chat di gruppo.
    // Accodata con `unicaPerRiferimento` (riferimento = aula) per NON generare
    // una notifica per ogni messaggio: il digest riepiloga «hai nuovi messaggi
    // nella chat di <aula>» una sola volta finché non viene recapitato.
    chiave: 'chat_aula',
    categoria: 'chat',
    i18nSezione: 'chatAula',
    ordine: 15,
    defaultAttiva: true,
  },
  {
    chiave: 'nuovo_compito',
    categoria: 'compiti',
    i18nSezione: 'nuovoCompito',
    ordine: 20,
    defaultAttiva: true,
  },
  {
    chiave: 'scadenza_compito',
    categoria: 'scadenze',
    i18nSezione: 'scadenzaCompito',
    ordine: 30,
    defaultAttiva: true,
  },
  {
    chiave: 'feedback_compito',
    categoria: 'feedback',
    i18nSezione: 'feedbackCompito',
    ordine: 40,
    defaultAttiva: true,
  },
  {
    chiave: 'certificato_rilasciato',
    categoria: 'certificati',
    i18nSezione: 'certificatoRilasciato',
    ordine: 50,
    defaultAttiva: true,
  },
  {
    // Recapitata all'ACQUIRENTE: conferma dell'iscrizione dopo il pagamento.
    chiave: 'iscrizione_pagamento',
    categoria: 'pagamenti',
    i18nSezione: 'iscrizionePagamento',
    ordine: 60,
    defaultAttiva: true,
  },
  {
    // Recapitata allo STAFF della scuola: nuova iscrizione pagata a un corso.
    chiave: 'nuovo_pagamento',
    categoria: 'pagamenti',
    i18nSezione: 'nuovoPagamento',
    ordine: 70,
    defaultAttiva: true,
  },
];

// Indice per lookup O(1) sul `tipo`.
const PER_CHIAVE = new Map(TIPI_NOTIFICA.map((d) => [d.chiave, d]));

// Elenco stabile delle chiavi (per validazione del modello e delle migrazioni).
const CHIAVI_NOTIFICA = TIPI_NOTIFICA.map((d) => d.chiave);

// Elenco DISTINTO delle categorie di preferenza (per la validazione del blob
// `preferenze_notifiche` dell'utente e per il default).
const CATEGORIE = [...new Set(TIPI_NOTIFICA.map((d) => d.categoria))];

/** True se `chiave` è un tipo di notifica riconosciuto. */
const esiste = (chiave) => PER_CHIAVE.has(chiave);

/** Descrittore del tipo indicato, o `undefined`. */
const descrittore = (chiave) => PER_CHIAVE.get(chiave);

/** Categoria di preferenza associata al tipo (o `null` se sconosciuto). */
const categoriaDi = (chiave) => {
  const d = PER_CHIAVE.get(chiave);
  return d ? d.categoria : null;
};

/**
 * Preferenze di notifica PREDEFINITE: ogni categoria abilitata secondo il
 * proprio `defaultAttiva`. `emailAttive` è l'interruttore generale.
 */
const preferenzePredefinite = () => {
  const categorie = {};
  for (const d of TIPI_NOTIFICA) {
    // Una categoria è attiva di default se almeno un suo tipo lo è.
    if (categorie[d.categoria] === undefined) categorie[d.categoria] = d.defaultAttiva;
    else categorie[d.categoria] = categorie[d.categoria] || d.defaultAttiva;
  }
  return { emailAttive: true, categorie };
};

/**
 * Normalizza un blob di preferenze arbitrario contro il registro: mantiene solo
 * le categorie conosciute, forza i valori a booleano e applica i default alle
 * chiavi mancanti. Le chiavi sconosciute vengono ignorate (schema stabile).
 */
const normalizzaPreferenze = (blob) => {
  const base = preferenzePredefinite();
  if (!blob || typeof blob !== 'object') return base;

  const emailAttive =
    typeof blob.emailAttive === 'boolean' ? blob.emailAttive : base.emailAttive;

  const categorie = { ...base.categorie };
  if (blob.categorie && typeof blob.categorie === 'object') {
    for (const cat of CATEGORIE) {
      if (typeof blob.categorie[cat] === 'boolean') {
        categorie[cat] = blob.categorie[cat];
      }
    }
  }

  return { emailAttive, categorie };
};

/**
 * True se, date le preferenze (già normalizzate o grezze), l'utente vuole
 * ricevere le email per il `tipo` indicato. Richiede sia l'interruttore
 * generale sia la categoria specifica attivi.
 */
const vuoleRicevere = (preferenze, tipo) => {
  const pref = normalizzaPreferenze(preferenze);
  if (!pref.emailAttive) return false;
  const cat = categoriaDi(tipo);
  if (!cat) return false;
  return pref.categorie[cat] !== false;
};

module.exports = {
  TIPI_NOTIFICA,
  CHIAVI_NOTIFICA,
  CATEGORIE,
  esiste,
  descrittore,
  categoriaDi,
  preferenzePredefinite,
  normalizzaPreferenze,
  vuoleRicevere,
};
