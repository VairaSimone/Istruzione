import apiClient from '../api/axiosClient';

/**
 * Service layer per il modulo CORSI (videolezioni on-demand).
 * Mappa 1:1 gli endpoint di `backend/src/routes/corsiRoutes.js`.
 *
 * Due gruppi: azioni dello STAFF (insegnante/admin) — CRUD corsi, capitoli,
 * documenti allegati e gestione della disponibilità presso le aule — e vista
 * dello STUDENTE (catalogo dei corsi disponibili e player con policy di
 * download effettiva).
 *
 * UPLOAD: video, copertine e documenti si caricano come FILE dal PC
 * (`multipart/form-data`, campo `file`). L'URL esterno resta un'alternativa
 * facoltativa: caricando un file, il backend azzera il rispettivo campo URL.
 */

/**
 * Costruisce la configurazione Axios per una richiesta multipart.
 *
 * NON impostiamo `Content-Type` a mano: Axios lo azzera quando il body è un
 * FormData, lasciando che sia il browser a scriverlo con il `boundary`
 * corretto. Forzarlo produrrebbe un boundary mancante e un 400 lato server.
 *
 * @param {Function} [onProgress] callback (0-100) per la barra di avanzamento
 */
const configUpload = (onProgress) => ({
  onUploadProgress: (evento) => {
    if (!onProgress) return;
    const totale = evento.total ?? 0;
    if (totale > 0) {
      onProgress(Math.round((evento.loaded * 100) / totale));
    }
  },
});

/** FormData con il file nel campo `file` e i campi testo facoltativi. */
const buildFormData = (file, campi = {}) => {
  const form = new FormData();
  form.append('file', file);
  Object.entries(campi).forEach(([chiave, valore]) => {
    if (valore !== undefined && valore !== null && valore !== '') {
      form.append(chiave, valore);
    }
  });
  return form;
};

// ── Staff (insegnante | admin) ──

/** GET /api/corsi — elenco corsi della propria scuola, con filtri/paginazione. */
export const getCorsi = async (filters = {}) => {
  const params = {};
  if (filters.stato) params.stato = filters.stato;
  if (filters.materia) params.materia = filters.materia;
  if (filters.livello) params.livello = filters.livello;
  if (filters.q) params.q = filters.q;
  if (filters.scuola) params.scuola = filters.scuola;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/corsi', { params });
  return { corsi: data.data.corsi, paginazione: data.paginazione ?? null };
};

/** GET /api/corsi/:id — dettaglio con capitoli, documenti e aule disponibili. */
export const getCorsoById = async (id) => {
  const { data } = await apiClient.get(`/corsi/${id}`);
  return data.data.corso;
};

/** POST /api/corsi — crea corso (capitoli inline facoltativi). */
export const createCorso = async (payload) => {
  const { data } = await apiClient.post('/corsi', payload);
  return data.data.corso;
};

/** PATCH /api/corsi/:id — aggiorna i metadati del corso. */
export const updateCorso = async ({ id, ...payload }) => {
  const { data } = await apiClient.patch(`/corsi/${id}`, payload);
  return data.data.corso;
};

/** DELETE /api/corsi/:id — elimina il corso (cascade su capitoli/documenti). */
export const deleteCorso = async (id) => {
  const { data } = await apiClient.delete(`/corsi/${id}`);
  return data;
};

// ── Copertina del corso (file dal PC) ──

/** POST /api/corsi/:id/copertina — carica/sostituisce la copertina. */
export const uploadCopertina = async ({ id, file, onProgress }) => {
  const { data } = await apiClient.post(
    `/corsi/${id}/copertina`,
    buildFormData(file),
    configUpload(onProgress)
  );
  return data.data.corso;
};

/** DELETE /api/corsi/:id/copertina — rimuove la copertina caricata. */
export const deleteCopertina = async (id) => {
  const { data } = await apiClient.delete(`/corsi/${id}/copertina`);
  return data;
};

// ── Capitoli ──

/** POST /api/corsi/:id/capitoli — aggiunge un capitolo al corso. */
export const addCapitolo = async ({ id, ...payload }) => {
  const { data } = await apiClient.post(`/corsi/${id}/capitoli`, payload);
  return data.data.capitolo;
};

