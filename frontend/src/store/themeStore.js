import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Store del tema (Chiaro / Scuro).
 *
 * MODELLO:
 *  - `theme`: tema EFFETTIVO applicato al DOM ('light' | 'dark').
 *  - `hasExplicitPreference`: true quando l'utente ha scelto manualmente.
 *    Finché è false, l'app SEGUE in tempo reale la preferenza del sistema
 *    operativo (prefers-color-scheme). Al primo toggle manuale diventa true
 *    e da quel momento la scelta dell'utente ha la precedenza sul sistema.
 *
 * PERSISTENZA:
 *  - La scelta esplicita è persistita su localStorage (chiave THEME_STORAGE_KEY).
 *  - NON usiamo il middleware `persist` di Zustand perché il tema va applicato
 *    al DOM PRIMA del primo paint (anti-FOUC) dallo script inline in index.html,
 *    che legge la stessa identica chiave. La gestione manuale tiene le due fonti
 *    perfettamente allineate.
 *
 * APPLICAZIONE AL DOM:
 *  - L'attributo `data-theme` su <html> pilota i token cromatici in global.css.
 *    Aggiornarlo cambia il tema in tempo reale, senza alcun refresh di pagina.
 *
 * Il middleware `devtools` è abilitato SOLO in sviluppo, coerentemente con
 * authStore.
 */

/** DEVE combaciare con la chiave usata dallo script inline anti-FOUC in index.html. */
export const THEME_STORAGE_KEY = 'app_tema';

export const THEMES = { LIGHT: 'light', DARK: 'dark' };
const VALID_THEMES = [THEMES.LIGHT, THEMES.DARK];

const isBrowser = typeof window !== 'undefined';

const systemPrefersDark = () =>
  isBrowser && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

const readStoredTheme = () => {
  if (!isBrowser) return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.includes(value) ? value : null;
  } catch {
    // localStorage non disponibile (es. modalità privata restrittiva)
    return null;
  }
};

const persistTheme = (theme) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // best-effort: la UI resta comunque aggiornata in memoria
  }
};

const applyThemeToDom = (theme) => {
  if (!isBrowser) return;
  document.documentElement.setAttribute('data-theme', theme);
};

// ── Stato iniziale ──────────────────────────────────────────────────────────
// Precedenza: scelta esplicita salvata > preferenza di sistema > tema chiaro.
const storedTheme = readStoredTheme();
const initialTheme = storedTheme ?? (systemPrefersDark() ? THEMES.DARK : THEMES.LIGHT);
const initialHasExplicit = storedTheme !== null;

// Applichiamo subito al DOM: ridondante con lo script inline di index.html, ma
// garantisce coerenza anche se lo store viene caricato in contesti isolati.
applyThemeToDom(initialTheme);

const storeCreator = (set, get) => ({
  theme: initialTheme,
  hasExplicitPreference: initialHasExplicit,

  /**
   * Imposta un tema specifico.
   *
   * Con `{ implicito: true }` il tema viene applicato SENZA marcare una scelta
   * dell'utente e senza persistere: è la modalità usata dal branding di scuola,
   * che propone il proprio tema predefinito ma non deve mai sovrascrivere una
   * preferenza personale. La prima volta che l'utente tocca l'interruttore, la
   * sua scelta diventa esplicita e vince per sempre.
   */
  setTheme: (theme, { implicito = false } = {}) => {
    if (!VALID_THEMES.includes(theme)) return;
    if (implicito && get().hasExplicitPreference) return;
    applyThemeToDom(theme);
    if (implicito) {
      set({ theme }, false, 'theme/setThemeImplicito');
      return;
    }
    persistTheme(theme);
    set({ theme, hasExplicitPreference: true }, false, 'theme/setTheme');
  },

  /** Inverte il tema corrente (azione del ThemeToggle). */
  toggleTheme: () => {
    const next = get().theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyThemeToDom(next);
    persistTheme(next);
    set({ theme: next, hasExplicitPreference: true }, false, 'theme/toggleTheme');
  },

  /**
   * Allinea il tema alla preferenza di sistema. Ignorato se l'utente ha già
   * espresso una scelta esplicita. Invocato dal listener di matchMedia.
   *
   * Nota: se la scuola impone un tema predefinito, il BrandingProvider lo
   * riapplica in modo implicito al proprio effetto; il sistema resta la fonte
   * solo per le scuole che scelgono `temaPredefinito: 'sistema'`.
   */
  syncWithSystem: (prefersDark) => {
    if (get().hasExplicitPreference) return;
    const next = prefersDark ? THEMES.DARK : THEMES.LIGHT;
    if (next === get().theme) return;
    applyThemeToDom(next);
    set({ theme: next }, false, 'theme/syncWithSystem');
  },
});

export const useThemeStore = create(
  import.meta.env.DEV ? devtools(storeCreator, { name: 'theme-store' }) : storeCreator
);

// ── Listener della preferenza di sistema (singleton a livello di modulo) ─────
// Quando l'utente NON ha una scelta esplicita, un cambio di tema del SO si
// riflette in tempo reale nell'app.
if (isBrowser && typeof window.matchMedia === 'function') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = (event) => {
    useThemeStore.getState().syncWithSystem(event.matches);
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handleSystemChange);
  } else if (typeof mql.addListener === 'function') {
    // Fallback per browser datati (Safari < 14)
    mql.addListener(handleSystemChange);
  }
}

/** Selettori comodi per i componenti. */
export const selectTheme = (state) => state.theme;
export const selectIsDark = (state) => state.theme === THEMES.DARK;
