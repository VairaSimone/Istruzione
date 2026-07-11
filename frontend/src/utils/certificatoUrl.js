/**
 * URL degli endpoint protetti dei CERTIFICATI serviti come byte (PDF, immagini).
 *
 * Come per i file delle videolezioni (`utils/fileUrl`), questi endpoint NON
 * passano da Axios: il browser li richiede come navigazione (download del PDF)
 * o come sotto-risorsa (`<img src>` per l'anteprima di logo/firma), quindi non
 * può portare header custom. L'autenticazione avviene con i cookie httpOnly:
 * perché il browser li invii, backend e frontend devono essere *same-site*
 * (porte diverse vanno bene: `localhost:5173` ↔ `localhost:3000`).
 */

/** Base URL dell'API, senza slash finale. */
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * URL del PDF del certificato (download), oppure `null` se l'id manca.
 * @param {string|null|undefined} id
 */
export const certificatoPdfUrl = (id) =>
  id ? `${API_BASE}/certificati/${encodeURIComponent(id)}/pdf` : null;

/**
 * URL di anteprima di una risorsa (logo/firma) del modello certificato, oppure
 * `null` se il fileId manca. Riservato allo staff (il backend verifica la scuola).
 * @param {string|null|undefined} fileId
 */
export const certificatoRisorsaUrl = (fileId) =>
  fileId ? `${API_BASE}/certificati/risorse/${encodeURIComponent(fileId)}` : null;
