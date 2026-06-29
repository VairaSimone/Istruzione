'use strict';

/**
 * Catalogo dei BADGE / OBIETTIVI + costanti XP per le sorgenti non-quiz.
 *
 * Questo file è la FONTE DI VERITÀ unica del backend per la gamification a
 * obiettivi. Espone SOLO codici stabili e machine-readable (es. `STREAK_7`,
 * `MAESTRO_HIRAGANA`): il testo visualizzato (nome + descrizione localizzati,
 * eventuale icona) vive nel frontend (i18n), coerentemente con la convenzione
 * del progetto «codici stabili lato backend, testo di visualizzazione lato
 * frontend».
 *
 * Ogni badge definisce:
 *   - `code`      : identificatore stabile (mai cambiarlo: è persistito);
 *   - `categoria` : raggruppamento UI ('streak' | 'livello' | 'quiz' |
 *                   'maestria' | 'scrittura' | 'sblocco');
 *   - `criterio`  : funzione pura (snapshot) => boolean. Riceve lo snapshot
 *                   aggregato costruito da `gamificationService` e NON deve
 *                   avere effetti collaterali.
 *
 * Lo sblocco è monotòno e idempotente: una volta ottenuto, un badge resta
 * acquisito anche se in seguito il criterio non fosse più soddisfatto (es. la
 * streak si azzera). L'idempotenza è garantita dalla tabella `badge_utente`
 * (unique utente_id + badge_code).
 */

const { INDICE_KANA } = require('./kanaData');

// ─────────────────────────────────────────────
// Costanti XP — sorgenti diverse dal quiz
// ─────────────────────────────────────────────

// XP per ogni tratto validato sul canvas di scrittura.
const XP_PER_TRATTO = 2;

// XP una-tantum per ogni nuova riga base di kana portata interamente al
// livello SRS massimo ("sblocco" della riga). Conteggio monotòno: gli XP
// vengono assegnati una sola volta per riga grazie al contatore persistito
// `utenti.righe_sbloccate`.
const XP_PER_RIGA_SBLOCCATA = 50;

// ─────────────────────────────────────────────
// Strutture derivate dalla fonte di verità dei kana
// ─────────────────────────────────────────────

// Numero totale di caratteri per alfabeto (base + dakuon + yoon).
// Usato dai badge "Maestro" (tutti i caratteri al punteggio massimo).
const TOTALE_PER_ALFABETO = INDICE_KANA.reduce((acc, e) => {
  acc[e.tipo] = (acc[e.tipo] || 0) + 1;
  return acc;
}, {});

// Righe BASE (gojūon) per alfabeto: ogni voce è l'insieme dei caratteri di una
// riga, nella forma di chiavi `${tipo}:${kana}` per il confronto O(1) con
// l'insieme dei kana padroneggiati. Solo la categoria 'base' concorre allo
// "sblocco riga" (dakuon/yoon sono varianti, non righe a sé).
const RIGHE_BASE = (() => {
  const perChiave = new Map(); // `${tipo}:${gruppo}` → string[]
  for (const e of INDICE_KANA) {
    if (e.categoria !== 'base') continue;
    const chiave = `${e.tipo}:${e.gruppo}`;
    if (!perChiave.has(chiave)) perChiave.set(chiave, []);
    perChiave.get(chiave).push(`${e.tipo}:${e.kana}`);
  }
  return Array.from(perChiave.entries()).map(([chiave, membri]) => {
    const [tipo, gruppo] = chiave.split(':');
    return { tipo, gruppo, membri };
  });
})();

// Numero totale di righe base sbloccabili (per la UI: progresso "Esploratore").
const TOTALE_RIGHE_BASE = RIGHE_BASE.length;

// ─────────────────────────────────────────────
// Catalogo dei badge
// ─────────────────────────────────────────────
const BADGES = [
  // — Costanza (streak) —
  { code: 'STREAK_3', categoria: 'streak', criterio: (s) => s.streak >= 3 },
  { code: 'STREAK_7', categoria: 'streak', criterio: (s) => s.streak >= 7 },
  { code: 'STREAK_30', categoria: 'streak', criterio: (s) => s.streak >= 30 },

  // — Livello / esperienza —
  { code: 'LIVELLO_5', categoria: 'livello', criterio: (s) => s.livello >= 5 },
  { code: 'LIVELLO_10', categoria: 'livello', criterio: (s) => s.livello >= 10 },

  // — Quiz —
  { code: 'PRIMO_QUIZ', categoria: 'quiz', criterio: (s) => s.quizCompletati >= 1 },
  { code: 'QUIZ_50', categoria: 'quiz', criterio: (s) => s.quizCompletati >= 50 },
  { code: 'PERFEZIONISTA', categoria: 'quiz', criterio: (s) => s.punteggioRecord >= 100 },

  // — Maestria SRS —
  {
    code: 'MAESTRO_HIRAGANA',
    categoria: 'maestria',
    criterio: (s) => s.totaleHiragana > 0 && s.masteredHiragana >= s.totaleHiragana,
  },
  {
    code: 'MAESTRO_KATAKANA',
    categoria: 'maestria',
    criterio: (s) => s.totaleKatakana > 0 && s.masteredKatakana >= s.totaleKatakana,
  },

  // — Scrittura su canvas —
  { code: 'PRIMI_TRATTI', categoria: 'scrittura', criterio: (s) => s.trattiValidati >= 10 },
  {
    code: 'SCRITTORE_INSTANCABILE',
    categoria: 'scrittura',
    criterio: (s) => s.trattiValidati >= 50,
  },

  // — Sblocco righe —
  { code: 'ESPLORATORE', categoria: 'sblocco', criterio: (s) => s.righeSbloccate >= 5 },
];

// Insieme dei codici validi (per validazione/coerenza).
const CODICI_BADGE = BADGES.map((b) => b.code);

module.exports = {
  XP_PER_TRATTO,
  XP_PER_RIGA_SBLOCCATA,
  TOTALE_PER_ALFABETO,
  TOTALE_RIGHE_BASE,
  RIGHE_BASE,
  BADGES,
  CODICI_BADGE,
};
