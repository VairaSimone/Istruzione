'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const ProgressoKana = require('../models/ProgressoKana');
const ProgressoKanji = require('../models/ProgressoKanji');
const AttivitaGiornaliera = require('../models/AttivitaGiornaliera');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { filtraKana, trovaKana, ALFABETI } = require('../constants/kanaData');
const {
  filtraKanji,
  trovaKanji,
  livelloValido,
  significatiPerLingua,
  LIVELLI_JLPT,
  LICENZA_KANJI,
} = require('../constants/kanjiData');
const { calcolaLivello, infoLivello, serializzaStatistiche } = require('../utils/gameStats');
const { mezzanotteOdiernaUTC, formattaDataOnly, differenzaGiorni } = require('../utils/dateUtils');
const gamificationService = require('./gamificationService');

/**
 * QuizService — logica di business del Quiz (Kana + Kanji).
 *
 *   generateQuizPool  → selezione SRS ibrida dei caratteri per una partita
 *   submitQuizResults → elaborazione dell'esito (SRS, XP, streak, record)
 *   getDashboard      → statistiche aggregate per la home
 *
 * Il dominio ('kana' | 'kanji') seleziona la sorgente dei caratteri e la tabella
 * SRS; TUTTA la logica utente (XP, streak, record, badge, heatmap) è condivisa
 * tramite `applicaEsitoRound`, così Kanji è un'ESTENSIONE e non una duplicazione
 * del sistema Kana, che resta invariato (dominio di default = 'kana').
 */

// ─────────────────────────────────────────────
// Costanti di gioco
// ─────────────────────────────────────────────
const DIMENSIONE_QUIZ = 20;          // massimo numero di caratteri per partita
const SOGLIA_SRS_DIFFICILE = 3;      // punteggio < 3 ⇒ "da rivedere"
const PUNTEGGIO_SRS_DEFAULT = ProgressoKana.PUNTEGGIO_DEFAULT; // 3
const PUNTEGGIO_SRS_MIN = ProgressoKana.PUNTEGGIO_MIN;         // 0
const PUNTEGGIO_SRS_MAX = ProgressoKana.PUNTEGGIO_MAX;         // 5

// Variazione del punteggio SRS per risposta.
const SRS_DELTA_CORRETTA = 1;        // +1 (cap a 5)
const SRS_DELTA_ERRATA = 2;          // -2 (floor a 0)

// XP per risposta corretta (la modalità a tempo dà un premio extra).
const XP_PER_CORRETTA = 10;
const XP_PER_CORRETTA_TIMER = 15;

// Combo: a partire da COMBO_SOGLIA risposte consecutive gli XP raddoppiano.
const COMBO_SOGLIA = 5;

// Bonus di fine partita in base alla percentuale.
const SOGLIA_PERCENTUALE_ALTA = 80;
const BONUS_PERCENTUALE_PERFETTO = 100; // a 100%
const BONUS_PERCENTUALE_ALTO = 50;      // a >= 80%

// Numero di "caratteri critici" restituiti dalla dashboard.
const LIMITE_PEGGIORI_KANA = 12;

// Domini e tipologie di quiz supportati.
const DOMINI = ['kana', 'kanji'];
const TIPI_QUIZ_KANJI = ['production', 'recognition', 'reading'];
const OPZIONI_PER_DOMANDA = 4;       // quiz a scelta multipla (recognition/reading)

// ─────────────────────────────────────────────
// Helper — mescolamento (Fisher-Yates, non distorto)
// ─────────────────────────────────────────────
const mescola = (arr) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─────────────────────────────────────────────
// ADATTATORI DI DOMINIO
// Isolano le uniche differenze tra Kana e Kanji per il motore SRS:
//   - la tabella dei progressi;
//   - il nome della colonna del carattere;
//   - la colonna secondaria (tipo alfabeto vs livello JLPT);
//   - la validazione della risposta contro il dizionario canonico.
// Tutto il resto (partizione difficili/facili, delta SRS, upsert) è comune.
// ─────────────────────────────────────────────
const ADATTATORI = {
  kana: {
    model: ProgressoKana,
    colonnaCarattere: 'kana',
    // Normalizza+valida una risposta del client. Ritorna la forma interna
    // { carattere, secondaria:{tipo}, corretto } oppure null se non valida.
    normalizzaRisposta: (r) => {
      const tipo = r && r.tipo;
      const kana = r && typeof r.kana === 'string' ? r.kana.trim() : '';
      if (!trovaKana(kana, tipo)) return null;
      return { carattere: kana, secondaria: { tipo }, corretto: r.corretto === true };
    },
  },
  kanji: {
    model: ProgressoKanji,
    colonnaCarattere: 'kanji',
    normalizzaRisposta: (r) => {
      const livello = r && r.livelloJLPT;
      const kanji = r && typeof r.kanji === 'string' ? r.kanji.trim() : '';
      if (!trovaKanji(kanji, livello)) return null;
      return { carattere: kanji, secondaria: { livello_jlpt: livello }, corretto: r.corretto === true };
    },
  },
};

