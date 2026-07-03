'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Dizionari canonici dei Kanji (per livello JLPT) + utilità di filtraggio.
 *
 * Speculare a `kanaData.js`: è la FONTE DI VERITÀ del backend per il Quiz Kanji.
 * La selezione dei caratteri (SRS) e la costruzione delle domande si basano
 * esclusivamente su questi dati.
 *
 * I dataset per livello (`kanjiData/n5.json` … `n1.json`) sono generati offline
 * da `scripts/generaKanjiData.js` a partire da una fonte autorevole
 * (KANJIDIC2 + liste JLPT moderne): letture, significati EN, livello JLPT e
 * numero di tratti NON sono inventati. Le glosse italiane sono curate a mano
 * per l'N5; dove assenti, `significatiPerLingua` ripiega sull'inglese.
 *
 * Struttura di una voce (come nei JSON):
 *   {
 *     ideogramma: '日',
 *     onYomi: ['ニチ','ジツ'],
 *     kunYomi: ['ひ','び','か'],
 *     significati: { it: ['giorno','sole','Giappone'], en: ['Day','Sun','Japan'] },
 *     livello_jlpt: 'N5',
 *     tratti: 4
 *   }
 */

// ─────────────────────────────────────────────
// Costanti pubbliche
// ─────────────────────────────────────────────
// Ordine dal più facile (N5) al più difficile (N1).
const LIVELLI_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LINGUE_SIGNIFICATI = ['it', 'en'];
const LINGUA_FALLBACK = 'en'; // glosse sempre disponibili dalla fonte

const DATA_DIR = __dirname;

// ─────────────────────────────────────────────
// Caricamento dei dataset per livello (solo quelli presenti su disco).
// Robusto se un livello non è ancora stato generato: viene semplicemente
// saltato, così il sistema resta coerente con qualunque sottoinsieme di livelli.
// ─────────────────────────────────────────────
const caricaLivello = (livello) => {
  const file = path.join(DATA_DIR, `${livello.toLowerCase()}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw && Array.isArray(raw.kanji) ? raw : null;
};

// Indice piatto: una entry per ogni kanji, con livello esplicito e normalizzato.
//   { ideogramma, onYomi, kunYomi, significati, livello, tratti }
const INDICE_KANJI = [];
// Livelli effettivamente disponibili (con file presente e non vuoto).
const LIVELLI_DISPONIBILI = [];
// Attribuzione della fonte (primo dataset che la espone).
let LICENZA_KANJI = null;

for (const livello of LIVELLI_JLPT) {
  const dataset = caricaLivello(livello);
  if (!dataset || dataset.kanji.length === 0) continue;

  LIVELLI_DISPONIBILI.push(livello);
  if (!LICENZA_KANJI && dataset.licenza) LICENZA_KANJI = Object.freeze(dataset.licenza);

  for (const voce of dataset.kanji) {
    INDICE_KANJI.push({
      ideogramma: voce.ideogramma,
      onYomi: Array.isArray(voce.onYomi) ? voce.onYomi : [],
      kunYomi: Array.isArray(voce.kunYomi) ? voce.kunYomi : [],
      significati: {
        it: Array.isArray(voce.significati?.it) ? voce.significati.it : [],
        en: Array.isArray(voce.significati?.en) ? voce.significati.en : [],
      },
      livello,
      tratti: typeof voce.tratti === 'number' ? voce.tratti : null,
    });
  }
}

// Lookup O(1) per validazione/risoluzione: chiave = ideogramma.
// Nel dataset ogni kanji appartiene a un solo livello JLPT (jlpt_new unico),
// quindi l'ideogramma è chiave sufficiente.
const MAPPA_LOOKUP = new Map();
for (const entry of INDICE_KANJI) {
  MAPPA_LOOKUP.set(entry.ideogramma, entry);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** True se il livello JLPT è tra quelli disponibili. */
const livelloValido = (livello) => LIVELLI_DISPONIBILI.includes(livello);

/**
 * Restituisce la entry canonica di un kanji, o `null` se non esiste.
 * Se `livello` è passato, richiede anche la corrispondenza del livello JLPT
 * (usato per validare in modo difensivo le risposte inviate dal client).
 */
const trovaKanji = (ideogramma, livello = null) => {
  const entry = MAPPA_LOOKUP.get(ideogramma) || null;
  if (!entry) return null;
  if (livello && entry.livello !== livello) return null;
  return entry;
};

/**
 * Significati di una entry nella lingua richiesta, con fallback all'inglese
 * (sempre presente dalla fonte) se la lingua non ha glosse per quel kanji.
 * @returns {string[]}
 */
const significatiPerLingua = (entry, lingua) => {
  const cod = LINGUE_SIGNIFICATI.includes(lingua) ? lingua : LINGUA_FALLBACK;
  const scelti = entry.significati[cod];
  if (Array.isArray(scelti) && scelti.length > 0) return scelti;
  return entry.significati[LINGUA_FALLBACK] || [];
};

/**
 * Filtra i kanji per livello JLPT.
 * @param {Object} opts
 * @param {string} opts.livello  uno di LIVELLI_JLPT
 * @returns {Array<entry>} le voci del livello (riferimenti all'indice, non mutare)
 */
const filtraKanji = ({ livello }) => INDICE_KANJI.filter((e) => e.livello === livello);

module.exports = {
  LIVELLI_JLPT,
  LIVELLI_DISPONIBILI,
  LINGUE_SIGNIFICATI,
  INDICE_KANJI,
  LICENZA_KANJI,
  livelloValido,
  trovaKanji,
  filtraKanji,
  significatiPerLingua,
};
