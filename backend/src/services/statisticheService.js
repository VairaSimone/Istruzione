'use strict';

const { Op } = require('sequelize');
const Utente = require('../models/Utente');
const ProgressoKana = require('../models/ProgressoKana');
const AttivitaGiornaliera = require('../models/AttivitaGiornaliera');
const AppError = require('../utils/AppError');
const { mescola } = require('../utils/mescola');
const { trovaKana, ALFABETI } = require('../constants/kanaData');
const {
  mezzanotteOdiernaUTC,
  formattaDataOnly,
  differenzaGiorni,
  giorniFaUTC,
} = require('../utils/dateUtils');

/**
 * StatisticheService — funzionalità di analisi dello studio:
 *
 *   getHeatmap              → griglia dei contributi in stile GitHub (per giorno)
 *   getStreak               → stato della streak (corrente + record + rischio)
 *   getCaratteriProblematici→ kana/kanji con più errori (risposte + ordine tratti)
 *   generaAllenamentoIntensivo → pool di quiz mirato SOLO sui caratteri deboli
 *
 * Tutte le letture sono sola-lettura e non mutano lo stato; la generazione del
 * pool intensivo è anch'essa priva di effetti collaterali (l'aggiornamento SRS
 * avviene poi tramite il normale POST /api/quiz/submit).
 */

// ─────────────────────────────────────────────
// Costanti
// ─────────────────────────────────────────────

// Finestra della heatmap (giorni). 365 ≈ un anno come GitHub.
const GIORNI_HEATMAP_DEFAULT = 365;
const GIORNI_HEATMAP_MIN = 7;
const GIORNI_HEATMAP_MAX = 366;

// Soglia SRS sotto la quale un carattere è "da rivedere" (coerente col quiz).
const SOGLIA_SRS_DIFFICILE = ProgressoKana.PUNTEGGIO_DEFAULT; // 3

// Numero massimo di caratteri problematici restituiti dall'elenco.
const LIMITE_PROBLEMATICI = 30;

// Dimensione massima del pool di allenamento intensivo.
const DIMENSIONE_INTENSIVO = 20;

// Numero minimo di caratteri deboli per abilitare l'allenamento intensivo.
const MIN_PER_ALLENAMENTO = 1;

// ─────────────────────────────────────────────
// Helper — punteggio di "problematicità" di un carattere
// Pesa di più gli errori di ordine-tratti (concetto più difficile da correggere)
// poi gli errori di risposta, poi la distanza dal punteggio SRS neutro.
// ─────────────────────────────────────────────
const calcolaPunteggioProblema = (p) => {
  const distanzaSrs = Math.max(0, SOGLIA_SRS_DIFFICILE - p.punteggio);
  return p.errori_tratti * 2 + p.errori + distanzaSrs;
};

// Predicato comune: un carattere è problematico se ha errori (di risposta o di
// tratto) oppure un punteggio SRS sotto la soglia "da rivedere".
const whereProblematici = (userId) => ({
  utente_id: userId,
  [Op.or]: [
    { errori: { [Op.gt]: 0 } },
    { errori_tratti: { [Op.gt]: 0 } },
    { punteggio: { [Op.lt]: SOGLIA_SRS_DIFFICILE } },
  ],
});

// ─────────────────────────────────────────────
// HEATMAP DELLE ATTIVITÀ
// ─────────────────────────────────────────────
/**
 * Restituisce l'attività giornaliera degli ultimi `giorni` giorni (incluso
 * oggi), pronta per una griglia stile "contributi GitHub".
 *
 * Per ogni giorno con attività vengono restituiti i contatori grezzi più:
 *   - `intensita`: misura sintetica dell'attività (risposte + tratti del giorno);
 *   - `livello`  : bucket 0-4 derivato dall'intensità relativa al massimo del
 *                  periodo, per colorare direttamente le celle.
 * I giorni senza attività NON sono inclusi: il frontend completa la griglia
 * trattandoli come livello 0.
 *
 * @param {string} userId
 * @param {number} [giorni=365]
 */
