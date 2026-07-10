'use strict';

/**
 * generaKanjiData.js — generatore (offline) del dataset dei Kanji per il Quiz.
 *
 * Scarica un dataset Kanji AUTOREVOLE e ne deriva, suddivisi per livello JLPT
 * moderno (N5..N1), i file:
 *
 *   src/constants/kanjiData/n5.json
 *   src/constants/kanjiData/n4.json
 *   src/constants/kanjiData/n3.json
 *   src/constants/kanjiData/n2.json
 *   src/constants/kanjiData/n1.json
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  --------------------------------------------------------------------------
 *  Il dataset di partenza è `davidluzgouveia/kanji-data` (kanji.json), una
 *  fusione di:
 *    - KANJIDIC2 (EDRDG, licenza CC BY-SA 4.0) → letture on/kun e significati EN;
 *    - liste JLPT moderne (Tanos/J.Waller) → campo `jlpt_new` (5=N5 … 1=N1);
 *    - numero di tratti.
 *  Le letture e i significati inglesi, il livello JLPT e il numero di tratti
 *  provengono TUTTI da questa fonte: lo script non fabbrica alcun dato.
 *
 *  GLOSSE ITALIANE
 *  --------------------------------------------------------------------------
 *  KANJIDIC2 non contiene traduzioni italiane. Per il livello N5 (79 kanji) le
 *  glosse italiane sono curate a mano in `GLOSSE_IT_N5` (verificate 1:1 sui
 *  significati inglesi autorevoli). Per i livelli superiori il campo `it` resta
 *  vuoto in attesa di una revisione: il backend, in quel caso, usa `en` come
 *  fallback (vedi kanjiData/index.js → `significatiPerLingua`). In nessun caso
 *  vengono generate traduzioni automatiche non verificate.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Questo script NON gira a runtime: i JSON generati sono committati nel repo,
 * così il backend resta autosufficiente (nessuna dipendenza di rete in
 * produzione). Va rieseguito solo per aggiornare/estendere il dataset:
 *
 *   node scripts/generaKanjiData.js            # tutti i livelli
 *   node scripts/generaKanjiData.js n5 n4      # solo i livelli indicati
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Fonte autorevole (raw GitHub).
const SORGENTE_URL =
  'https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json';

const DEST_DIR = path.resolve(__dirname, '..', 'src', 'constants', 'kanjiData');

// Mappa jlpt_new (numero) → etichetta livello del progetto.
const LIVELLO_DA_JLPT_NEW = { 5: 'N5', 4: 'N4', 3: 'N3', 2: 'N2', 1: 'N1' };

// Attribuzione propagata anche nei JSON generati (requisito share-alike).
const LICENZA = {
  fonte: 'KANJIDIC2 (EDRDG) + liste JLPT moderne, via davidluzgouveia/kanji-data',
  url: 'https://github.com/davidluzgouveia/kanji-data',
  licenza: 'CC BY-SA 4.0',
  licenzaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

// ─────────────────────────────────────────────
// Glosse italiane curate a mano per l'N5 (verificate sui significati EN).
// Chiave = kanji, valore = array di glosse italiane in ordine di rilevanza.
// ─────────────────────────────────────────────
const GLOSSE_IT_N5 = {
  '一': ['uno'],
  '二': ['due'],
  '九': ['nove'],
  '七': ['sette'],
  '人': ['persona'],
  '入': ['entrare', 'inserire'],
  '八': ['otto'],
  '十': ['dieci'],
  '三': ['tre'],
  '上': ['sopra', 'su'],
  '下': ['sotto', 'giù', 'scendere', 'inferiore'],
  '大': ['grande'],
  '女': ['donna', 'femmina'],
  '山': ['montagna'],
  '川': ['fiume', "corso d'acqua"],
  '土': ['terra', 'suolo'],
  '千': ['mille'],
  '子': ['bambino', 'figlio'],
  '小': ['piccolo'],
  '中': ['dentro', 'mezzo', 'centro'],
  '五': ['cinque'],
  '六': ['sei'],
  '円': ['cerchio', 'yen', 'rotondo'],
  '天': ['cielo', 'paradiso'],
  '日': ['giorno', 'sole', 'Giappone'],
  '月': ['mese', 'luna'],
  '木': ['albero', 'legno'],
  '水': ['acqua'],
  '火': ['fuoco'],
  '出': ['uscire', 'uscita'],
  '右': ['destra'],
  '四': ['quattro'],
  '左': ['sinistra'],
  '本': ['libro', 'origine', 'principale'],
  '白': ['bianco'],
  '万': ['diecimila'],
  '今': ['adesso', 'ora'],
  '午': ['mezzogiorno'],
  '友': ['amico'],
  '父': ['padre'],
  '北': ['nord'],
  '半': ['metà', 'mezzo'],
  '外': ['fuori', 'esterno'],
  '母': ['madre'],
  '休': ['riposo', 'riposare'],
  '先': ['prima', 'precedente', 'avanti'],
  '名': ['nome', 'fama'],
  '年': ['anno'],
  '気': ['spirito', 'energia', 'umore'],
  '百': ['cento'],
  '男': ['maschio', 'uomo'],
  '見': ['vedere', 'guardare'],
  '車': ['automobile', 'veicolo'],
  '毎': ['ogni'],
  '行': ['andare', 'viaggio', 'fila'],
  '西': ['ovest'],
  '何': ['cosa', 'che'],
  '来': ['venire', 'prossimo'],
  '学': ['studio', 'imparare'],
  '金': ['oro', 'denaro'],
  '雨': ['pioggia'],
  '国': ['paese', 'nazione'],
  '東': ['est'],
  '長': ['lungo', 'capo'],
  '前': ['davanti', 'prima'],
  '南': ['sud'],
  '後': ['dietro', 'dopo'],
  '食': ['mangiare', 'cibo'],
  '校': ['scuola'],
  '時': ['tempo', 'ora'],
  '高': ['alto', 'costoso'],
  '間': ['intervallo', 'spazio'],
  '話': ['discorso', 'parlare', 'storia'],
  '電': ['elettricità'],
  '聞': ['sentire', 'ascoltare', 'chiedere'],
  '語': ['parola', 'lingua'],
  '読': ['leggere'],
  '生': ['vita', 'nascere'],
  '書': ['scrivere'],
};

// ─────────────────────────────────────────────
// Utility di normalizzazione delle letture 
// ─────────────────────────────────────────────

/** hiragana → katakana (offset Unicode fisso di 0x60 nel blocco 0x3041–0x3096). */
const hiraganaAKatakana = (str) =>
  Array.from(str)
    .map((ch) => {
      const c = ch.codePointAt(0);
      return c >= 0x3041 && c <= 0x3096 ? String.fromCodePoint(c + 0x60) : ch;
    })
    .join('');

