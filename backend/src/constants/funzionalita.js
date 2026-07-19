'use strict';

/**
 * REGISTRO DELLE FUNZIONALITÀ (sezioni) DELLA PIATTAFORMA.
 *
 * Ogni scuola decide quali sezioni rendere disponibili ai propri utenti. Il
 * registro è la FONTE DI VERITÀ unica: da qui derivano
 *
 *   - i default salvati nelle impostazioni di una nuova scuola;
 *   - la validazione del blob `impostazioni.funzionalita`;
 *   - il gate lato server (`middleware/funzionalita.js`), che risponde 403 se
 *     una route appartiene a una sezione disattivata;
 *   - il catalogo esposto al frontend (`GET /api/config`), che nasconde le voci
 *     di menu delle sezioni disabilitate.
 *
 * ─────────────────────────────────────────────
 * COME AGGIUNGERE UNA NUOVA SEZIONE
 * ─────────────────────────────────────────────
 *   1. aggiungere un descrittore al vettore `FUNZIONALITA` qui sotto;
 *   2. applicare `richiediFunzionalita('<chiave>')` alle route della sezione;
 *   3. fine. Nessuna migrazione: le funzionalità vivono nel blob JSON
 *      `scuole.impostazioni` e i default si applicano alle chiavi mancanti.
 *
 * Il gate è FAIL-OPEN sui default (una funzionalità nuova nasce con il valore
 * di `defaultAbilitata`) e FAIL-CLOSED sull'appartenenza al tenant (una scuola
 * inesistente non abilita nulla).
 *
 * NOTA SU `nucleo`: le funzionalità marcate `nucleo: true` non sono
 * disattivabili, perché senza di esse la piattaforma non è utilizzabile
 * (autenticazione, profilo, gestione utenti). Sono elencate qui per completezza
 * del catalogo esposto al frontend, ma un tentativo di disabilitarle viene
 * respinto in validazione.
 */

/**
 * @typedef {Object} DescrittoreFunzionalita
 * @property {string}  chiave            identificatore stabile (persistito)
 * @property {string}  nome              etichetta leggibile (fallback IT)
 * @property {string}  descrizione       cosa abilita, in una riga
 * @property {boolean} defaultAbilitata  valore per le scuole che non la fissano
 * @property {boolean} [nucleo]          true ⇒ non disattivabile
 * @property {string[]} [dipendeDa]      chiavi che devono essere attive
 */

/** @type {DescrittoreFunzionalita[]} */
const FUNZIONALITA = [
  {
    chiave: 'profilo',
    nome: 'Profilo e account',
    descrizione: 'Autenticazione, profilo utente e gestione dell’account.',
    defaultAbilitata: true,
    nucleo: true,
  },
  {
    chiave: 'aule',
    nome: 'Aule virtuali',
    descrizione: 'Gruppi di studio con insegnanti e studenti.',
    defaultAbilitata: true,
  },
  {
    chiave: 'quiz',
    nome: 'Quiz',
    descrizione:
      'Quiz personalizzati e quiz generati dai template di piattaforma, con ripetizione spaziata.',
    defaultAbilitata: true,
  },
  {
    chiave: 'corsi',
    nome: 'Corsi on-demand',
    descrizione: 'Videolezioni, capitoli, sotto-capitoli e materiale allegato.',
    defaultAbilitata: true,
  },
  {
    chiave: 'compiti',
    nome: 'Compiti',
    descrizione: 'Assegnazione di attività ad aule e singoli studenti, con consegne e valutazioni.',
    defaultAbilitata: true,
    dipendeDa: ['aule'],
  },
  {
    chiave: 'presenze',
    nome: 'Registro presenze',
    descrizione:
      "Registro delle presenze per aula: l'insegnante segna presenze, assenze, ritardi e uscite; la scuola può fissare un limite di assenze oltre il quale gli studenti vengono segnalati.",
    defaultAbilitata: false,
    dipendeDa: ['aule'],
  },
  {
    chiave: 'messaggi',
    nome: 'Messaggistica',
    descrizione: 'Comunicazioni interne, feedback e note private.',
    defaultAbilitata: true,
  },
  {
    chiave: 'calendario',
    nome: 'Calendario',
    descrizione:
      'Calendario condiviso per studenti e insegnanti: scadenze dei compiti ed eventi con link a videochiamate (Zoom, Meet, Teams…).',
    defaultAbilitata: true,
  },
  {
    chiave: 'certificazioni',
    nome: 'Certificazioni',
    descrizione:
      'Certificati di fine corso rilasciati dagli insegnanti agli studenti, scaricabili in PDF e interamente personalizzabili dalla scuola (logo, colori, testi, firma).',
    defaultAbilitata: true,
  },
  {
    chiave: 'statistiche',
    nome: 'Statistiche e dashboard',
    descrizione: 'Heatmap di attività, streak di studio e cruscotto per gli insegnanti.',
    defaultAbilitata: true,
  },
  {
    chiave: 'gamification',
    nome: 'Gamification',
    descrizione: 'Punti esperienza, livelli, streak e badge.',
    defaultAbilitata: true,
  },
  {
    chiave: 'praticaScrittura',
    nome: 'Pratica di scrittura',
    descrizione:
      'Canvas per l’esercizio dei tratti. Rilevante solo per le materie con scrittura guidata (es. sistemi di scrittura non latini).',
    defaultAbilitata: false,
  },
  {
    chiave: 'pagamenti',
    nome: 'Pagamenti e iscrizioni a pagamento',
    descrizione:
      'Consente alla scuola di riscuotere le iscrizioni ai corsi tramite Stripe: catalogo con prezzi personalizzati, checkout online e iscrizione automatica all’aula a pagamento avvenuto. Se disattivata, le iscrizioni si gestiscono fuori piattaforma.',
    defaultAbilitata: false,
    dipendeDa: ['corsi', 'aule'],
  },
];

