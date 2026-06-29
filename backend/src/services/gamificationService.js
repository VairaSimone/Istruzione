'use strict';

const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const ProgressoKana = require('../models/ProgressoKana');
const BadgeUtente = require('../models/BadgeUtente');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { calcolaLivello, serializzaStatistiche } = require('../utils/gameStats');
const {
  BADGES,
  RIGHE_BASE,
  TOTALE_PER_ALFABETO,
  TOTALE_RIGHE_BASE,
  XP_PER_TRATTO,
  XP_PER_RIGA_SBLOCCATA,
} = require('../constants/badges');

/**
 * GamificationService — obiettivi/badge + sorgenti XP non legate al quiz.
 *
 * Complementare a `quizService` (SRS/XP/streak del quiz). Responsabilità:
 *   - valutare e sbloccare i BADGE in modo idempotente;
 *   - assegnare XP per lo "sblocco" delle righe di kana (riga base portata
 *     interamente al punteggio SRS massimo), una sola volta per riga;
 *   - registrare la SCRITTURA su canvas (tratti validati) con relativi XP;
 *   - esporre il profilo badge (catalogo + stato di sblocco) per il frontend.
 *
 * Tutto il testo visualizzato dei badge è localizzato lato frontend: qui si
 * trattano esclusivamente i codici stabili.
 */

const PUNTEGGIO_SRS_MAX = ProgressoKana.PUNTEGGIO_MAX; // 5

// Tetto difensivo ai tratti dichiarati in una singola chiamata: coerente col
// limite del validator, protegge da payload gonfiati (anti-manipolazione).
const MAX_TRATTI_PER_CHIAMATA = 50;

// ─────────────────────────────────────────────
// Conteggio righe base completamente padroneggiate
// ─────────────────────────────────────────────
/**
 * Quante righe BASE risultano interamente al punteggio SRS massimo, dato
 * l'insieme dei kana padroneggiati (chiavi `${tipo}:${kana}`).
 */
const contaRigheComplete = (insiemeMastered) => {
  let totale = 0;
  for (const riga of RIGHE_BASE) {
    if (riga.membri.every((chiave) => insiemeMastered.has(chiave))) totale += 1;
  }
  return totale;
};

// ─────────────────────────────────────────────
// VALUTAZIONE PROGRESSI (badge + sblocco righe)
// ─────────────────────────────────────────────
/**
 * Valuta i progressi di gioco di un utente DENTRO una transazione esistente:
 *   1. ricalcola i kana padroneggiati e le righe base complete;
 *   2. assegna (una sola volta) gli XP di sblocco riga, aggiornando il
 *      contatore monotòno `righe_sbloccate` e gli `xp` sull'istanza utente;
 *   3. valuta il catalogo badge sullo snapshot finale e inserisce i nuovi
 *      badge sbloccati (insert idempotente).
 *
 * IMPORTANTE: muta l'istanza `utente` (xp, righe_sbloccate) ma NON la salva:
 * il salvataggio resta responsabilità del chiamante, nella stessa transazione.
 *
 * @param {import('../models/Utente')} utente  istanza già lockata (FOR UPDATE)
 * @param {import('sequelize').Transaction} t
 * @returns {Promise<{ xpRighe:number, nuoviBadge:string[], righeSbloccate:number }>}
 */
const valutaProgressi = async (utente, t) => {
  // 1. Kana padroneggiati (punteggio massimo) dell'utente.
  const progressiMax = await ProgressoKana.findAll({
    where: { utente_id: utente.id, punteggio: PUNTEGGIO_SRS_MAX },
    attributes: ['kana', 'tipo'],
    transaction: t,
  });

  const insiemeMastered = new Set(progressiMax.map((p) => `${p.tipo}:${p.kana}`));
  const masteredHiragana = progressiMax.filter((p) => p.tipo === 'hiragana').length;
  const masteredKatakana = progressiMax.filter((p) => p.tipo === 'katakana').length;

  // 2. Sblocco righe (monotòno → XP una-tantum per riga).
  const righeComplete = contaRigheComplete(insiemeMastered);
  const righeGiaSbloccate = utente.righe_sbloccate || 0;
  let xpRighe = 0;
  if (righeComplete > righeGiaSbloccate) {
    xpRighe = (righeComplete - righeGiaSbloccate) * XP_PER_RIGA_SBLOCCATA;
    utente.xp = (utente.xp || 0) + xpRighe;
    utente.righe_sbloccate = righeComplete;
  }

  // 3. Snapshot aggregato (livello derivato dagli XP finali, post sblocco riga).
  const snapshot = {
    xp: utente.xp || 0,
    livello: calcolaLivello(utente.xp || 0),
    streak: utente.streak || 0,
    punteggioRecord: utente.punteggio_record || 0,
    quizCompletati: utente.quiz_completati || 0,
    trattiValidati: utente.tratti_validati || 0,
    righeSbloccate: utente.righe_sbloccate || 0,
    masteredHiragana,
    masteredKatakana,
    totaleHiragana: TOTALE_PER_ALFABETO.hiragana || 0,
    totaleKatakana: TOTALE_PER_ALFABETO.katakana || 0,
  };

  // 4. Badge già posseduti → valuta solo i mancanti.
  const giaPosseduti = await BadgeUtente.findAll({
    where: { utente_id: utente.id },
    attributes: ['badge_code'],
    transaction: t,
  });
  const posseduti = new Set(giaPosseduti.map((b) => b.badge_code));

  const nuoviBadge = BADGES
    .filter((b) => !posseduti.has(b.code) && b.criterio(snapshot))
    .map((b) => b.code);

  if (nuoviBadge.length > 0) {
    await BadgeUtente.bulkCreate(
      nuoviBadge.map((code) => ({ utente_id: utente.id, badge_code: code })),
      { ignoreDuplicates: true, transaction: t }
    );
  }

  return { xpRighe, nuoviBadge, righeSbloccate: righeComplete };
};