const getHeatmap = async (userId, giorni = GIORNI_HEATMAP_DEFAULT) => {
  let finestra = Number.parseInt(giorni, 10);
  if (!Number.isInteger(finestra)) finestra = GIORNI_HEATMAP_DEFAULT;
  finestra = Math.max(GIORNI_HEATMAP_MIN, Math.min(GIORNI_HEATMAP_MAX, finestra));

  const oggi = mezzanotteOdiernaUTC();
  const dataInizio = giorniFaUTC(finestra - 1); // include oggi
  const dal = formattaDataOnly(dataInizio);
  const al = formattaDataOnly(oggi);

  const righe = await AttivitaGiornaliera.findAll({
    where: { utente_id: userId, giorno: { [Op.gte]: dal } },
    order: [['giorno', 'ASC']],
  });

  // Intensità per giorno + massimo del periodo (per il bucketing del livello).
  const conIntensita = righe.map((r) => {
    const intensita = (r.risposte_totali || 0) + (r.tratti_validati || 0);
    return { riga: r, intensita };
  });
  const massimo = conIntensita.reduce((m, x) => Math.max(m, x.intensita), 0);

  const livelloDa = (intensita) => {
    if (intensita <= 0 || massimo <= 0) return 0;
    const rapporto = intensita / massimo;
    if (rapporto >= 0.75) return 4;
    if (rapporto >= 0.5) return 3;
    if (rapporto >= 0.25) return 2;
    return 1;
  };

  const giorniDati = conIntensita.map(({ riga, intensita }) => ({
    ...riga.toPublicJSON(),
    intensita,
    livello: livelloDa(intensita),
  }));

  const riepilogo = giorniDati.reduce(
    (acc, g) => {
      acc.giorniAttivi += 1;
      acc.totaleQuiz += g.quizCompletati;
      acc.totaleRisposte += g.risposteTotali;
      acc.totaleCorrette += g.risposteCorrette;
      acc.totaleTratti += g.trattiValidati;
      acc.totaleXp += g.xpGuadagnati;
      return acc;
    },
    {
      giorniAttivi: 0,
      totaleQuiz: 0,
      totaleRisposte: 0,
      totaleCorrette: 0,
      totaleTratti: 0,
      totaleXp: 0,
    }
  );

  return {
    dal,
    al,
    giorniRichiesti: finestra,
    massimoGiornaliero: massimo,
    giorni: giorniDati,
    riepilogo,
  };
};

// ─────────────────────────────────────────────
// STREAK DI STUDIO
// ─────────────────────────────────────────────
/**
 * Stato corrente della streak di studio. La streak memorizzata in tabella
 * viene ricalcolata solo al prossimo submit; qui se ne deriva il valore EFFETTIVO
 * per la visualizzazione (azzerato se l'ultimo studio è anteriore a ieri),
 * senza mutare lo stato.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   streak:number, streakRecord:number, ultimaDataStudio:string|null,
 *   attivaOggi:boolean, aRischio:boolean
 * }>}
 *   - `attivaOggi`: l'utente ha già studiato oggi (streak salva);
 *   - `aRischio`  : ha studiato ieri ma non ancora oggi (deve studiare per non
 *                   perdere la streak).
 */
const getStreak = async (userId) => {
  const utente = await Utente.findByPk(userId, {
    attributes: ['id', 'streak', 'streak_record', 'ultima_data_studio'],
  });
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  const oggi = mezzanotteOdiernaUTC();
  const ultima = utente.ultima_data_studio;
  const diff = ultima ? differenzaGiorni(ultima, oggi) : null;

  const attivaOggi = diff === 0;
  const aRischio = diff === 1;
  // Streak effettiva: viva solo se l'ultimo studio è oggi o ieri.
  const streakCorrente = diff !== null && diff <= 1 ? (utente.streak || 0) : 0;

  return {
    streak: streakCorrente,
    streakRecord: utente.streak_record || 0,
    ultimaDataStudio: ultima || null,
    attivaOggi,
    aRischio,
  };
};

// ─────────────────────────────────────────────
// CARATTERI PROBLEMATICI
// ─────────────────────────────────────────────
/**
 * Elenco dei caratteri su cui l'utente sbaglia di più (errori di risposta e/o
 * di ordine dei tratti, e/o punteggio SRS basso), ordinato per gravità.
 *
 * @param {string} userId
 * @param {{limite?:number, alfabeto?:string}} [opts]
 */
