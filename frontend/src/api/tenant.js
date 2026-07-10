/**
 * TENANT (scuola) lato browser.
 *
 * La piattaforma è multi-scuola: la stessa build può servire più scuole, ognuna
 * con il proprio branding e le proprie sezioni attive. Prima del login non c'è
 * un utente da cui dedurre la scuola, quindi il tenant va indicato in modo
 * esplicito. Precedenza (dalla più forte alla più debole):
 *
 *   1. `?scuola=<slug>` nella query string — utile per i link condivisi;
 *   2. la variabile d'ambiente `VITE_SCUOLA_SLUG` — deploy dedicato a UNA
 *      scuola, il tenant è fissato in fase di build e non è cambiabile;
 *   3. lo slug salvato in localStorage (scelta precedente dell'utente);
 *   4. nessuno ⇒ il backend usa la propria scuola predefinita.
 *
 * Lo slug viaggia verso il backend nell'header `X-Scuola` (aggiunto da
 * `axiosClient`). Non è un dato di sicurezza: l'isolamento tra scuole è
 * garantito server-side dal `scuola_id` dell'utente autenticato. Serve solo a
 * decidere QUALE branding mostrare a un visitatore anonimo.
 */

export const SCUOLA_STORAGE_KEY = 'app_scuola';
export const HEADER_SCUOLA = 'X-Scuola';
export const PARAM_SCUOLA = 'scuola';

/** Slug fissato in fase di build (deploy mono-scuola). Vuoto ⇒ non fissato. */
const SLUG_FISSATO = (import.meta.env.VITE_SCUOLA_SLUG || '').trim();

/** Il tenant è immutabile quando la build è dedicata a una singola scuola. */
export const tenantBloccato = () => SLUG_FISSATO !== '';

const isBrowser = typeof window !== 'undefined';

// Il backend accetta uno slug (minuscole, cifre e trattini) o un UUID. Qui
// filtriamo l'input più permissivo dei due per non spedire spazzatura.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValido = (valore) =>
  typeof valore === 'string' &&
  valore.length > 0 &&
  valore.length <= 80 &&
  (SLUG_REGEX.test(valore) || UUID_REGEX.test(valore));

const leggiDaStorage = () => {
  if (!isBrowser) return null;
  try {
    const valore = window.localStorage.getItem(SCUOLA_STORAGE_KEY);
    return isValido(valore) ? valore : null;
  } catch {
    // localStorage non disponibile (modalità privata restrittiva)
    return null;
  }
};

const leggiDaQuery = () => {
  if (!isBrowser) return null;
  try {
    const valore = new URLSearchParams(window.location.search).get(PARAM_SCUOLA);
    return isValido(valore) ? valore : null;
  } catch {
    return null;
  }
};

// Lo slug della query, se presente e valido, viene memorizzato una volta sola
// all'avvio: così sopravvive alla navigazione interna, che perde la query.
let slugCorrente = null;

const inizializza = () => {
  if (tenantBloccato()) {
    slugCorrente = SLUG_FISSATO;
    return;
  }
  const daQuery = leggiDaQuery();
  if (daQuery) {
    slugCorrente = daQuery;
    scriviSuStorage(daQuery);
    return;
  }
  slugCorrente = leggiDaStorage();
};

function scriviSuStorage(slug) {
  if (!isBrowser) return;
  try {
    if (slug) window.localStorage.setItem(SCUOLA_STORAGE_KEY, slug);
    else window.localStorage.removeItem(SCUOLA_STORAGE_KEY);
  } catch {
    // best-effort: lo slug resta comunque valido per questa sessione
  }
}

inizializza();

/** Slug del tenant attivo, o `null` per lasciar decidere il backend. */
export const getScuolaSlug = () => slugCorrente;

/**
 * Cambia il tenant attivo. Ignorato quando la build è dedicata a una scuola.
 * Ritorna `true` se il valore è stato applicato.
 */
export const setScuolaSlug = (slug) => {
  if (tenantBloccato()) return false;
  if (slug !== null && !isValido(slug)) return false;
  slugCorrente = slug;
  scriviSuStorage(slug);
  return true;
};
