'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const ProgressoKana = require('../models/ProgressoKana');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { filtraKana, trovaKana, ALFABETI } = require('../constants/kanaData');
const { calcolaLivello, infoLivello, serializzaStatistiche } = require('../utils/gameStats');
const gamificationService = require('./gamificationService');

/**
 * QuizService — logica di business del Quiz Kana.
 *
 *   generateQuizPool  → selezione SRS ibrida dei caratteri per una partita
 *   submitQuizResults → elaborazione dell'esito (SRS, XP, streak, record)
 *   getDashboard      → statistiche aggregate per la home
 *
 * Tutta la logica "pesante" che prima girava nel browser (localStorage) vive
 * qui ed è persistita sul database.
 */

// ─────────────────────────────────────────────
// Costanti di gioco
// ─────────────────────────────────────────────
const DIMENSIONE_QUIZ = 20;          // massimo numero di kana per partita
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

// ─────────────────────────────────────────────
// Helpers — livello / XP
// `calcolaLivello`, `infoLivello` e `serializzaStatistiche` vivono ora in
// `utils/gameStats` per essere condivisi con `gamificationService` senza
// dipendenze circolari. Sono re-esportati in fondo per compatibilità/test.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Helpers — date (normalizzate in UTC, colonna DATEONLY 'YYYY-MM-DD')
// ─────────────────────────────────────────────

/** Mezzanotte UTC odierna come oggetto Date. */
const mezzanotteOdiernaUTC = () => {
  const ora = new Date();
  return new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth(), ora.getUTCDate()));
};

/** Formatta una Date in stringa 'YYYY-MM-DD'. */
const formattaDataOnly = (d) => d.toISOString().slice(0, 10);

/**
 * Differenza in giorni tra una data memorizzata ('YYYY-MM-DD') e una Date di
 * riferimento (mezzanotte UTC). Positiva se la data memorizzata è nel passato.
 */
