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
 * Riceve i filtri di gioco e restituisce la sessione generata (max 20 kana,
 * selezione SRS ibrida).
 *
 * @param {Object}   filtri
 * @param {string}   filtri.alfabeto        'hiragana' | 'katakana'
 * @param {string[]} [filtri.gruppi]        righe selezionate; vuoto ⇒ tutte
 * @param {boolean}  [filtri.includiDakuon]
 * @param {boolean}  [filtri.includiYoon]
 */
export const generateQuiz = async ({ alfabeto, gruppi, includiDakuon, includiYoon }) => {
  const { data } = await apiClient.post('/quiz/generate', {
    alfabeto,
    gruppi,
    includiDakuon,
    includiYoon,
  });
  return data;
};

/**
 * POST /quiz/submit (mutativa: protetta da CSRF + rate limiter lato server)
 * Invia l'esito della partita; il backend aggiorna SRS/XP/streak/record in
 * transazione e restituisce il risultato del round + le statistiche aggiornate.
 *
 * @param {Object}   payload
 * @param {Array<{kana:string, tipo:string, corretto:boolean}>} payload.risposte
 * @param {{maxCombo:number, timerMode:boolean}} [payload.datiBonus]
 */
export const submitQuizResults = async ({ risposte, datiBonus }) => {
  const { data } = await apiClient.post('/quiz/submit', { risposte, datiBonus });
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