// ─────────────────────────────────────────────
// SELEZIONE SRS IBRIDA (comune ai due domini)
// Dato l'elenco dei caratteri candidati (ognuno con la propria colonna
// secondaria) e i punteggi SRS esistenti, pesca prima i "difficili"
// (punteggio < 3) poi riempie con i "facili", fino a DIMENSIONE_QUIZ.
// ─────────────────────────────────────────────
const selezionaConSrs = (candidati, punteggioPerCarattere) => {
  const difficili = [];
  const facili = [];
  for (const c of candidati) {
    const punteggio = punteggioPerCarattere.has(c.carattere)
      ? punteggioPerCarattere.get(c.carattere)
      : PUNTEGGIO_SRS_DEFAULT;
    const entry = { ...c, punteggio };
    if (punteggio < SOGLIA_SRS_DIFFICILE) difficili.push(entry);
    else facili.push(entry);
  }
  mescola(difficili);
  mescola(facili);
  const selezione = [...difficili, ...facili].slice(0, DIMENSIONE_QUIZ);
  return mescola(selezione);
};

// ═════════════════════════════════════════════
// GENERAZIONE POOL — KANA (comportamento invariato)
// ═════════════════════════════════════════════
const generateKanaQuizPool = async (userId, filtri = {}) => {
  const { alfabeto, gruppi = [], includiDakuon = true, includiYoon = true } = filtri;

  if (!ALFABETI.includes(alfabeto)) {
    throw new AppError('Alfabeto non valido. Usa "hiragana" o "katakana".', 422, 'INVALID_ALPHABET');
  }

  // 1. Candidati in base ai filtri di gioco.
  const kanaCandidati = filtraKana({ alfabeto, gruppi, includiDakuon, includiYoon });
  if (kanaCandidati.length === 0) {
    throw new AppError('Nessun kana corrisponde ai filtri selezionati.', 422, 'EMPTY_QUIZ_POOL');
  }

  // 2. Punteggi SRS attuali dell'utente per i soli candidati.
  const listaKana = kanaCandidati.map((c) => c.kana);
  const progressi = await ProgressoKana.findAll({
    where: { utente_id: userId, tipo: alfabeto, kana: { [Op.in]: listaKana } },
    attributes: ['kana', 'punteggio'],
  });
  const punteggioPerCarattere = new Map(progressi.map((p) => [p.kana, p.punteggio]));

  // 3. Selezione SRS ibrida (normalizza al campo comune `carattere`).
  const candidati = kanaCandidati.map((c) => ({ ...c, carattere: c.kana }));
  const selezione = selezionaConSrs(candidati, punteggioPerCarattere);

  return {
    dominio: 'kana',
    alfabeto,
    totale: selezione.length,
    kana: selezione.map((k) => ({
      kana: k.kana,
      romaji: k.romaji,
      tipo: k.tipo,
      punteggio: k.punteggio,
    })),
  };
};

// ═════════════════════════════════════════════
// GENERAZIONE POOL — KANJI
// ═════════════════════════════════════════════

/** Campiona fino a `n` valori distinti da `pool`, escludendo `vietati`. */
const campionaDistinti = (pool, vietati, n) => {
  const disponibili = mescola(
    Array.from(new Set(pool)).filter((v) => v && !vietati.has(v))
  );
  return disponibili.slice(0, n);
};