/** Mappa chiave → descrittore, per lookup O(1). */
const MAPPA_FUNZIONALITA = new Map(FUNZIONALITA.map((f) => [f.chiave, f]));

/** Elenco delle chiavi valide. */
const CHIAVI_FUNZIONALITA = FUNZIONALITA.map((f) => f.chiave);

/** Chiavi non disattivabili. */
const CHIAVI_NUCLEO = FUNZIONALITA.filter((f) => f.nucleo).map((f) => f.chiave);

/** True se la chiave esiste nel registro. */
const esiste = (chiave) => MAPPA_FUNZIONALITA.has(chiave);

/** Descrittore o `null`. */
const trova = (chiave) => MAPPA_FUNZIONALITA.get(chiave) || null;

/**
 * Mappa dei valori predefiniti: `{ quiz: true, corsi: true, ... }`.
 * Ricalcolata a ogni chiamata per evitare mutazioni accidentali del registro.
 */
const funzionalitaPredefinite = () =>
  Object.fromEntries(FUNZIONALITA.map((f) => [f.chiave, Boolean(f.defaultAbilitata)]));

/**
 * Applica i default alle chiavi mancanti, forza a `true` le funzionalità di
 * nucleo e disattiva quelle le cui dipendenze non sono soddisfatte.
 *
 * @param {Object<string, boolean>} [parziali]
 * @returns {Object<string, boolean>} mappa completa e coerente
 */
const risolviFunzionalita = (parziali = {}) => {
  const risolte = funzionalitaPredefinite();

  for (const [chiave, valore] of Object.entries(parziali || {})) {
    // Le chiavi sconosciute (es. rimosse in una versione successiva) sono
    // ignorate: il blob JSON storico non rompe mai la risoluzione.
    if (!esiste(chiave)) continue;
    risolte[chiave] = Boolean(valore);
  }

  // Il nucleo non è disattivabile, qualunque cosa dica il blob persistito.
  for (const chiave of CHIAVI_NUCLEO) risolte[chiave] = true;

  // Propagazione delle dipendenze: se `aule` è spento, `compiti` non può stare
  // acceso (le assegnazioni passano dalle aule). Un solo passaggio è
  // sufficiente finché il grafo delle dipendenze resta profondo un livello;
  // il ciclo `while` lo rende corretto anche per catene più lunghe.
  let modificato = true;
  while (modificato) {
    modificato = false;
    for (const f of FUNZIONALITA) {
      if (!risolte[f.chiave] || !f.dipendeDa) continue;
      if (f.dipendeDa.some((dip) => risolte[dip] === false)) {
        risolte[f.chiave] = false;
        modificato = true;
      }
    }
  }

  return risolte;
};

/**
 * Catalogo esponibile al frontend: descrittori + stato risolto per la scuola.
 *
 * @param {Object<string, boolean>} [funzionalitaScuola] mappa già risolta
 */
const catalogoPubblico = (funzionalitaScuola = null) => {
  const stato = funzionalitaScuola || funzionalitaPredefinite();
  return FUNZIONALITA.map((f) => ({
    chiave: f.chiave,
    nome: f.nome,
    descrizione: f.descrizione,
    nucleo: Boolean(f.nucleo),
    dipendeDa: f.dipendeDa || [],
    abilitata: Boolean(stato[f.chiave]),
  }));
};

module.exports = {
  FUNZIONALITA,
  CHIAVI_FUNZIONALITA,
  CHIAVI_NUCLEO,
  esiste,
  trova,
  funzionalitaPredefinite,
  risolviFunzionalita,
  catalogoPubblico,
};