/**
 * Normalizza una lettura KANJIDIC2 rimuovendo i marcatori:
 *   - i trattini di prefisso/suffisso ('-び' → 'び', 'ひと-' → 'ひと');
 *   - l'okurigana dopo il punto ('ひと.つ' → 'ひと').
 * Restituisce la parte "core" della lettura, o '' se vuota.
 */
const normalizzaLettura = (lettura) => {
  const senzaTrattini = lettura.replace(/-/g, '');
  const primaDelPunto = senzaTrattini.split('.')[0];
  return primaDelPunto.trim();
};

/** Deduplica preservando l'ordine. */
const dedup = (arr) => Array.from(new Set(arr));

/** on'yomi → katakana normalizzato (convenzione KANJIDIC2). */
const normalizzaOnYomi = (letture) =>
  dedup(
    (letture || [])
      .map(normalizzaLettura)
      .filter(Boolean)
      .map(hiraganaAKatakana)
  );

/** kun'yomi → hiragana normalizzato (core, senza okurigana). */
const normalizzaKunYomi = (letture) =>
  dedup((letture || []).map(normalizzaLettura).filter(Boolean));

/**
 * Ripulisce i significati EN dalle note di dizionario dei radicali
 * (es. "One Radical (no.1)", "River ... Radical (no. 47)"), che sono metadati
 * KANJIDIC2 e non glosse utili in un quiz. Non altera i significati veri.
 */
const pulisciSignificatiEn = (significati) =>
  (significati || []).filter((m) => !/radical\s*\(no/i.test(m));

// ─────────────────────────────────────────────
// Download del dataset sorgente
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Costruzione di una voce del dataset del progetto
// ─────────────────────────────────────────────
const costruisciVoce = (kanji, dati) => {
  const livello = LIVELLO_DA_JLPT_NEW[dati.jlpt_new];
  const en = pulisciSignificatiEn(dati.meanings);
  const it = GLOSSE_IT_N5[kanji] || []; // curato solo per l'N5; altrimenti vuoto

  return {
    ideogramma: kanji,
    onYomi: normalizzaOnYomi(dati.readings_on),
    kunYomi: normalizzaKunYomi(dati.readings_kun),
    significati: { it, en },
    livello_jlpt: livello,
    tratti: typeof dati.strokes === 'number' ? dati.strokes : null,
  };
};

const ordinaPerFrequenza = (voci, sorgente) =>
  voci.sort((a, b) => {
    // I più frequenti prima (freq bassa = più comune); i privi di freq in coda.
    const fa = sorgente[a.ideogramma].freq ?? Number.MAX_SAFE_INTEGER;
    const fb = sorgente[b.ideogramma].freq ?? Number.MAX_SAFE_INTEGER;
    return fa - fb;
  });

const main = async () => {
  const livelliRichiesti = process.argv.slice(2).map((s) => s.toUpperCase());
  const filtroLivelli =
    livelliRichiesti.length > 0 ? new Set(livelliRichiesti) : null;

  // eslint-disable-next-line no-console
  console.log(`Scarico il dataset sorgente da ${SORGENTE_URL} ...`);
  const sorgente = JSON.parse(await scarica(SORGENTE_URL));

  // Raggruppa per livello JLPT.
  const perLivello = { N5: [], N4: [], N3: [], N2: [], N1: [] };
  for (const [kanji, dati] of Object.entries(sorgente)) {
    const livello = LIVELLO_DA_JLPT_NEW[dati.jlpt_new];
    if (!livello) continue; // niente jlpt_new ⇒ fuori dal Quiz
    if (filtroLivelli && !filtroLivelli.has(livello)) continue;
    perLivello[livello].push(costruisciVoce(kanji, dati));
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });

  for (const livello of Object.keys(perLivello)) {
    const voci = perLivello[livello];
    if (voci.length === 0) continue;
    ordinaPerFrequenza(voci, sorgente);

    const payload = {
      livello,
      licenza: LICENZA,
      totale: voci.length,
      kanji: voci,
    };
    const dest = path.join(DEST_DIR, `${livello.toLowerCase()}.json`);
    fs.writeFileSync(dest, JSON.stringify(payload, null, 2));
    const conIt = voci.filter((v) => v.significati.it.length > 0).length;
    // eslint-disable-next-line no-console
    console.log(`  ${livello}: ${voci.length} kanji (con glossa IT: ${conIt}) → ${dest}`);
  }

  // eslint-disable-next-line no-console
  console.log('Fatto.');
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
