/**
 * Registro delle FUNZIONALITÀ (sezioni) attivabili per scuola.
 *
 * Rispecchia `backend/src/constants/funzionalita.js`. La verità resta il
 * backend, che espone il catalogo completo (con nome e descrizione tradotti in
 * chiave) su `GET /api/config`: queste costanti servono per riferirsi alle
 * chiavi senza stringhe magiche nei componenti e per mappare ogni sezione alle
 * proprie route.
 *
 * NESSUNA sezione è specifica di una materia: aggiungerne una qui e nel
 * registro del backend è sufficiente, non servono migrazioni.
 */

import { ROUTES } from './routes';

export const FUNZIONALITA = Object.freeze({
  PROFILO: 'profilo',
  AULE: 'aule',
  QUIZ: 'quiz',
  CORSI: 'corsi',
  COMPITI: 'compiti',
  MESSAGGI: 'messaggi',
  CALENDARIO: 'calendario',
  STATISTICHE: 'statistiche',
  GAMIFICATION: 'gamification',
  PRATICA_SCRITTURA: 'praticaScrittura',
});

/** Chiavi in ordine di presentazione (pannello impostazioni). */
export const CHIAVI_FUNZIONALITA = Object.freeze([
  FUNZIONALITA.PROFILO,
  FUNZIONALITA.AULE,
  FUNZIONALITA.QUIZ,
  FUNZIONALITA.CORSI,
  FUNZIONALITA.COMPITI,
  FUNZIONALITA.MESSAGGI,
  FUNZIONALITA.CALENDARIO,
  FUNZIONALITA.STATISTICHE,
  FUNZIONALITA.GAMIFICATION,
  FUNZIONALITA.PRATICA_SCRITTURA,
]);

/**
 * Sezioni di NUCLEO: sempre attive, non disattivabili. Il pannello le mostra
 * come interruttori bloccati, coerentemente col rifiuto del backend (422).
 */
export const CHIAVI_NUCLEO = Object.freeze([FUNZIONALITA.PROFILO]);

/**
 * Dipendenze tra sezioni: disattivare la sezione a destra spegne quella a
 * sinistra. Serve solo per l'anteprima nella UI — la propagazione autorevole
 * avviene nel backend (`risolviFunzionalita`).
 */
export const DIPENDENZE = Object.freeze({
  [FUNZIONALITA.COMPITI]: FUNZIONALITA.AULE,
});

/**
 * Route protette da ciascuna sezione. Usata da `FeatureRoute` e dal menu.
 * Una route assente da questa mappa è sempre visibile (es. dashboard, 404).
 */
export const ROUTE_PER_FUNZIONALITA = Object.freeze({
  [FUNZIONALITA.QUIZ]: [ROUTES.QUIZ, ROUTES.QUIZ_GESTIONE, ROUTES.QUIZ_GESTIONE_DETAIL],
  [FUNZIONALITA.AULE]: [ROUTES.AULE, ROUTES.AULA_DETAIL],
  [FUNZIONALITA.COMPITI]: [
    ROUTES.COMPITI,
    ROUTES.COMPITO_DETAIL,
    ROUTES.COMPITI_STUDENTE,
    ROUTES.COMPITO_STUDENTE_DETAIL,
  ],
  [FUNZIONALITA.CORSI]: [
    ROUTES.CORSI,
    ROUTES.CORSO_DETAIL,
    ROUTES.CORSI_STUDENTE,
    ROUTES.CORSO_STUDENTE_DETAIL,
  ],
  [FUNZIONALITA.MESSAGGI]: [ROUTES.MESSAGGI, ROUTES.MESSAGGIO_DETAIL],
  [FUNZIONALITA.CALENDARIO]: [ROUTES.CALENDARIO],
  [FUNZIONALITA.STATISTICHE]: [ROUTES.TEACHER_DASHBOARD],
});

/**
 * Insieme di funzionalità applicato quando la configurazione non è ancora
 * arrivata (primo render) o quando l'utente è admin (trasversale a tutte le
 * scuole). Coincide con i default del backend: nessuna sezione nascosta per
 * errore durante il caricamento.
 */
export const FUNZIONALITA_PREDEFINITE = Object.freeze({
  [FUNZIONALITA.PROFILO]: true,
  [FUNZIONALITA.AULE]: true,
  [FUNZIONALITA.QUIZ]: true,
  [FUNZIONALITA.CORSI]: true,
  [FUNZIONALITA.COMPITI]: true,
  [FUNZIONALITA.MESSAGGI]: true,
  [FUNZIONALITA.CALENDARIO]: true,
  [FUNZIONALITA.STATISTICHE]: true,
  [FUNZIONALITA.GAMIFICATION]: true,
  [FUNZIONALITA.PRATICA_SCRITTURA]: false,
});
