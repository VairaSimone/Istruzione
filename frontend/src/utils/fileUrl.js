/**
 * URL dei file caricati delle videolezioni.
 *
 * I binari (video, copertine, allegati) NON sono risorse statiche: il backend
 * li serve solo tramite l'endpoint protetto `GET /api/corsi/files/:fileId`, che
 * autentica il richiedente e verifica scuola/disponibilità del corso prima di
 * inviare lo stream (con supporto Range per lo seek del player).
 *
 * COOKIE: la richiesta parte dal browser come sotto-risorsa (`<video src>`,
 * `<img src>`) o come navigazione (link di download), quindi NON passa da Axios
 * e non può portare header custom: l'autenticazione avviene con i cookie
 * httpOnly. Perché il browser li invii, backend e frontend devono essere
 * *same-site* (porte diverse vanno bene: `localhost:5173` ↔ `localhost:3000`).
 * In un deploy realmente cross-site va impostato `COOKIE_SAMESITE=none` lato
 * backend.
 */

/** Base URL dell'API, senza slash finale. */
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * URL assoluto del file caricato, oppure `null` se l'id non è valorizzato.
 * @param {string|null|undefined} fileId
 */
export const fileUrl = (fileId) =>
  fileId ? `${API_BASE}/corsi/files/${encodeURIComponent(fileId)}` : null;

/**
 * URL della risorsa di un capitolo/corso/documento: preferisce SEMPRE il file
 * caricato e, in sua assenza, ricade sull'eventuale URL esterno (YouTube,
 * Vimeo, CDN…). Rispecchia la precedenza applicata dal backend.
 *
 * @param {string|null|undefined} fileId  id del file caricato
 * @param {string|null|undefined} urlEsterno  URL alternativo
 * @returns {{ url: string, protetto: boolean } | null}
 */
export const risolviRisorsa = (fileId, urlEsterno) => {
  const daFile = fileUrl(fileId);
  if (daFile) return { url: daFile, protetto: true };
  if (urlEsterno) return { url: urlEsterno, protetto: false };
  return null;
};

const UNITA = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Formatta una dimensione in byte in modo leggibile (es. 1536 → "1,5 KB").
 * Usa il separatore decimale della lingua attiva del browser.
 */
export const formatBytes = (byte) => {
  const n = Number(byte);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return `0 ${UNITA[0]}`;

  const esponente = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITA.length - 1);
  const valore = n / 1024 ** esponente;
  const decimali = esponente === 0 || valore >= 100 ? 0 : 1;

  return `${valore.toLocaleString(undefined, {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  })} ${UNITA[esponente]}`;
};
