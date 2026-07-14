import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo PAGAMENTI (iscrizioni a pagamento via Stripe).
 * Mappa 1:1 gli endpoint di `backend/src/routes/pagamentiRoutes.js`.
 *
 * Due gruppi: STUDENTE (catalogo, checkout, propri acquisti) e STAFF
 * (configurazione, onboarding Stripe Connect, incassi della scuola).
 */

// ── Studente ──

/** GET /api/pagamenti/catalogo — corsi acquistabili con prezzi della scuola. */
export const getCatalogo = async () => {
  const { data } = await apiClient.get('/pagamenti/catalogo');
  return data.data; // { operativo, corsi }
};

/**
 * POST /api/pagamenti/checkout — avvia il pagamento di un corso.
 * Restituisce l'URL Stripe a cui reindirizzare il browser.
 */
export const creaCheckout = async (corsoId) => {
  const { data } = await apiClient.post('/pagamenti/checkout', { corsoId });
  return data.data; // { url, pagamentoId }
};

/** GET /api/pagamenti/miei — i miei acquisti. */
export const getMieiPagamenti = async () => {
  const { data } = await apiClient.get('/pagamenti/miei');
  return data.data.pagamenti;
};

// ── Staff (insegnante | admin) ──

/** GET /api/pagamenti/config — stato dei pagamenti della scuola. */
export const getConfig = async (scuolaId) => {
  const params = scuolaId ? { scuolaId } : {};
  const { data } = await apiClient.get('/pagamenti/config', { params });
  return data.data.config;
};

/** PATCH /api/pagamenti/config — attiva/disattiva l'uso di Stripe. */
export const aggiornaConfig = async ({ attivi, scuolaId } = {}) => {
  const { data } = await apiClient.patch('/pagamenti/config', {
    attivi,
    ...(scuolaId ? { scuolaId } : {}),
  });
  return data.data.config;
};

/** POST /api/pagamenti/onboarding — avvia/riprende l'onboarding Connect. */
export const avviaOnboarding = async (scuolaId) => {
  const { data } = await apiClient.post('/pagamenti/onboarding', {
    ...(scuolaId ? { scuolaId } : {}),
  });
  return data.data; // { url }
};

/** GET /api/pagamenti/onboarding/stato — sincronizza lo stato onboarding. */
export const getStatoOnboarding = async (scuolaId) => {
  const params = scuolaId ? { scuolaId } : {};
  const { data } = await apiClient.get('/pagamenti/onboarding/stato', { params });
  return data.data.config;
};

/** GET /api/pagamenti/scuola — incassi ricevuti dalla scuola. */
export const getPagamentiScuola = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.scuolaId) params.scuolaId = filters.scuolaId;
  const { data } = await apiClient.get('/pagamenti/scuola', { params });
  return data.data.pagamenti;
};
