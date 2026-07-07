/**
 * Query keys centralizzate per React Query.
 * Usare SEMPRE queste factory invece di array letterali sparsi nei componenti:
 * garantisce invalidazioni cache coerenti e previene typo che romperebbero
 * il refetch automatico dopo le mutation.
 */
export const queryKeys = Object.freeze({
  auth: {
    me: ['auth', 'me'],
  },
  users: {
    all: ['users'],
    list: (filters) => ['users', 'list', filters ?? {}],
  },
  invites: {
    all: ['invites'],
    list: (filters) => ['invites', 'list', filters ?? {}],
    validate: (token) => ['invites', 'validate', token],
  },
  scuole: {
    all: ['scuole'],
    list: (filters) => ['scuole', 'list', filters ?? {}],
    detail: (id) => ['scuole', 'detail', id],
    mia: ['scuole', 'mia'],
  },
  quiz: {
    dashboard: ['quiz', 'dashboard'],
    badge: ['quiz', 'badge'],
    strokeOrder: (alfabeto) => ['quiz', 'strokeOrder', alfabeto],
    strokeOrderKanji: (livello, lingua) => [
      'quiz',
      'strokeOrderKanji',
      livello,
      lingua ?? 'it',
    ],
  },
  statistiche: {
    all: ['statistiche'],
    heatmap: (giorni) => ['statistiche', 'heatmap', giorni ?? 365],
    streak: ['statistiche', 'streak'],
    caratteriProblematici: (filtri) => [
      'statistiche',
      'caratteriProblematici',
      filtri ?? {},
    ],
  },
  aule: {
    all: ['aule'],
    list: (filters) => ['aule', 'list', filters ?? {}],
    detail: (id) => ['aule', 'detail', id],
  },
  compiti: {
    all: ['compiti'],
    list: (filters) => ['compiti', 'list', filters ?? {}],
    detail: (id) => ['compiti', 'detail', id],
    consegne: (id) => ['compiti', 'consegne', id],
    studente: (filters) => ['compiti', 'studente', filters ?? {}],
    studenteDetail: (id) => ['compiti', 'studente', 'detail', id],
  },
  corsi: {
    all: ['corsi'],
    list: (filters) => ['corsi', 'list', filters ?? {}],
    detail: (id) => ['corsi', 'detail', id],
    studente: (filters) => ['corsi', 'studente', filters ?? {}],
    studenteDetail: (id) => ['corsi', 'studente', 'detail', id],
  },
  dashboard: {
    globale: (opzioni) => ['dashboard', 'globale', opzioni ?? {}],
    aula: (classeId, opzioni) => ['dashboard', 'aula', classeId, opzioni ?? {}],
  },
  messaggi: {
    all: ['messaggi'],
    ricevuti: (filters) => ['messaggi', 'ricevuti', filters ?? {}],
    inviati: (filters) => ['messaggi', 'inviati', filters ?? {}],
    note: (filters) => ['messaggi', 'note', filters ?? {}],
    notifiche: ['messaggi', 'notifiche'],
    detail: (id) => ['messaggi', 'detail', id],
  },
});
