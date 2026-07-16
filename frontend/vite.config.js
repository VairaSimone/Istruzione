import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ─────────────────────────────────────────────
 * SUDDIVISIONE DEL BUNDLE
 * ─────────────────────────────────────────────
 * Il code splitting PER PAGINA c'è già (`React.lazy` + `lazyPages.js`): il peso
 * non è nelle pagine, è nello SHELL — ciò che serve al primo render e quindi non
 * si può rimandare. Il chunk `index` sfondava i 500 kB.
 *
 * Due sono i pesi grossi, e vanno separati per ragioni diverse:
 *
 *   i18n-locales  I due `translation.json` (IT + EN) pesano ~190 kB di sorgente.
 *                 NON si possono caricare a richiesta senza rompere una scelta
 *                 dichiarata in `src/i18n.js`: le risorse sono importate in modo
 *                 statico perché l'init sia SINCRONO e la UI compaia già nella
 *                 lingua giusta, senza <Suspense> né sfarfallii. La scelta resta.
 *                 In un chunk proprio restano un import statico (quindi
 *                 precaricato in parallelo, non in cascata) ma smettono di
 *                 invalidare l'`index` a ogni ritocco di una traduzione — che è
 *                 la cosa che si tocca più spesso di tutte.
 *
 *   i18n-vendor   i18next + react-i18next + il detector: stabili, si aggiornano
 *                 raramente, non c'è motivo di rispedirli a ogni rilascio.
 *
 * La forma a FUNZIONE (invece della mappa) serve perché i locali sono file del
 * progetto, non pacchetti: vanno riconosciuti dal percorso. Rollup non ammette
 * le due forme insieme, quindi anche i vendor storici passano di qui.
 *
 * `i18next-fs-backend` NON compare: è una dipendenza del BACKEND (legge i JSON
 * da disco con Node). Nel frontend non è mai stato importato — quel peso non
 * c'era.
 */

/** Pacchetti raggruppati per chunk. La prima corrispondenza vince. */
const VENDOR = [
  ['react-vendor', ['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler']],
  ['query-vendor', ['@tanstack/react-query', '@tanstack/react-query-devtools', '@tanstack/query-core']],
  ['form-vendor', ['react-hook-form', '@hookform/resolvers', 'zod']],
  ['i18n-vendor', ['i18next', 'react-i18next', 'i18next-browser-languagedetector']],
];

/** True se l'id appartiene al pacchetto indicato (e non a uno con nome più lungo). */
const appartieneA = (id, pacchetto) =>
  id.includes(`/node_modules/${pacchetto}/`);

const manualChunks = (id) => {
  const percorso = id.split('\\').join('/');

  // Risorse di traduzione del progetto: file nostri, non pacchetti.
  if (percorso.includes('/src/locales/')) return 'i18n-locales';

  if (!percorso.includes('/node_modules/')) return undefined;

  for (const [chunk, pacchetti] of VENDOR) {
    if (pacchetti.some((p) => appartieneA(percorso, p))) return chunk;
  }

  // Tutto il resto: decide Rollup.
  return undefined;
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
});
