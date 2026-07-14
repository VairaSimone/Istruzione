/**
 * Query keys centralizzate per React Query.
 * Usare SEMPRE queste factory invece di array letterali sparsi nei componenti:
 * garantisce invalidazioni cache coerenti e previene typo che romperebbero
 * il refetch automatico dopo le mutation.
 */
export const queryKeys = Object.freeze({
  auth: {
    me: ['auth', 'me'],
    notifiche: ['auth', 'me', 'notifiche'],
  },
  /**
   * Configurazione pubblica di piattaforma/scuola. Dipende dal tenant attivo:
   * cambiando scuola cambia la chiave, quindi la cache non si sporca.
   */
  config: {
    all: ['config'],
    branding: (scuolaSlug) => ['config', 'branding', scuolaSlug ?? 'predefinita'],
    scuolePubbliche: ['config', 'scuolePubbliche'],
    schema: ['config', 'schema'],
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
    mieImpostazioni: ['scuole', 'mia', 'impostazioni'],
    miaQuota: ['scuole', 'mia', 'quota'],
    quota: (id) => ['scuole', 'quota', id ?? 'mia'],
    // Domini personalizzati della scuola (propria o, per l'admin, indicata).
    domini: (scuolaId) => ['scuole', 'domini', scuolaId ?? 'mia'],
  },
  // Richieste di contatto (lead della homepage pubblica). La lista dipende dal
  // tenant: per l'admin è la scuola selezionata, per lo staff la propria.
  contatti: {
    all: ['contatti'],
    list: (filters) => ['contatti', 'list', filters ?? {}],
    detail: (id) => ['contatti', 'detail', id],
  },
  quiz: {
    all: ['quiz'],
    dashboard: ['quiz', 'dashboard'],
    badge: ['quiz', 'badge'],
    // Quiz delle scuole (template installabili + quiz personalizzati).
    templates: (filters) => ['quiz', 'templates', filters ?? {}],
    disponibili: (filters) => ['quiz', 'disponibili', filters ?? {}],
    gestione: ['quiz', 'gestione'],
    gestioneList: (filters) => ['quiz', 'gestione', 'list', filters ?? {}],
    gestioneDetail: (id) => ['quiz', 'gestione', 'detail', id],
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
  calendario: {
    all: ['calendario'],
    feed: (filters) => ['calendario', 'feed', filters ?? {}],
    eventi: (filters) => ['calendario', 'eventi', filters ?? {}],
    eventoDetail: (id) => ['calendario', 'eventi', 'detail', id],
  },
  certificati: {
    all: ['certificati'],
    list: (filters) => ['certificati', 'list', filters ?? {}],
    detail: (id) => ['certificati', 'detail', id],
    verifica: (codice) => ['certificati', 'verifica', codice],
  },
  // Iscrizioni a pagamento (Stripe). Catalogo/acquisti dello studente e
  // configurazione/incassi dello staff. La config dipende dalla scuola (per
  // l'admin è quella indicata, per lo staff la propria).
  pagamenti: {
    all: ['pagamenti'],
    catalogo: ['pagamenti', 'catalogo'],
    miei: ['pagamenti', 'miei'],
    config: (scuolaId) => ['pagamenti', 'config', scuolaId ?? 'mia'],
    scuola: (filters) => ['pagamenti', 'scuola', filters ?? {}],
  },
});
