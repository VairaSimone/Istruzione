'use strict';

/**
 * Dizionari canonici dei kana (hiragana / katakana) + utilità di filtraggio.
 *
 * Questa è la FONTE DI VERITÀ unica del backend per il Quiz Kana: la logica
 * di selezione dei caratteri (SRS) e la validazione delle risposte si basano
 * esclusivamente su questi dati.
 *

 */

// ─────────────────────────────────────────────
// Gojūon di base, raggruppato per "riga"
// ─────────────────────────────────────────────
const HIRAGANA_BASE = {
  vowels: { 'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o' },
  k: { 'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko' },
  s: { 'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so' },
  t: { 'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to' },
  n: { 'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no' },
  h: { 'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho' },
  m: { 'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo' },
  y: { 'や': 'ya', 'ゆ': 'yu', 'よ': 'yo' },
  r: { 'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro' },
  w: { 'わ': 'wa', 'を': 'wo', 'ん': 'n' },
};

const KATAKANA_BASE = {
  vowels: { 'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o' },
  k: { 'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko' },
  s: { 'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so' },
  t: { 'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to' },
  n: { 'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no' },
  h: { 'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho' },
  m: { 'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo' },
  y: { 'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo' },
  r: { 'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro' },
  w: { 'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n' },
};

// ─────────────────────────────────────────────
// Dakuon / handakuon, raggruppato per riga di origine
//   k → が..  ·  s → ざ..  ·  t → だ..  ·  h → ば../ぱ..
// ─────────────────────────────────────────────
const HIRAGANA_DAKUON = {
  k: { 'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go' },
  s: { 'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo' },
  t: { 'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do' },
  h: {
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  },
};

const KATAKANA_DAKUON = {
  k: { 'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go' },
  s: { 'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo' },
  t: { 'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do' },
  h: {
    'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
    'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  },
};

// ─────────────────────────────────────────────
// Yōon (composti), raggruppato per riga di origine
// ─────────────────────────────────────────────
const HIRAGANA_YOON = {
  k: { 'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo', 'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo' },
  s: { 'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho', 'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo' },
  t: { 'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho' },
  n: { 'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo' },
  h: {
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  },
  m: { 'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo' },
  r: { 'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo' },
};

const KATAKANA_YOON = {
  k: { 'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo', 'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo' },
  s: { 'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho', 'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo' },
  t: { 'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho' },
  n: { 'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo' },
  h: {
    'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
    'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
    'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
  },
  m: { 'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo' },
  r: { 'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo' },
};

// ─────────────────────────────────────────────
// Costanti pubbliche
// ─────────────────────────────────────────────
const ALFABETI = ['hiragana', 'katakana'];
const CATEGORIE = ['base', 'dakuon', 'yoon'];

const SORGENTI = {
  hiragana: { base: HIRAGANA_BASE, dakuon: HIRAGANA_DAKUON, yoon: HIRAGANA_YOON },
  katakana: { base: KATAKANA_BASE, dakuon: KATAKANA_DAKUON, yoon: KATAKANA_YOON },
};

// ─────────────────────────────────────────────
// Indice piatto: una entry per ogni kana, con gruppo e categoria espliciti.
// È la struttura su cui opera il filtraggio del quiz.
//   { kana, romaji, tipo, gruppo, categoria }
// ─────────────────────────────────────────────
const INDICE_KANA = [];
for (const alfabeto of ALFABETI) {
  for (const categoria of CATEGORIE) {
    const perGruppo = SORGENTI[alfabeto][categoria];
    for (const gruppo of Object.keys(perGruppo)) {
      for (const [kana, romaji] of Object.entries(perGruppo[gruppo])) {
        INDICE_KANA.push({ kana, romaji, tipo: alfabeto, gruppo, categoria });
      }
    }
  }
}

// Lookup O(1) per validazione/risoluzione romaji: chiave `${tipo}:${kana}`.
const MAPPA_LOOKUP = new Map();
for (const entry of INDICE_KANA) {
  MAPPA_LOOKUP.set(`${entry.tipo}:${entry.kana}`, entry);
}

// ─────────────────────────────────────────────
// Compatibilità: ricostruisce le strutture in stile frontend
//   kanaData    → { hiragana: { ...base, _dakuon, _yoon }, katakana: {...} }
//   groupsMapping → { vowels: [...], k: [...], ... } (solo caratteri base)
// Derivate dalla fonte di verità, così non possono divergere.
// ─────────────────────────────────────────────
const kanaData = (() => {
  const out = {};
  for (const alfabeto of ALFABETI) {
    const base = {};
    for (const gruppo of Object.keys(SORGENTI[alfabeto].base)) {
      Object.assign(base, SORGENTI[alfabeto].base[gruppo]);
    }
    const _dakuon = {};
    for (const gruppo of Object.keys(SORGENTI[alfabeto].dakuon)) {
      Object.assign(_dakuon, SORGENTI[alfabeto].dakuon[gruppo]);
    }
    const _yoon = {};
    for (const gruppo of Object.keys(SORGENTI[alfabeto].yoon)) {
      Object.assign(_yoon, SORGENTI[alfabeto].yoon[gruppo]);
    }
    out[alfabeto] = { ...base, _dakuon, _yoon };
  }
  return out;
})();

const groupsMapping = (() => {
  const map = {};
  for (const alfabeto of ALFABETI) {
    for (const gruppo of Object.keys(SORGENTI[alfabeto].base)) {
      if (!map[gruppo]) map[gruppo] = [];
      map[gruppo].push(...Object.keys(SORGENTI[alfabeto].base[gruppo]));
    }
  }
  return map;
})();

const GRUPPI_VALIDI = Object.keys(groupsMapping); // ['vowels','k','s','t','n','h','m','y','r','w']

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Restituisce la entry canonica di un kana, o `null` se non esiste.
 * Usato per validare in modo difensivo le risposte inviate dal client.
 */
const trovaKana = (kana, tipo) => MAPPA_LOOKUP.get(`${tipo}:${kana}`) || null;

/**
 * Filtra i kana in base alle impostazioni di gioco.
 *
 * @param {Object}   opts
 * @param {string}   opts.alfabeto       'hiragana' | 'katakana'
 * @param {string[]} [opts.gruppi]       righe selezionate; vuoto/omesso ⇒ tutte
 * @param {boolean}  [opts.includiDakuon=true]
 * @param {boolean}  [opts.includiYoon=true]
 * @returns {Array<{kana:string, romaji:string, tipo:string}>}
 */
const filtraKana = ({ alfabeto, gruppi, includiDakuon = true, includiYoon = true }) => {
  // Gruppi vuoti/omessi ⇒ tutte le righe (coerente col comportamento frontend).
  const gruppiAttivi =
    Array.isArray(gruppi) && gruppi.length > 0
      ? new Set(gruppi)
      : new Set(GRUPPI_VALIDI);

  return INDICE_KANA
    .filter((e) => e.tipo === alfabeto)
    .filter((e) => gruppiAttivi.has(e.gruppo))
    .filter((e) => {
      if (e.categoria === 'dakuon') return includiDakuon;
      if (e.categoria === 'yoon') return includiYoon;
      return true; // base sempre incluso
    })
    .map((e) => ({ kana: e.kana, romaji: e.romaji, tipo: e.tipo }));
};

module.exports = {
  ALFABETI,
  CATEGORIE,
  GRUPPI_VALIDI,
  INDICE_KANA,
  kanaData,
  groupsMapping,
  trovaKana,
  filtraKana,
};