/**
 * Costruisce la domanda di una singola voce kanji secondo la tipologia.
 * Il backend PREPARA i dati (incluso l'indice della risposta corretta); la
 * resa e la logica di gioco restano al frontend.
 *
 * @param {object} entry    voce kanji (con `punteggio` aggiunto dalla selezione)
 * @param {string} tipoQuiz 'production' | 'recognition' | 'reading'
 * @param {string} lingua   'it' | 'en' (per i significati; fallback interno EN)
 * @param {object} pool     { significati:string[], on:string[], kun:string[] }
 */
const costruisciDomandaKanji = (entry, tipoQuiz, lingua, pool) => {
  const base = { ideogramma: entry.ideogramma, punteggio: entry.punteggio };

  if (tipoQuiz === 'production') {
    // Restituisce il kanji da SCRIVERE + i riferimenti (letture/significati).
    // I dati grafici dei tratti si ottengono dall'endpoint stroke dedicato.
    return {
      ...base,
      onYomi: entry.onYomi,
      kunYomi: entry.kunYomi,
      significati: significatiPerLingua(entry, lingua),
      tratti: entry.tratti,
    };
  }

  if (tipoQuiz === 'recognition') {
    // Kanji → quattro SIGNIFICATI, uno solo corretto.
    const significatiEntry = significatiPerLingua(entry, lingua);
    const corretto = significatiEntry[0];
    const vietati = new Set(significatiEntry); // evita distrattori sinonimi
    const distrattori = campionaDistinti(pool.significati, vietati, OPZIONI_PER_DOMANDA - 1);
    const opzioni = mescola([corretto, ...distrattori]);
    return {
      ...base,
      opzioni,
      indiceCorretto: opzioni.indexOf(corretto),
    };
  }

  // reading — Kanji + contesto (tipo di lettura) → quattro LETTURE, una corretta.
  // Sceglie un tipo di lettura effettivamente disponibile per questo kanji.
  const tipiDisponibili = [];
  if (entry.onYomi.length > 0) tipiDisponibili.push('onYomi');
  if (entry.kunYomi.length > 0) tipiDisponibili.push('kunYomi');
  const tipoLettura = tipiDisponibili[Math.floor(Math.random() * tipiDisponibili.length)];

  const lettureEntry = entry[tipoLettura];
  const corretto = lettureEntry[Math.floor(Math.random() * lettureEntry.length)];
  const vietati = new Set(lettureEntry);
  const poolLetture = tipoLettura === 'onYomi' ? pool.on : pool.kun;
  const distrattori = campionaDistinti(poolLetture, vietati, OPZIONI_PER_DOMANDA - 1);
  const opzioni = mescola([corretto, ...distrattori]);
  return {
    ...base,
    contesto: { tipoLettura }, // il frontend rende "leggi in on'yomi/kun'yomi"
    opzioni,
    indiceCorretto: opzioni.indexOf(corretto),
  };
};

const generateKanjiQuizPool = async (userId, filtri = {}) => {
  const { livello, tipoQuiz = 'recognition', lingua = 'it' } = filtri;

  if (!livelloValido(livello)) {
    throw new AppError(
      `Livello JLPT non valido o non disponibile. Usa uno di: ${LIVELLI_JLPT.join(', ')}.`,
      422,
      'INVALID_JLPT_LEVEL'
    );
  }
  if (!TIPI_QUIZ_KANJI.includes(tipoQuiz)) {
    throw new AppError(
      `Tipo di quiz non valido. Usa uno di: ${TIPI_QUIZ_KANJI.join(', ')}.`,
      422,
      'INVALID_QUIZ_TYPE'
    );
  }

  // 1. Candidati del livello.
  const kanjiCandidati = filtraKanji({ livello });
  if (kanjiCandidati.length === 0) {
    throw new AppError('Nessun kanji disponibile per il livello selezionato.', 422, 'EMPTY_QUIZ_POOL');
  }

  // 2. Punteggi SRS attuali dell'utente per i kanji del livello.
  const listaKanji = kanjiCandidati.map((c) => c.ideogramma);
  const progressi = await ProgressoKanji.findAll({
    where: { utente_id: userId, kanji: { [Op.in]: listaKanji } },
    attributes: ['kanji', 'punteggio'],
  });
  const punteggioPerCarattere = new Map(progressi.map((p) => [p.kanji, p.punteggio]));

  // 3. Selezione SRS ibrida (campo comune `carattere` = ideogramma).
  const candidati = kanjiCandidati.map((c) => ({ ...c, carattere: c.ideogramma }));
  const selezione = selezionaConSrs(candidati, punteggioPerCarattere);

  // 4. Pool di distrattori derivati dall'INTERO livello (non dalla sola
  //    selezione), per domande a scelta multipla più varie.
  const pool = {
    significati: kanjiCandidati.map((c) => significatiPerLingua(c, lingua)[0]).filter(Boolean),
    on: kanjiCandidati.flatMap((c) => c.onYomi),
    kun: kanjiCandidati.flatMap((c) => c.kunYomi),
  };

  return {
    dominio: 'kanji',
    livello,
    tipoQuiz,
    lingua,
    totale: selezione.length,
    licenza: LICENZA_KANJI,
    kanji: selezione.map((entry) => costruisciDomandaKanji(entry, tipoQuiz, lingua, pool)),
  };
};