const differenzaGiorni = (dataStr, riferimento) => {
  const [anno, mese, giorno] = String(dataStr).split('-').map(Number);
  const memorizzata = new Date(Date.UTC(anno, mese - 1, giorno));
  return Math.round((riferimento.getTime() - memorizzata.getTime()) / 86400000);
};

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
// (serializzaStatistiche è importato da utils/gameStats)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// GENERAZIONE POOL QUIZ (SRS ibrido)
// Pesca prima i kana con punteggio < 3, poi riempie i posti restanti con
// kana scelti casualmente tra quelli con punteggio >= 3. Massimo 20.
// ─────────────────────────────────────────────
const generateQuizPool = async (userId, filtri = {}) => {
  const { alfabeto, gruppi = [], includiDakuon = true, includiYoon = true } = filtri;

  if (!ALFABETI.includes(alfabeto)) {
    throw new AppError('Alfabeto non valido. Usa "hiragana" o "katakana".', 422, 'INVALID_ALPHABET');
  }

  // 1. Candidati in base ai filtri di gioco.
  const candidati = filtraKana({ alfabeto, gruppi, includiDakuon, includiYoon });
  if (candidati.length === 0) {
    throw new AppError('Nessun kana corrisponde ai filtri selezionati.', 422, 'EMPTY_QUIZ_POOL');
  }

  // 2. Punteggi SRS attuali dell'utente per i soli candidati.
  const kanaCandidati = candidati.map((c) => c.kana);
  const progressi = await ProgressoKana.findAll({
    where: { utente_id: userId, tipo: alfabeto, kana: { [Op.in]: kanaCandidati } },
    attributes: ['kana', 'punteggio'],
  });
  const punteggioPerKana = new Map(progressi.map((p) => [p.kana, p.punteggio]));

  // 3. Partizione difficili / facili (assenti ⇒ punteggio di default).
  const difficili = [];
  const facili = [];
  for (const c of candidati) {
    const punteggio = punteggioPerKana.has(c.kana)
      ? punteggioPerKana.get(c.kana)
      : PUNTEGGIO_SRS_DEFAULT;
    const entry = { ...c, punteggio };
    if (punteggio < SOGLIA_SRS_DIFFICILE) difficili.push(entry);
    else facili.push(entry);
  }

  // 4. Priorità ai difficili (subset casuale se eccedono), riempimento con facili.
  mescola(difficili);
  mescola(facili);
  const selezione = [...difficili, ...facili].slice(0, DIMENSIONE_QUIZ);

  // 5. Mescola l'ordine di presentazione per variare le partite.
  mescola(selezione);

  return {
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

// ─────────────────────────────────────────────
// CALCOLO XP DEL ROUND
// ─────────────────────────────────────────────
const calcolaXpRound = ({ corrette, percentuale, maxCombo, timerMode }) => {
  const xpBase = timerMode ? XP_PER_CORRETTA_TIMER : XP_PER_CORRETTA;
  const xpRisposte = corrette * xpBase;

  // Bonus combo: replica l'effetto "XP raddoppiati" del frontend, dove le
  // risposte oltre la quinta consecutiva valgono il doppio. Approssimato sulla
  // combo massima raggiunta (le risposte dalla 5ª alla N-esima ⇒ +xpBase l'una).
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
    // Ha già studiato oggi (o anomalia di clock): streak invariata, almeno 1.
    return Math.max(1, streakAttuale || 0);
  }
  if (diff === 1) {
    return (streakAttuale || 0) + 1; // ieri ⇒ +1
  }
  return 1; // gap > 1 giorno ⇒ azzera e riparti da 1
};

// ─────────────────────────────────────────────
// INVIO RISULTATI PARTITA
// Tutto in transazione: progressi SRS + statistiche utente atomicamente.
// ─────────────────────────────────────────────
const submitQuizResults = async (userId, risposte, datiBonus = {}) => {
  if (!Array.isArray(risposte) || risposte.length === 0) {
    throw new AppError('Nessuna risposta fornita.', 422, 'EMPTY_SUBMISSION');
  }

  // 1. Normalizzazione + validazione difensiva contro il dizionario canonico.
  //    Kana sconosciuti vengono ignorati (anti-manipolazione del client).
  //    De-duplicazione per (tipo, kana): in un round un kana è unico, ma se
  //    arrivasse duplicato, una singola occorrenza errata lo marca errato.
  const perChiave = new Map();
  for (const r of risposte) {
    const tipo = r && r.tipo;
    const kana = r && typeof r.kana === 'string' ? r.kana.trim() : '';
    if (!trovaKana(kana, tipo)) continue;

    const chiave = `${tipo}:${kana}`;
    const corretto = r.corretto === true;
    if (perChiave.has(chiave)) {
      perChiave.get(chiave).corretto = perChiave.get(chiave).corretto && corretto;
    } else {
      perChiave.set(chiave, { kana, tipo, corretto });
    }
  }

  const normalizzate = Array.from(perChiave.values());
  if (normalizzate.length === 0) {
    throw new AppError('Le risposte fornite non contengono kana validi.', 422, 'INVALID_SUBMISSION');
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

  // 3. Transazione atomica.
  const utenteAggiornato = await sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    // 3a. Punteggi SRS attuali dei kana coinvolti (lock per coerenza).
    const kanaCoinvolti = normalizzate.map((r) => r.kana);
    const progressiEsistenti = await ProgressoKana.findAll({
      where: { utente_id: userId, kana: { [Op.in]: kanaCoinvolti } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const mappaEsistenti = new Map(
      progressiEsistenti.map((p) => [`${p.tipo}:${p.kana}`, p.punteggio])
    );

    // 3b. Calcolo dei nuovi punteggi e upsert massivo (una sola query).
    const righeUpsert = normalizzate.map((r) => {
      const chiave = `${r.tipo}:${r.kana}`;
      const attuale = mappaEsistenti.has(chiave)
        ? mappaEsistenti.get(chiave)
        : PUNTEGGIO_SRS_DEFAULT;
      const nuovo = r.corretto
        ? Math.min(PUNTEGGIO_SRS_MAX, attuale + SRS_DELTA_CORRETTA)
        : Math.max(PUNTEGGIO_SRS_MIN, attuale - SRS_DELTA_ERRATA);
      return { utente_id: userId, kana: r.kana, tipo: r.tipo, punteggio: nuovo };
    });

    await ProgressoKana.bulkCreate(righeUpsert, {
      updateOnDuplicate: ['punteggio', 'updated_at'],
      transaction: t,
    });

    // 3c. XP del round.
    const xpIniziale = utente.xp || 0;
    utente.xp = xpIniziale + xpGuadagnati;

    // 3d. Streak.
    const oggi = mezzanotteOdiernaUTC();
    utente.streak = calcolaNuovaStreak(utente.streak, utente.ultima_data_studio, oggi);
    utente.ultima_data_studio = formattaDataOnly(oggi);

    // 3e. Record (highscore).
    if (percentuale > (utente.punteggio_record || 0)) {
      utente.punteggio_record = percentuale;
    }

    // 3f. Contatore quiz completati (per i badge).
    utente.quiz_completati = (utente.quiz_completati || 0) + 1;

    // 3g. Valutazione progressi (sblocco righe + badge), nella stessa
    //     transazione. Può aggiungere altri XP (sblocco riga) sull'utente
    //     prima del salvataggio.
    const valutazione = await gamificationService.valutaProgressi(utente, t);

    await utente.save({ transaction: t });
    return { utente, xpIniziale, valutazione };
  });

  const { utente: utenteFinale, xpIniziale, valutazione } = utenteAggiornato;
  const livelloPrima = calcolaLivello(xpIniziale);
  const livelloDopo = calcolaLivello(utenteFinale.xp);

  logger.info(
    `[QUIZ] Utente ${userId} ha inviato un round: ${corrette}/${totale} (${percentuale}%), ` +
      `+${xpGuadagnati} XP` +
      (valutazione.xpRighe ? ` (+${valutazione.xpRighe} XP sblocco righe)` : '') +
      (valutazione.nuoviBadge.length ? `, badge: ${valutazione.nuoviBadge.join(', ')}` : '')
  );

  return {
    risultatoRound: {
      corrette,
      errate,
      totale,
      percentuale,
      xpGuadagnati,
      xpRisposte,
      bonusCombo,
      bonusPercentuale,
      // XP una-tantum per eventuali righe di kana sbloccate in questo round.
      xpRighe: valutazione.xpRighe,
      livelloPrima,
      livelloDopo,
      salitoDiLivello: livelloDopo > livelloPrima,
      // Codici dei badge sbloccati in questo round (per i toast frontend).
      nuoviBadge: valutazione.nuoviBadge,
    },
    statistiche: serializzaStatistiche(utenteFinale),
  };
};

// ─────────────────────────────────────────────
// DASHBOARD
// Statistiche globali + conteggio "mastered" (punteggio === 5) +
// "peggiori kana" (punteggio < 3).
// ─────────────────────────────────────────────
const getDashboard = async (userId) => {
  const utente = await Utente.findByPk(userId, {
    attributes: [
      'id', 'xp', 'streak', 'punteggio_record', 'ultima_data_studio',
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
};