// ─────────────────────────────────────────────
// REGISTRAZIONE SCRITTURA SU CANVAS
// ─────────────────────────────────────────────
/**
 * Registra una sessione di scrittura: `trattiValidati` tratti accettati dalla
 * validazione lato client. Assegna XP, aggiorna il contatore globale e valuta
 * i badge correlati (scrittura, livello, eventuale sblocco riga invariato).
 *
 * La validazione geometrica del tratto è intrinsecamente lato client (canvas);
 * il backend si fida del conteggio entro un tetto rigido e dietro rate limiter
 * dedicato, in modo coerente col modello di fiducia già adottato per il submit
 * del quiz.
 *
 * @param {string} userId
 * @param {number} trattiValidati  intero 1..MAX_TRATTI_PER_CHIAMATA
 */
const registraScrittura = async (userId, trattiValidati) => {
  const tratti = Number(trattiValidati);
  if (!Number.isInteger(tratti) || tratti < 1 || tratti > MAX_TRATTI_PER_CHIAMATA) {
    throw new AppError('Numero di tratti validati non valido.', 422, 'INVALID_STROKE_COUNT');
  }

  const xpScrittura = tratti * XP_PER_TRATTO;

  const { utenteAggiornato, xpIniziale, valutazione } = await sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    const iniziale = utente.xp || 0;

    utente.xp = iniziale + xpScrittura;
    utente.tratti_validati = (utente.tratti_validati || 0) + tratti;

    const esitoValutazione = await valutaProgressi(utente, t);

    await utente.save({ transaction: t });
    return { utenteAggiornato: utente, xpIniziale: iniziale, valutazione: esitoValutazione };
  });

  const livelloPrima = calcolaLivello(xpIniziale);
  const livelloDopo = calcolaLivello(utenteAggiornato.xp);

  logger.info(
    `[GAMIFICATION] Utente ${userId} scrittura: +${tratti} tratti, +${xpScrittura} XP` +
      (valutazione.nuoviBadge.length ? `, badge: ${valutazione.nuoviBadge.join(', ')}` : '')
  );

  return {
    risultato: {
      trattiValidati: tratti,
      xpScrittura,
      xpRighe: valutazione.xpRighe,
      xpGuadagnati: xpScrittura + valutazione.xpRighe,
      livelloPrima,
      livelloDopo,
      salitoDiLivello: livelloDopo > livelloPrima,
      nuoviBadge: valutazione.nuoviBadge,
    },
    statistiche: serializzaStatistiche(utenteAggiornato),
  };
};

// ─────────────────────────────────────────────
// RIEPILOGO BADGE (per la dashboard)
// ─────────────────────────────────────────────
/**
 * Conteggio compatto sbloccati/totale, opzionalmente dentro una transazione.
 */
const getRiepilogoBadge = async (userId, t = null) => {
  const sbloccati = await BadgeUtente.count({
    where: { utente_id: userId },
    ...(t ? { transaction: t } : {}),
  });
  return { sbloccati, totale: BADGES.length };
};

// ─────────────────────────────────────────────
// PROFILO BADGE (catalogo completo + stato di sblocco)
// ─────────────────────────────────────────────
/**
 * Restituisce l'intero catalogo badge con lo stato di sblocco dell'utente, le
 * statistiche di gioco e i totali utili alle barre di progresso del frontend.
 * Sola lettura.
 */
const getProfiloBadge = async (userId) => {
  const utente = await Utente.findByPk(userId, {
    attributes: [
      'id', 'xp', 'streak', 'punteggio_record', 'ultima_data_studio',
      'quiz_completati', 'tratti_validati', 'righe_sbloccate',
    ],
  });
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  const [sbloccati, masterPerTipo] = await Promise.all([
    BadgeUtente.findAll({
      where: { utente_id: userId },
      attributes: ['badge_code', 'created_at'],
    }),
    ProgressoKana.findAll({
      where: { utente_id: userId, punteggio: PUNTEGGIO_SRS_MAX },
      attributes: ['kana', 'tipo'],
    }),
  ]);

  const dataPerCodice = new Map(sbloccati.map((b) => [b.badge_code, b.created_at]));

  const masteredHiragana = masterPerTipo.filter((p) => p.tipo === 'hiragana').length;
  const masteredKatakana = masterPerTipo.filter((p) => p.tipo === 'katakana').length;

  const badge = BADGES.map((b) => ({
    codice: b.code,
    categoria: b.categoria,
    sbloccato: dataPerCodice.has(b.code),
    dataSblocco: dataPerCodice.get(b.code) || null,
  }));

  return {
    statistiche: serializzaStatistiche(utente),
    badge,
    riepilogo: { sbloccati: sbloccati.length, totale: BADGES.length },
    progresso: {
      masteredHiragana,
      masteredKatakana,
      totaleHiragana: TOTALE_PER_ALFABETO.hiragana || 0,
      totaleKatakana: TOTALE_PER_ALFABETO.katakana || 0,
      righeSbloccate: utente.righe_sbloccate || 0,
      totaleRigheBase: TOTALE_RIGHE_BASE,
    },
  };
};

module.exports = {
  valutaProgressi,
  registraScrittura,
  getRiepilogoBadge,
  getProfiloBadge,
  // Esportati per riuso/test:
  contaRigheComplete,
};