// ─────────────────────────────────────────────
// GENERAZIONE POOL — dispatcher per dominio
// ─────────────────────────────────────────────
const generateQuizPool = async (userId, filtri = {}) => {
  const dominio = filtri.dominio || 'kana';
  if (!DOMINI.includes(dominio)) {
    throw new AppError(`Dominio non valido. Usa uno di: ${DOMINI.join(', ')}.`, 422, 'INVALID_DOMAIN');
  }
  return dominio === 'kanji'
    ? generateKanjiQuizPool(userId, filtri)
    : generateKanaQuizPool(userId, filtri);
};

// ─────────────────────────────────────────────
// CALCOLO XP DEL ROUND (comune ai due domini)
// ─────────────────────────────────────────────
const calcolaXpRound = ({ corrette, percentuale, maxCombo, timerMode }) => {
  const xpBase = timerMode ? XP_PER_CORRETTA_TIMER : XP_PER_CORRETTA;
  const xpRisposte = corrette * xpBase;

  const bonusCombo =
    maxCombo >= COMBO_SOGLIA ? (maxCombo - (COMBO_SOGLIA - 1)) * xpBase : 0;

  let bonusPercentuale = 0;
  if (percentuale === 100) bonusPercentuale = BONUS_PERCENTUALE_PERFETTO;
  else if (percentuale >= SOGLIA_PERCENTUALE_ALTA) bonusPercentuale = BONUS_PERCENTUALE_ALTO;

  return {
    xpGuadagnati: xpRisposte + bonusCombo + bonusPercentuale,
    xpRisposte,
    bonusCombo,
    bonusPercentuale,
  };
};

// ─────────────────────────────────────────────
// AGGIORNAMENTO STREAK (logica di continuità)
// ─────────────────────────────────────────────
const calcolaNuovaStreak = (streakAttuale, ultimaDataStudio, oggi) => {
  if (!ultimaDataStudio) {
    return 1; // primo studio in assoluto
  }
  const diff = differenzaGiorni(ultimaDataStudio, oggi);
  if (diff <= 0) {
    return Math.max(1, streakAttuale || 0);
  }
  if (diff === 1) {
    return (streakAttuale || 0) + 1;
  }
  return 1;
};

// ─────────────────────────────────────────────
// NORMALIZZAZIONE RISPOSTE (comune, via adattatore)
// De-duplica per (secondaria, carattere): un carattere è unico in un round; se
// arrivasse duplicato, una singola occorrenza errata lo marca errato.
// I caratteri sconosciuti vengono ignorati (anti-manipolazione del client).
// ─────────────────────────────────────────────
const normalizzaRisposte = (risposte, adattatore) => {
  const perChiave = new Map();
  for (const r of risposte) {
    const norm = adattatore.normalizzaRisposta(r);
    if (!norm) continue;

    const secondaria = Object.values(norm.secondaria).join('|');
    const chiave = `${secondaria}:${norm.carattere}`;
    if (perChiave.has(chiave)) {
      const prec = perChiave.get(chiave);
      prec.corretto = prec.corretto && norm.corretto;
    } else {
      perChiave.set(chiave, norm);
    }
  }
  return Array.from(perChiave.values());
};

