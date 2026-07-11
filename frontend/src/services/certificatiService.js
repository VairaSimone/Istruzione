import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo CERTIFICAZIONI.
 * Mappa 1:1 gli endpoint di `backend/src/routes/certificatoRoutes.js`.
 *
 * Tre gruppi:
 *   - LETTURE (studente + staff): elenco, dettaglio;
 *   - GESTIONE (insegnante|admin): rilascio, revoca, upload risorse (logo/firma);
 *   - VERIFICA PUBBLICA: senza autenticazione, tramite codice.
 *
 * Il PDF NON passa da qui: si scarica come navigazione del browser verso
 * l'endpoint protetto (cfr. `utils/certificatoUrl`), che porta i cookie.
 */

// ── Letture (studente + staff) ──

/** GET /api/certificati — elenco (studente: i propri; staff: quelli della scuola). */
export const getCertificati = async (filters = {}) => {
  const params = {};
  if (filters.utenteId) params.utenteId = filters.utenteId;
  if (filters.corsoId) params.corsoId = filters.corsoId;
  if (filters.stato) params.stato = filters.stato;
  if (filters.q) params.q = filters.q;
  if (filters.scuolaId) params.scuolaId = filters.scuolaId;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/certificati', { params });
  return { certificati: data.data.certificati, paginazione: data.paginazione ?? null };
};

/** GET /api/certificati/:id — dettaglio. */
export const getCertificatoById = async (id) => {
  const { data } = await apiClient.get(`/certificati/${id}`);
  return data.data.certificato;
};

// ── Gestione (insegnante/admin) ──

/** POST /api/certificati — rilascia un certificato. */
export const emettiCertificato = async (payload) => {
  const { data } = await apiClient.post('/certificati', payload);
  return data.data.certificato;
};

/** POST /api/certificati/:id/revoca — revoca un certificato. */
export const revocaCertificato = async ({ id, motivo }) => {
  const { data } = await apiClient.post(`/certificati/${id}/revoca`, { motivo });
  return data.data.certificato;
};

/**
 * POST /api/certificati/risorse — carica un'immagine (logo/firma) per il modello.
 * Restituisce il file (con `id`) da salvare nelle impostazioni della scuola.
 */
export const uploadRisorsa = async ({ file, onProgress }) => {
  const form = new FormData();
  form.append('file', file);
  // Content-Type multipart lasciato al browser (boundary): NON impostarlo a mano.
  const { data } = await apiClient.post('/certificati/risorse', form, {
    onUploadProgress: (evento) => {
      if (!onProgress) return;
      const totale = evento.total ?? 0;
      if (totale > 0) onProgress(Math.round((evento.loaded * 100) / totale));
    },
  });
  return data.data.file;
};

// ── Verifica pubblica (nessuna autenticazione) ──

/** GET /api/certificati/verifica/:codice — verifica pubblica. */
export const verificaCertificato = async (codice) => {
  const { data } = await apiClient.get(
    `/certificati/verifica/${encodeURIComponent(codice)}`
  );
  return data.data.certificato;
};
