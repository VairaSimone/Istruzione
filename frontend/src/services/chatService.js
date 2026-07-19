import apiClient from '../api/axiosClient';

/**
 * Service layer per la CHAT D'AULA.
 * Mappa 1:1 gli endpoint di `backend/src/routes/chatRoutes.js` (`/api/chat`).
 *
 * La chat è un feed di gruppo per aula: tutti i membri (studenti e insegnanti)
 * leggono e scrivono lo stesso flusso e possono allegare file. L'accesso è per
 * membership, verificato dal backend.
 */

/** Config Axios per una richiesta multipart (Axios scrive da sé il boundary). */
const configUpload = (onProgress) => ({
  onUploadProgress: (evento) => {
    if (!onProgress) return;
    const totale = evento.total ?? 0;
    if (totale > 0) onProgress(Math.round((evento.loaded * 100) / totale));
  },
});

/** GET /api/chat/aule — le mie aule con chat (anteprima + non letti). */
export const getAule = async () => {
  const { data } = await apiClient.get('/chat/aule');
  return data.data.aule;
};

/** GET /api/chat/notifiche — conteggio non letti su tutte le mie aule. */
export const getNotifiche = async () => {
  const { data } = await apiClient.get('/chat/notifiche');
  return data.data; // { nonLetti, perAula }
};

/**
 * GET /api/chat/:classeId/messaggi — feed dell'aula.
 * `primaDi` (ISO) è il cursore per caricare i messaggi PRECEDENTI (scroll su).
 */
export const getMessaggi = async ({ classeId, primaDi, limit } = {}) => {
  const params = {};
  if (primaDi) params.primaDi = primaDi;
  if (limit) params.limit = limit;
  const { data } = await apiClient.get(`/chat/${classeId}/messaggi`, { params });
  return data.data; // { messaggi, aula, haAltri }
};

/** POST /api/chat/:classeId/messaggi — invia un messaggio di testo. */
export const inviaMessaggio = async ({ classeId, corpo }) => {
  const { data } = await apiClient.post(`/chat/${classeId}/messaggi`, { corpo });
  return data.data.messaggio;
};

/**
 * POST /api/chat/:classeId/messaggi/allegato/:tipo — invia un messaggio con
 * allegato (campo file `file`, testo opzionale `corpo`).
 */
export const inviaAllegato = async ({ classeId, tipo, corpo, file, onProgress }) => {
  const form = new FormData();
  form.append('file', file);
  if (corpo && corpo.trim() !== '') form.append('corpo', corpo);
  const { data } = await apiClient.post(
    `/chat/${classeId}/messaggi/allegato/${tipo}`,
    form,
    configUpload(onProgress)
  );
  return data.data.messaggio;
};

/** POST /api/chat/:classeId/letto — segna la chat come letta. */
export const segnaLetto = async (classeId) => {
  const { data } = await apiClient.post(`/chat/${classeId}/letto`);
  return data.data;
};

/** DELETE /api/chat/:classeId/messaggi/:messaggioId — elimina un messaggio. */
export const eliminaMessaggio = async ({ classeId, messaggioId }) => {
  const { data } = await apiClient.delete(`/chat/${classeId}/messaggi/${messaggioId}`);
  return data;
};