// ─────────────────────────────────────────────
// APPLICAZIONE SRS DEL ROUND (comune, via adattatore)
// Upsert massivo (una query): +1 se corretto (cap 5), -2 se errato (floor 0).
// `errori_tratti` NON è toccato (lo aggiorna la scrittura su canvas) e resta
// fuori da `updateOnDuplicate` per preservarlo.
// ─────────────────────────────────────────────
const applicaSrsRound = async (adattatore, userId, normalizzate, t) => {
  const { model, colonnaCarattere } = adattatore;
  const caratteri = normalizzate.map((r) => r.carattere);

  const esistenti = await model.findAll({
    where: { utente_id: userId, [colonnaCarattere]: { [Op.in]: caratteri } },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  const mappaEsistenti = new Map(
    esistenti.map((p) => [
      p[colonnaCarattere],
      { punteggio: p.punteggio, tentativi: p.tentativi, errori: p.errori },
    ])
  );

  const righeUpsert = normalizzate.map((r) => {
    const attuale = mappaEsistenti.get(r.carattere) || {
      punteggio: PUNTEGGIO_SRS_DEFAULT,
      tentativi: 0,
      errori: 0,
    };
    const nuovoPunteggio = r.corretto
      ? Math.min(PUNTEGGIO_SRS_MAX, attuale.punteggio + SRS_DELTA_CORRETTA)
      : Math.max(PUNTEGGIO_SRS_MIN, attuale.punteggio - SRS_DELTA_ERRATA);
    return {
      utente_id: userId,
      [colonnaCarattere]: r.carattere,
      ...r.secondaria, // { tipo } per i kana · { livello_jlpt } per i kanji
      punteggio: nuovoPunteggio,
      tentativi: attuale.tentativi + 1,
      errori: attuale.errori + (r.corretto ? 0 : 1),
    };
  });

  await model.bulkCreate(righeUpsert, {
    updateOnDuplicate: ['punteggio', 'tentativi', 'errori', 'updated_at'],
    transaction: t,
  });
};

// ─────────────────────────────────────────────
// APPLICAZIONE ESITO A LIVELLO UTENTE (comune ai due domini)
// XP + streak + record + contatore quiz + badge + heatmap, sulla stessa
// transazione. Muta l'istanza `utente` ma NON la salva (lo fa il chiamante).
// ─────────────────────────────────────────────
const applicaEsitoRound = async (utente, { totale, corrette, percentuale, xpGuadagnati }, t) => {
  const xpIniziale = utente.xp || 0;
  utente.xp = xpIniziale + xpGuadagnati;

  const oggi = mezzanotteOdiernaUTC();
  utente.streak = calcolaNuovaStreak(utente.streak, utente.ultima_data_studio, oggi);
  utente.ultima_data_studio = formattaDataOnly(oggi);
  if (utente.streak > (utente.streak_record || 0)) {
    utente.streak_record = utente.streak;
  }

  if (percentuale > (utente.punteggio_record || 0)) {
    utente.punteggio_record = percentuale;
  }

  utente.quiz_completati = (utente.quiz_completati || 0) + 1;

  const valutazione = await gamificationService.valutaProgressi(utente, t);

  await AttivitaGiornaliera.registra(
    utente.id,
    {
      quizCompletati: 1,
      risposteTotali: totale,
      risposteCorrette: corrette,
      xpGuadagnati: xpGuadagnati + (valutazione.xpRighe || 0),
    },
    t
  );

  return { xpIniziale, valutazione };
};

// ─────────────────────────────────────────────
// INVIO RISULTATI PARTITA (dispatcher per dominio)
// Tutto in transazione: progressi SRS + statistiche utente atomicamente.
// ─────────────────────────────────────────────
const submitQuizResults = async (userId, risposte, datiBonus = {}, dominio = 'kana') => {
  if (!DOMINI.includes(dominio)) {
    throw new AppError(`Dominio non valido. Usa uno di: ${DOMINI.join(', ')}.`, 422, 'INVALID_DOMAIN');
  }
  if (!Array.isArray(risposte) || risposte.length === 0) {
    throw new AppError('Nessuna risposta fornita.', 422, 'EMPTY_SUBMISSION');
  }

  const adattatore = ADATTATORI[dominio];

  // 1. Normalizzazione + validazione difensiva contro il dizionario canonico.
  const normalizzate = normalizzaRisposte(risposte, adattatore);
  if (normalizzate.length === 0) {
    throw new AppError(
      `Le risposte fornite non contengono ${dominio} validi.`,
      422,
      'INVALID_SUBMISSION'
    );
  }

  // 2. Aggregati del round.
  const totale = normalizzate.length;
  const corrette = normalizzate.filter((r) => r.corretto).length;
  const errate = totale - corrette;
  const percentuale = Math.round((corrette / totale) * 100);

  const timerMode = datiBonus.timerMode === true;
  const maxCombo =
    Number.isInteger(datiBonus.maxCombo) && datiBonus.maxCombo > 0 ? datiBonus.maxCombo : 0;

  const { xpGuadagnati, xpRisposte, bonusCombo, bonusPercentuale } = calcolaXpRound({
    corrette,
    percentuale,
    maxCombo,
    timerMode,
  });

  // 3. Transazione atomica: SRS (per dominio) + esito utente (condiviso).
  const risultatoTx = await sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    await applicaSrsRound(adattatore, userId, normalizzate, t);

    const { xpIniziale, valutazione } = await applicaEsitoRound(
      utente,
      { totale, corrette, percentuale, xpGuadagnati },
      t
    );

    await utente.save({ transaction: t });
    return { utente, xpIniziale, valutazione };
  });

  const { utente: utenteFinale, xpIniziale, valutazione } = risultatoTx;
  const livelloPrima = calcolaLivello(xpIniziale);
  const livelloDopo = calcolaLivello(utenteFinale.xp);

  logger.info(
    `[QUIZ:${dominio}] Utente ${userId} ha inviato un round: ${corrette}/${totale} (${percentuale}%), ` +
      `+${xpGuadagnati} XP` +
      (valutazione.xpRighe ? ` (+${valutazione.xpRighe} XP sblocco righe)` : '') +
      (valutazione.nuoviBadge.length ? `, badge: ${valutazione.nuoviBadge.join(', ')}` : '')
  );

  return {
    risultatoRound: {
      dominio,
      corrette,
      errate,
      totale,
      percentuale,
      xpGuadagnati,
      xpRisposte,
      bonusCombo,
      bonusPercentuale,
      xpRighe: valutazione.xpRighe,
      livelloPrima,
      livelloDopo,
      salitoDiLivello: livelloDopo > livelloPrima,
      nuoviBadge: valutazione.nuoviBadge,
    },
    statistiche: serializzaStatistiche(utenteFinale),
  };
};