const getCaratteriProblematici = async (userId, opts = {}) => {
  const where = whereProblematici(userId);
  if (opts.alfabeto && ALFABETI.includes(opts.alfabeto)) {
    where.tipo = opts.alfabeto;
  }

  const limite = Math.max(1, Math.min(LIMITE_PROBLEMATICI, Number(opts.limite) || LIMITE_PROBLEMATICI));

  const progressi = await ProgressoKana.findAll({ where });

  const caratteri = progressi
    .map((p) => {
      const entry = trovaKana(p.kana, p.tipo);
      return {
        kana: p.kana,
        tipo: p.tipo,
        romaji: entry ? entry.romaji : null,
        punteggio: p.punteggio,
        tentativi: p.tentativi,
        errori: p.errori,
        erroriTratti: p.errori_tratti,
        tassoErrore: p.tentativi > 0 ? Number((p.errori / p.tentativi).toFixed(3)) : 0,
        punteggioProblema: calcolaPunteggioProblema(p),
      };
    })
    // Ordina per gravità: punteggio problema, poi tasso errore, poi errori.
    .sort(
      (a, b) =>
        b.punteggioProblema - a.punteggioProblema ||
        b.tassoErrore - a.tassoErrore ||
        b.errori - a.errori
    )
    .slice(0, limite);

  const conErroriQuiz = progressi.filter((p) => p.errori > 0).length;
  const conErroriTratti = progressi.filter((p) => p.errori_tratti > 0).length;

  return {
    caratteri,
    riepilogo: {
      totaleProblematici: progressi.length,
      conErroriQuiz,
      conErroriTratti,
      allenamentoDisponibile: progressi.length >= MIN_PER_ALLENAMENTO,
    },
  };
};

// ─────────────────────────────────────────────
// ALLENAMENTO INTENSIVO (pool mirato sui caratteri deboli)
// ─────────────────────────────────────────────
/**
 * Genera un pool di quiz composto ESCLUSIVAMENTE dai caratteri problematici
 * dell'utente, ordinati per gravità e poi mescolati. Sola lettura: l'esito
 * verrà inviato al normale endpoint di submit, che aggiorna SRS/XP/streak.
 *
 * @param {string} userId
 * @param {{alfabeto?:string, limite?:number}} [filtri]
 * @returns {Promise<{ alfabeto:string, modalita:'intensivo', totale:number,
 *   kana:Array<{kana:string,romaji:string,tipo:string,punteggio:number}> }>}
 */
const generaAllenamentoIntensivo = async (userId, filtri = {}) => {
  const { alfabeto } = filtri;

  if (alfabeto && !ALFABETI.includes(alfabeto)) {
    throw new AppError('Alfabeto non valido. Usa "hiragana" o "katakana".', 422, 'INVALID_ALPHABET');
  }

  const limite = Math.max(
    1,
    Math.min(DIMENSIONE_INTENSIVO, Number(filtri.limite) || DIMENSIONE_INTENSIVO)
  );

  const where = whereProblematici(userId);
  if (alfabeto) where.tipo = alfabeto;

  const progressi = await ProgressoKana.findAll({ where });

  if (progressi.length === 0) {
    throw new AppError(
      'Nessun carattere problematico disponibile per l\'allenamento intensivo.',
      422,
      'EMPTY_TRAINING_POOL'
    );
  }

  // Ordina per gravità e tieni i peggiori fino al limite.
  const selezione = progressi
    .map((p) => ({ p, punteggioProblema: calcolaPunteggioProblema(p) }))
    .sort((a, b) => b.punteggioProblema - a.punteggioProblema)
    .slice(0, limite)
    .map(({ p }) => {
      const entry = trovaKana(p.kana, p.tipo);
      return {
        kana: p.kana,
        romaji: entry ? entry.romaji : null,
        tipo: p.tipo,
        punteggio: p.punteggio,
      };
    })
    // Scarta eventuali caratteri non più presenti nel dizionario canonico.
    .filter((k) => k.romaji !== null);

  if (selezione.length === 0) {
    throw new AppError(
      'Nessun carattere problematico disponibile per l\'allenamento intensivo.',
      422,
      'EMPTY_TRAINING_POOL'
    );
  }

  // Mescola l'ordine di presentazione.
  mescola(selezione);

  return {
    alfabeto: alfabeto || 'misto',
    modalita: 'intensivo',
    totale: selezione.length,
    kana: selezione,
  };
};

module.exports = {
  getHeatmap,
  getStreak,
  getCaratteriProblematici,
  generaAllenamentoIntensivo,
  // Esportati per riuso/test:
  calcolaPunteggioProblema,
};