/** PATCH /api/corsi/:id/capitoli/:capitoloId — aggiorna un capitolo. */
export const updateCapitolo = async ({ id, capitoloId, ...payload }) => {
  const { data } = await apiClient.patch(`/corsi/${id}/capitoli/${capitoloId}`, payload);
  return data.data.capitolo;
};

/** DELETE /api/corsi/:id/capitoli/:capitoloId — elimina un capitolo. */
export const deleteCapitolo = async ({ id, capitoloId }) => {
  const { data } = await apiClient.delete(`/corsi/${id}/capitoli/${capitoloId}`);
  return data;
};

// ── Video del capitolo (file dal PC) ──

/** POST /api/corsi/:id/capitoli/:capitoloId/video — carica/sostituisce il video. */
export const uploadVideoCapitolo = async ({
  id,
  capitoloId,
  file,
  videoDurataSecondi,
  onProgress,
}) => {
  const { data } = await apiClient.post(
    `/corsi/${id}/capitoli/${capitoloId}/video`,
    buildFormData(file, { videoDurataSecondi }),
    configUpload(onProgress)
  );
  return data.data.capitolo;
};

/** DELETE /api/corsi/:id/capitoli/:capitoloId/video — rimuove il video caricato. */
export const deleteVideoCapitolo = async ({ id, capitoloId }) => {
  const { data } = await apiClient.delete(`/corsi/${id}/capitoli/${capitoloId}/video`);
  return data;
};

// ── Documenti allegati al capitolo ──

/** POST /api/corsi/:id/capitoli/:capitoloId/documenti — aggiunge un documento. */
export const addDocumento = async ({ id, capitoloId, ...payload }) => {
  const { data } = await apiClient.post(
    `/corsi/${id}/capitoli/${capitoloId}/documenti`,
    payload
  );
  return data.data.documento;
};

/**
 * POST /api/corsi/:id/capitoli/:capitoloId/documenti/upload — allega un
 * documento caricandolo dal PC. Il titolo è facoltativo: in mancanza il backend
 * usa il nome originale del file.
 */
export const uploadDocumentoFile = async ({
  id,
  capitoloId,
  file,
  titolo,
  onProgress,
}) => {
  const { data } = await apiClient.post(
    `/corsi/${id}/capitoli/${capitoloId}/documenti/upload`,
    buildFormData(file, { titolo }),
    configUpload(onProgress)
  );
  return data.data.documento;
};

/** DELETE /api/corsi/:id/capitoli/:capitoloId/documenti/:documentoId. */
export const deleteDocumento = async ({ id, capitoloId, documentoId }) => {
  const { data } = await apiClient.delete(
    `/corsi/${id}/capitoli/${capitoloId}/documenti/${documentoId}`
  );
  return data;
};

// ── Disponibilità presso le aule ──

/** POST /api/corsi/:id/disponibilita — rende il corso disponibile a un'aula. */
export const rendiDisponibile = async ({ id, classeId }) => {
  const { data } = await apiClient.post(`/corsi/${id}/disponibilita`, { classeId });
  return data.data.aula;
};

/** DELETE /api/corsi/:id/disponibilita/:classeId — revoca la disponibilità. */
export const revocaDisponibilita = async ({ id, classeId }) => {
  const { data } = await apiClient.delete(`/corsi/${id}/disponibilita/${classeId}`);
  return data;
};

// ── Studente ──

/** GET /api/corsi/studente — catalogo dei corsi disponibili allo studente. */
export const getCorsiStudente = async (filters = {}) => {
  const params = {};
  if (filters.materia) params.materia = filters.materia;
  if (filters.livello) params.livello = filters.livello;
  if (filters.q) params.q = filters.q;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const { data } = await apiClient.get('/corsi/studente', { params });
  return { corsi: data.data.corsi, paginazione: data.paginazione ?? null };
};

/** GET /api/corsi/studente/:id — dettaglio corso per lo studente (player). */
export const getCorsoStudenteById = async (id) => {
  const { data } = await apiClient.get(`/corsi/studente/${id}`);
  return data.data.corso;
};
