import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Store del CONSENSO COOKIE (Provvedimento Garante 10/06/2021).
 *
 * MODELLO:
 *  - i cookie NECESSARI (tecnici) sono sempre attivi e non disattivabili;
 *  - le altre categorie (preferenze, statistiche, marketing) partono DISATTIVE
 *    e si attivano solo con un'azione esplicita dell'utente. Nessuno script non
 *    essenziale deve partire finché la categoria relativa non è concessa;
 *  - `deciso` è true solo dopo una scelta esplicita: finché è false il banner
 *    resta visibile e vale il rifiuto per default (nessun consenso implicito,
 *    niente accettazione da scroll).
 *
 * PERSISTENZA:
 *  - come per il tema, NON si usa il middleware `persist`: la gestione manuale
 *    di localStorage è SSR-safe e resiliente (modalità privata restrittiva).
 *  - viene salvata anche la VERSIONE dell'informativa: se l'informativa cookie
 *    cambia, il consenso salvato con una versione precedente viene ignorato e il
 *    banner ricompare per una nuova raccolta.
 */

import { VERSIONE_CONSENSO_COOKIE } from '../constants/legaleContenuti';

export const CONSENSO_STORAGE_KEY = 'app_consenso_cookie';

/** Categorie gestite. `necessari` è implicito e sempre concesso. */
export const CATEGORIE_COOKIE = ['preferenze', 'statistiche', 'marketing'];

const isBrowser = typeof window !== 'undefined';

const consensoVuoto = () => ({
  preferenze: false,
  statistiche: false,
  marketing: false,
});

const consensoPieno = () => ({
  preferenze: true,
  statistiche: true,
  marketing: true,
});

const normalizza = (blob) => {
  const base = consensoVuoto();
  if (!blob || typeof blob !== 'object') return base;
  for (const cat of CATEGORIE_COOKIE) {
    if (typeof blob[cat] === 'boolean') base[cat] = blob[cat];
  }
  return base;
};

const leggiSalvato = () => {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(CONSENSO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Consenso di una versione precedente dell'informativa: da riraccogliere.
    if (parsed?.versione !== VERSIONE_CONSENSO_COOKIE) return null;
    return { consenso: normalizza(parsed.consenso), deciso: true };
  } catch {
    return null;
  }
};

const persisti = (consenso) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(
      CONSENSO_STORAGE_KEY,
      JSON.stringify({
        versione: VERSIONE_CONSENSO_COOKIE,
        consenso,
        salvatoIl: new Date().toISOString(),
      })
    );
  } catch {
    // best-effort: la UI resta comunque coerente in memoria
  }
};

const salvato = leggiSalvato();

const storeCreator = (set) => ({
  // I cookie necessari non compaiono qui perché sono sempre concessi.
  consenso: salvato?.consenso ?? consensoVuoto(),
  deciso: salvato?.deciso ?? false,

  /** Accetta tutte le categorie. */
  accettaTutti: () => {
    const consenso = consensoPieno();
    persisti(consenso);
    set({ consenso, deciso: true }, false, 'consenso/accettaTutti');
  },

  /** Rifiuta tutto tranne i necessari (deve essere facile quanto accettare). */
  rifiutaNonNecessari: () => {
    const consenso = consensoVuoto();
    persisti(consenso);
    set({ consenso, deciso: true }, false, 'consenso/rifiutaNonNecessari');
  },

  /** Salva una scelta granulare per categoria. */
  salvaPreferenze: (parziale) => {
    const consenso = normalizza(parziale);
    persisti(consenso);
    set({ consenso, deciso: true }, false, 'consenso/salvaPreferenze');
  },

  /** Riapre il banner (usato dal link "Gestisci cookie" nel footer). */
  riapri: () => set({ deciso: false }, false, 'consenso/riapri'),
});

export const useConsensoStore = create(
  import.meta.env.DEV ? devtools(storeCreator, { name: 'consenso-store' }) : storeCreator
);

/** Selettori comodi. */
export const selectDeciso = (state) => state.deciso;
export const selectConsenso = (state) => state.consenso;

/**
 * True se la categoria è concessa. I cookie `necessari` sono sempre concessi.
 * Usare questo helper prima di caricare script non essenziali (es. analytics).
 */
export const consensoConcesso = (categoria) => {
  if (categoria === 'necessari') return true;
  return Boolean(useConsensoStore.getState().consenso[categoria]);
};
