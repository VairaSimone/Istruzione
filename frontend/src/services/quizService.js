import apiClient from '../api/axiosClient';

/**
 * Service layer del Quiz Kana.
 * Ogni funzione mappa 1:1 un endpoint reale di `backend/src/routes/quizRoutes.js`
 * (montate sotto `/api/quiz`; il prefisso `/api` è già incluso in
 * VITE_API_BASE_URL, quindi qui i path partono da `/quiz`).
 *
 * Tutte le route richiedono una sessione attiva (cookie httpOnly):
 * `withCredentials` e l'header CSRF sono gestiti centralmente da axiosClient.
 */

/**
 * GET /quiz/dashboard
 * Statistiche di gioco + conteggio "mastered" + kana da rivedere.
 */
export const getQuizDashboard = async () => {
  const { data } = await apiClient.get('/quiz/dashboard');
  return data;
};

/**
 * POST /quiz/generate (sola lettura: nessuna mutazione ⇒ niente CSRF lato server)
 * Riceve i filtri di gioco e restituisce la sessione generata (max 20 caratteri,
 * selezione SRS ibrida).
 *
 * Supporta due domini con lo stesso endpoint:
 *   - kana  (default): usa alfabeto/gruppi/includiDakuon/includiYoon;
 *   - kanji:           usa livello (JLPT), tipoQuiz, lingua.
 * I campi non pertinenti al dominio scelto vengono semplicemente ignorati dal
 * backend; l'assenza di `dominio` mantiene il comportamento kana storico.
 *
 * @param {Object}   filtri
 * @param {string}   [filtri.dominio]       'kana' | 'kanji' (default 'kana')
 * @param {string}   [filtri.alfabeto]      'hiragana' | 'katakana'   (kana)
 * @param {string[]} [filtri.gruppi]        righe selezionate; vuoto ⇒ tutte (kana)
 * @param {boolean}  [filtri.includiDakuon]                            (kana)
 * @param {boolean}  [filtri.includiYoon]                              (kana)
 * @param {string}   [filtri.livello]       'N5'…'N1'                 (kanji)
 * @param {string}   [filtri.tipoQuiz]      'production'|'recognition'|'reading' (kanji)
 * @param {string}   [filtri.lingua]        'it' | 'en' (significati)  (kanji)
 */
export const generateQuiz = async ({
  dominio,
  alfabeto,
  gruppi,
  includiDakuon,
  includiYoon,
  livello,
  tipoQuiz,
  lingua,
}) => {
  const { data } = await apiClient.post('/quiz/generate', {
    dominio,
    alfabeto,
    gruppi,
    includiDakuon,
    includiYoon,
    livello,
    tipoQuiz,
    lingua,
  });
  return data;
};

/**
 * POST /quiz/submit (mutativa: protetta da CSRF + rate limiter lato server)
 * Invia l'esito della partita; il backend aggiorna SRS/XP/streak/record in
 * transazione e restituisce il risultato del round + le statistiche aggiornate.
 *
 * `dominio` instrada l'aggiornamento SRS sul modello corretto
 * (ProgressoKana | ProgressoKanji); la parte utente (XP/streak/record) è
 * condivisa. L'assenza del campo equivale a 'kana'.
 *
 * @param {Object}   payload
 * @param {string}   [payload.dominio]  'kana' | 'kanji' (default 'kana')
 * @param {Array}    payload.risposte
 *        kana:  {kana, tipo, corretto}[] · kanji: {kanji, livelloJLPT, corretto}[]
 * @param {{maxCombo:number, timerMode:boolean}} [payload.datiBonus]
 */
export const submitQuizResults = async ({ dominio, risposte, datiBonus }) => {
  const { data } = await apiClient.post('/quiz/submit', { dominio, risposte, datiBonus });
  return data;
};

/**
 * GET /quiz/badge (sola lettura)
 * Catalogo completo dei badge con lo stato di sblocco dell'utente, le
 * statistiche di gioco e i totali utili alle barre di progresso del profilo.
 *
 * Shape restituito (campo `data`):
 *   { statistiche, badge[], riepilogo:{sbloccati,totale}, progresso }
 */
export const getQuizBadge = async () => {
  const { data } = await apiClient.get('/quiz/badge');
  return data;
};

/**
 * POST /quiz/scrittura (mutativa: protetta da CSRF + rate limiter lato server)
 * Registra i tratti validati lato client sul canvas di scrittura: il backend
 * assegna gli XP (2 per tratto), aggiorna i contatori e valuta i badge.
 *
 * @param {Object} payload
 * @param {number} payload.trattiValidati  intero 1..50 (tetto del backend)
 * @param {Array<{kana:string, tipo:string}>} [payload.caratteriErrati]
 *        caratteri il cui ordine dei tratti è stato sbagliato nella sessione
 *        (una voce per errore). Facoltativo: se omesso, comportamento invariato.
 */
export const registraScrittura = async ({ trattiValidati, caratteriErrati }) => {
  const { data } = await apiClient.post('/quiz/scrittura', {
    trattiValidati,
    ...(caratteriErrati && caratteriErrati.length ? { caratteriErrati } : {}),
  });
  return data;
};

/**
 * GET /quiz/stroke/:alfabeto (sola lettura: nessuna mutazione ⇒ niente CSRF)
 * Restituisce l'ordine dei tratti di tutti i kana dell'alfabeto (dati statici
 * KanjiVG). Usato dalla visualizzazione animata e dagli esercizi di scrittura.
 *
 * @param {string} alfabeto 'hiragana' | 'katakana'
 */
export const getStrokeOrder = async (alfabeto) => {
  const { data } = await apiClient.get(`/quiz/stroke/${alfabeto}`);
  return data;
};

/**
 * GET /quiz/stroke/kanji/:livello (sola lettura: nessuna mutazione ⇒ niente CSRF)
 * Restituisce l'ordine dei tratti di tutti i kanji di un livello JLPT (dati
 * statici KanjiVG), con letture e significati. Speculare a `getStrokeOrder` ma
 * per i kanji. I livelli senza dati grafici restituiscono `caratteri: []`.
 *
 * @param {string} livello 'N5'…'N1'
 * @param {string} [lingua] 'it' | 'en' (per i significati; fallback backend EN)
 */
export const getStrokeOrderKanji = async (livello, lingua) => {
  const { data } = await apiClient.get(`/quiz/stroke/kanji/${livello}`, {
    params: lingua ? { lingua } : undefined,
  });
  return data;
};
