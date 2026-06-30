import apiClient from '../api/axiosClient';

/**
 * Service layer delle STATISTICHE di studio.
 * Ogni funzione mappa 1:1 un endpoint di `backend/src/routes/statisticheRoutes.js`
 * (montate sotto `/api/statistiche`; il prefisso `/api` è già in
 * VITE_API_BASE_URL, quindi qui i path partono da `/statistiche`).
 *
 * Tutte le route richiedono una sessione attiva (cookie httpOnly): credenziali
 * ed eventuale header CSRF sono gestiti centralmente da axiosClient. Sono tutte
 * di SOLA LETTURA lato server (l'allenamento intensivo usa POST solo per i
 * filtri nel body), quindi nessuna invalidazione cache è necessaria al successo.
 */

/**
 * GET /statistiche/heatmap?giorni=365
 * Attività per giorno (griglia dei contributi stile GitHub).
 *
 * Shape restituito (campo `data`):
 *   { dal, al, giorniRichiesti, massimoGiornaliero, giorni[], riepilogo }
 * dove ogni voce di `giorni` è
 *   { giorno, quizCompletati, risposteTotali, risposteCorrette,
 *     trattiValidati, xpGuadagnati, intensita, livello }
 *
 * @param {number} [giorni=365]
 */
export const getHeatmap = async (giorni = 365) => {
  const { data } = await apiClient.get('/statistiche/heatmap', {
    params: { giorni },
  });
  return data;
};

/**
 * GET /statistiche/streak
 * Stato della streak di studio (corrente effettiva + record + rischio).
 *
 * Shape restituito (campo `data`):
 *   { streak, streakRecord, ultimaDataStudio, attivaOggi, aRischio }
 */
export const getStreak = async () => {
  const { data } = await apiClient.get('/statistiche/streak');
  return data;
};

/**
 * GET /statistiche/caratteri-problematici?alfabeto=&limite=
 * Caratteri su cui l'utente sbaglia di più (risposte e/o ordine dei tratti).
 *
 * Shape restituito (campo `data`):
 *   { caratteri[], riepilogo:{ totaleProblematici, conErroriQuiz,
 *     conErroriTratti, allenamentoDisponibile } }
 *
 * @param {{ alfabeto?: string, limite?: number }} [filtri]
 */
export const getCaratteriProblematici = async ({ alfabeto, limite } = {}) => {
  const { data } = await apiClient.get('/statistiche/caratteri-problematici', {
    params: { alfabeto, limite },
  });
  return data;
};

/**
 * POST /statistiche/allenamento-intensivo
 * Genera un pool di quiz mirato SOLO sui caratteri problematici (sola lettura
 * lato server: l'esito si invia poi al normale POST /quiz/submit).
 *
 * Shape restituito (campo `data`):
 *   { sessione: { alfabeto|'misto', modalita:'intensivo', totale, kana[] } }
 *
 * @param {{ alfabeto?: string, limite?: number }} [filtri]
 */
export const generaAllenamentoIntensivo = async ({ alfabeto, limite } = {}) => {
  const { data } = await apiClient.post('/statistiche/allenamento-intensivo', {
    alfabeto,
    limite,
  });
  return data;
};