// ─────────────────────────────────────────────
// DASHBOARD (invariata: statistiche globali basate sui kana)
// ─────────────────────────────────────────────
const getDashboard = async (userId) => {
  const utente = await Utente.findByPk(userId, {
    attributes: [
      'id', 'xp', 'streak', 'streak_record', 'punteggio_record', 'ultima_data_studio',
      'quiz_completati', 'tratti_validati', 'righe_sbloccate',
    ],
  });
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  const [mastered, peggiori, riepilogoBadge] = await Promise.all([
    ProgressoKana.count({
      where: { utente_id: userId, punteggio: PUNTEGGIO_SRS_MAX },
    }),
    ProgressoKana.findAll({
      where: { utente_id: userId, punteggio: { [Op.lt]: SOGLIA_SRS_DIFFICILE } },
      attributes: ['kana', 'tipo', 'punteggio'],
      order: [['punteggio', 'ASC'], ['updated_at', 'DESC']],
      limit: LIMITE_PEGGIORI_KANA,
    }),
    gamificationService.getRiepilogoBadge(userId),
  ]);

  return {
    statistiche: serializzaStatistiche(utente),
    mastered,
    peggioriKana: peggiori.map((p) => p.toPublicJSON()),
    badge: riepilogoBadge,
  };
};

module.exports = {
  generateQuizPool,
  submitQuizResults,
  getDashboard,
  // Esportati per riuso/test:
  calcolaLivello,
  infoLivello,
  calcolaXpRound,
  calcolaNuovaStreak,
  DOMINI,
  TIPI_QUIZ_KANJI,
};
