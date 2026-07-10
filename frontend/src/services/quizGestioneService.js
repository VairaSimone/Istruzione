import apiClient from '../api/axiosClient';

/**
 * Service layer della GESTIONE DEI QUIZ (template installabili + quiz
 * personalizzati). Mappa 1:1 le route di `backend/src/routes/quizRoutes.js`
 * montate sotto `/api/quiz` (il prefisso `/api` è già in VITE_API_BASE_URL).
 *
 * Due gruppi:
 *   - STAFF (insegnante | admin): catalogo template, CRUD quiz e domande,
 *     abilitazione presso le aule;
 *   - GIOCATORE (chiunque): elenco dei quiz che può giocare.
 *
 * Ogni insegnante gestisce TUTTI i quiz della propria scuola; l'admin è
 * trasversale e in creazione deve indicare `scuolaId`.
 */

// ── Catalogo dei template di piattaforma ──

/**
 * GET /quiz/templates (staff)
 * Catalogo dei template installabili con il numero di installazioni già
 * presenti nella scuola.
 *
 * @param {{scuola?:string}} [filters] `scuola` è usato solo dall'admin
 * @returns {Promise<Array<{codice,nome,descrizione,materia,motore,
 *   configurazioneDefault,campiSovrascrivibili,installazioni}>>}
 */
export const getTemplateQuiz = async (filters = {}) => {
  const params = {};
  if (filters.scuola) params.scuola = filters.scuola;

  const { data } = await apiClient.get('/quiz/templates', { params });
  return data.data.template;
};

// ── Vista giocatore ──

/**
 * GET /quiz/disponibili
 * Quiz che il richiedente può giocare: lo studente vede solo i quiz pubblicati
 * abilitati per una sua aula; lo staff vede quelli della propria scuola (anche
 * in bozza, per anteprima).
 */
export const getQuizDisponibili = async (filters = {}) => {
  const params = {};
  if (filters.materia) params.materia = filters.materia;
  if (filters.categoria) params.categoria = filters.categoria;
  if (filters.scuola) params.scuola = filters.scuola;

  const { data } = await apiClient.get('/quiz/disponibili', { params });
  return data.data.quiz;
};

// ── Staff: CRUD quiz ──

/** GET /quiz/gestione — elenco dei quiz della scuola, con filtri e paginazione. */
export const getQuizList = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.materia) params.materia = filters.materia;
  if (filters.categoria) params.categoria = filters.categoria;
  if (filters.template) params.template = filters.template;
  if (filters.q) params.q = filters.q;
  if (filters.scuola) params.scuola = filters.scuola;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/quiz/gestione', { params });
  return { quiz: data.data.quiz, paginazione: data.paginazione ?? null };
};

/** GET /quiz/gestione/:id — dettaglio con domande (soluzioni incluse) e aule. */
export const getQuizById = async (id) => {
  const { data } = await apiClient.get(`/quiz/gestione/${id}`);
  return data.data.quiz;
};

/**
 * POST /quiz/gestione — crea un quiz.
 * Con `templateCodice` è l'installazione di un template (le domande le genera
 * il motore: il payload non deve contenerne). Senza, è un quiz personalizzato.
 */
export const createQuiz = async (payload) => {
  const { data } = await apiClient.post('/quiz/gestione', payload);
  return data.data.quiz;
};

/** PATCH /quiz/gestione/:id — aggiorna il quiz (il template è immutabile). */
export const updateQuiz = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/quiz/gestione/${id}`, payload);
  return data.data.quiz;
};

/** DELETE /quiz/gestione/:id — elimina il quiz (cascade su domande e aule). */
export const deleteQuiz = async (id) => {
  const { data } = await apiClient.delete(`/quiz/gestione/${id}`);
  return data;
};

// ── Staff: domande (solo quiz personalizzati) ──

/** POST /quiz/gestione/:id/domande — aggiunge una domanda. */
export const addDomanda = async ({ id, ...payload }) => {
  const { data } = await apiClient.post(`/quiz/gestione/${id}/domande`, payload);
  return data.data.domanda;
};

/** PATCH /quiz/gestione/:id/domande/:domandaId — aggiorna una domanda. */
export const updateDomanda = async ({ id, domandaId, ...payload }) => {
  const { data } = await apiClient.patch(
    `/quiz/gestione/${id}/domande/${domandaId}`,
    payload
  );
  return data.data.domanda;
};

/** DELETE /quiz/gestione/:id/domande/:domandaId — elimina una domanda. */
export const deleteDomanda = async ({ id, domandaId }) => {
  const { data } = await apiClient.delete(`/quiz/gestione/${id}/domande/${domandaId}`);
  return data;
};

// ── Staff: abilitazione presso le aule ──

/** POST /quiz/gestione/:id/aule — abilita il quiz per un'aula. */
export const abilitaPerAula = async ({ id, classeId }) => {
  const { data } = await apiClient.post(`/quiz/gestione/${id}/aule`, { classeId });
  return data.data.aula;
};

/** DELETE /quiz/gestione/:id/aule/:classeId — disabilita il quiz per un'aula. */
export const disabilitaPerAula = async ({ id, classeId }) => {
  const { data } = await apiClient.delete(`/quiz/gestione/${id}/aule/${classeId}`);
  return data;
};
