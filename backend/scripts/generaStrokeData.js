'use strict';

/**
 * generaStrokeData.js — generatore (offline) dei dataset di ordine dei tratti.
 *
 * Scarica i glifi KanjiVG corrispondenti a TUTTI i caratteri kana usati dal
 * Quiz (derivati dalla fonte di verità `src/constants/kanaData.js`, inclusi i
 * piccoli ゃゅょ/ャュョ necessari a comporre gli yōon) ed estrae, in ordine di
 * tratto, gli attributi `d` dei path SVG. Il risultato è scritto in:
 *
 *   src/constants/strokeData/hiragana.json
 *   src/constants/strokeData/katakana.json
 *
 * keyed per singolo carattere → { strokes: ["<d>", ...] } nel sistema di
 * coordinate nativo di KanjiVG (viewBox "0 0 109 109", ordine documentale =
 * ordine dei tratti).
 *
 * Questo script NON gira a runtime: i JSON generati sono committati nel repo
 * così il backend resta autosufficiente (nessuna dipendenza di rete in
 * produzione). Va rieseguito solo se cambia l'insieme dei kana o si aggiorna
 * KanjiVG:
 *
 *   node scripts/generaStrokeData.js
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  ATTRIBUZIONE / LICENZA (obbligatoria — share-alike)
 *  --------------------------------------------------------------------------
 *  I dati dei tratti derivano da KanjiVG (https://kanjivg.tagaini.net),
 *  Copyright (C) Ulrich Apel et al., distribuito sotto licenza
 *  Creative Commons Attribution-Share Alike 3.0.
 *  Vedi: https://creativecommons.org/licenses/by-sa/3.0/
 *  L'attribuzione è ribadita anche a runtime nel payload dell'API
 *  (campo `licenza`) e in src/constants/strokeData/index.js.
 * ──────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const { INDICE_KANA } = require('../src/constants/kanaData');

const KANJIVG_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji';
const DEST_DIR = path.resolve(__dirname, '..', 'src', 'constants', 'strokeData');

// Range Unicode dei blocchi.
const inBloccoHiragana = (ch) => {
  const c = ch.codePointAt(0);
  return c >= 0x3040 && c <= 0x309f;
};

/** Codepoint → nome file KanjiVG (5 hex, lowercase, zero-padded). */
const nomeFileKanjiVG = (ch) => ch.codePointAt(0).toString(16).padStart(5, '0');

/** GET testuale via https, rifiuta su status != 200. */
const scarica = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} per ${url}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });

/**
 * Estrae gli attributi `d` dei path in ordine documentale (= ordine dei tratti).
 * I path KanjiVG hanno id `kvg:<code>-s<N>` ed eventuali attributi intermedi
 * (es. `kvg:type`) prima di `d`, quindi la regex tollera attributi in mezzo.
 */
const estraiTratti = (svg) => {
  const re = /<path\s+id="kvg:[0-9a-f]+-s\d+"[^>]*?\sd="([^"]+)"/g;
  const strokes = [];
  let m;
  while ((m = re.exec(svg)) !== null) {
    strokes.push(m[1].trim());
  }
  return strokes;
};

/** Insieme ordinato e deduplicato dei singoli caratteri necessari. */
const caratteriNecessari = () => {
  const set = new Set();
  for (const entry of INDICE_KANA) {
    for (const ch of Array.from(entry.kana)) set.add(ch);
  }
  return Array.from(set);
};

const ordinaPerCodepoint = (oggetto) =>
  Object.fromEntries(
    Object.entries(oggetto).sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0))
  );

const main = async () => {
  const chars = caratteriNecessari();
  const hiragana = {};
  const katakana = {};
  const falliti = [];

  for (const ch of chars) {
    const url = `${KANJIVG_BASE}/${nomeFileKanjiVG(ch)}.svg`;
    try {
      const svg = await scarica(url);
      const strokes = estraiTratti(svg);
      if (strokes.length === 0) {
        falliti.push(`${ch} (nessun tratto)`);
        continue;
      }
      (inBloccoHiragana(ch) ? hiragana : katakana)[ch] = { strokes };
    } catch (err) {
      falliti.push(`${ch} (${err.message})`);
    }
  }

  if (falliti.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Caratteri non risolti:', falliti.join(', '));
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DEST_DIR, 'hiragana.json'),
    JSON.stringify(ordinaPerCodepoint(hiragana))
  );
  fs.writeFileSync(
    path.join(DEST_DIR, 'katakana.json'),
    JSON.stringify(ordinaPerCodepoint(katakana))
  );

  // eslint-disable-next-line no-console
  console.log(
    `Generati: hiragana=${Object.keys(hiragana).length} caratteri, ` +
      `katakana=${Object.keys(katakana).length} caratteri.`
  );
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
