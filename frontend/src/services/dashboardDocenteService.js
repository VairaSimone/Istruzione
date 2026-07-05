import apiClient from '../api/axiosClient';

/**
 * Service layer per la DASHBOARD DOCENTE.
 * Mappa gli endpoint di `backend/src/routes/dashboardRoutes.js`.
 * Sola lettura: statistiche aggregate per aula o globali.
 */

const buildParams = ({ giorni, limite } = {}) => {
  const params = {};
  if (giorni) params.giorni = giorni;
  if (limite) params.limite = limite;
  return params;
};

/** GET /api/dashboard — cruscotto globale (mie aule / tutto per admin). */
export const getDashboardGlobale = async (opzioni = {}) => {
  const { data } = await apiClient.get('/dashboard', { params: buildParams(opzioni) });
  return data.data;
};

/** GET /api/dashboard/aula/:classeId — cruscotto di una singola aula. */
export const getDashboardAula = async (classeId, opzioni = {}) => {
  const { data } = await apiClient.get(`/dashboard/aula/${classeId}`, {
    params: buildParams(opzioni),
  });
  return data.data;
};
