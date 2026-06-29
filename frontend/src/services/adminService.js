import apiClient from '../api/axiosClient';

/**
 * Service layer per le operazioni ADMIN (approvazione candidature insegnante).
 * Mappa 1:1 gli endpoint di `backend/src/routes/adminRoutes.js`.
 * Tutti richiedono ruolo 'admin' (controllo applicato server-side).
 */

/**
 * GET /api/admin/teacher-requests — elenco candidature insegnante.
 * `stato` default lato backend = 'in_attesa'; usare 'tutte' per tutte.
 */
export const getTeacherRequests = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.nome) params.nome = filters.nome;

  const { data } = await apiClient.get('/admin/teacher-requests', { params });
  return data.data.candidature;
};

/** POST /api/admin/teacher-requests/:id/approve */
export const approveTeacher = async (id) => {
  const { data } = await apiClient.post(`/admin/teacher-requests/${id}/approve`);
  return data;
};

/** POST /api/admin/teacher-requests/:id/reject — { motivazione? } */
export const rejectTeacher = async ({ id, motivazione }) => {
  const { data } = await apiClient.post(`/admin/teacher-requests/${id}/reject`, {
    ...(motivazione ? { motivazione } : {}),
  });
  return data;
};

export const getSchools = async () => {
  const response = await apiClient.get('/admin/schools');
  return response.data.data.scuole;
};

export const createSchool = async (nome) => {
  const response = await apiClient.post('/admin/schools', { nome });
  return response.data.data.scuola;
};