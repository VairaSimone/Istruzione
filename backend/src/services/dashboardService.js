'use strict';

const { Op, fn, col } = require('sequelize');
const Utente = require('../models/Utente');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const ProgressoKana = require('../models/ProgressoKana');
const ProgressoKanji = require('../models/ProgressoKanji');
const AttivitaGiornaliera = require('../models/AttivitaGiornaliera');
const AppError = require('../utils/AppError');

/**
 * DashboardService — statistiche AGGREGATE per il docente.
 *
 * Calcola in una manciata di query indicizzate (nessun N+1, nessun calcolo
 * rimandato al frontend) l'intero cruscotto per l'insieme di studenti di
 * un'aula (o di tutte le aule del docente):
 *   generali · kanji · kana · quiz · classifiche.
 *
 * NOTA sul "tempo medio di studio": lo schema attuale NON traccia il tempo
 * effettivo sul task (nessuna colonna di durata). Come proxy onesto e già
 * disponibile viene esposto `giorniStudioMedi` (media dei giorni attivi per
 * studente nella finestra). Per un tempo reale servirebbe una colonna di durata
 * su `attivita_giornaliera`, popolata dal frontend: fuori dallo scope backend.
 */

const GIORNI_FINESTRA_DEFAULT = 30;
// Soglia (giorni) oltre la quale uno studente è considerato inattivo.
const GIORNI_ATTIVITA = 7;
const LIMITE_LISTA_DEFAULT = 10;
const LIMITE_LISTA_MAX = 50;
// Tentativi minimi perché uno studente entri nella classifica "in difficoltà"
// (evita di segnalare come in difficoltà chi ha svolto pochissimi esercizi).
const MIN_TENTATIVI_DIFFICOLTA = 20;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const clamp = (n, min, max, fallback) => {
  const v = parseInt(n, 10);
  if (!Number.isInteger(v)) return fallback;
  return Math.min(Math.max(v, min), max);
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Formatta una Date in stringa DATEONLY 'YYYY-MM-DD' (UTC). */
const aDataOnly = (d) => d.toISOString().slice(0, 10);

/** Data (stringa DATEONLY) di `giorni` fa rispetto ad oggi (UTC). */
const dataFa = (giorni) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - giorni);
  return aDataOnly(d);
};

/** True se il richiedente insegna nell'aula (o è admin). */
const insegnaNellaClasse = async (classeId, richiedente) => {
  if (richiedente.ruolo === 'admin') return true;
  const m = await ClasseUtente.findOne({
    where: { classe_id: classeId, utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
  });
  return !!m;
};

/** Aggregato progressi (kana o kanji) per studente. → Map(utente_id → agg). */
const aggregaProgressiPerStudente = async (Modello, studentIds) => {
  const righe = await Modello.findAll({
    where: { utente_id: { [Op.in]: studentIds } },
    attributes: [
      'utente_id',
      [fn('SUM', col('errori')), 'err'],
      [fn('SUM', col('tentativi')), 'tent'],
      [fn('SUM', col('punteggio')), 'punt'],
      [fn('COUNT', col('id')), 'n'],
    ],
    group: ['utente_id'],
    raw: true,
  });
  const mappa = new Map();
  for (const r of righe) {
    mappa.set(String(r.utente_id), {
      err: num(r.err),
      tent: num(r.tent),
      punt: num(r.punt),
      n: num(r.n),
    });
  }
  return mappa;
};

// ─────────────────────────────────────────────
// Calcolo del cruscotto per un insieme di studenti
// ─────────────────────────────────────────────
const calcolaDashboard = async (studentIds, opzioni = {}) => {
  const numStudenti = studentIds.length;
  const finestra = clamp(opzioni.giorni, 1, 366, GIORNI_FINESTRA_DEFAULT);
  const limite = clamp(opzioni.limite, 1, LIMITE_LISTA_MAX, LIMITE_LISTA_DEFAULT);

  if (!numStudenti) {
    return {
      finestraGiorni: finestra,
      generali: {
        studentiTotali: 0, studentiAttivi: 0, studentiInattivi: 0,
        giorniStudioMedi: 0, progressoMedioPercento: 0,
        eserciziCompletati: 0, risposteTotali: 0, percentualeSuccessoMedia: 0,
      },
      kanji: { piuSbagliati: [], piuStudiati: [], maiCompletati: [] },
      kana: { hiraganaProblematici: [], katakanaProblematici: [] },
      quiz: { quizCompletati: 0, mediaVoti: 0, mediaErrori: 0, percentualeSuccesso: 0, tempoMedioDisponibile: false },
      classifica: { migliori: [], inDifficolta: [], inattivi: [], totaleInattivi: 0 },
    };
  }

  const inizioFinestra = dataFa(finestra);
  const sogliaAttivo = dataFa(GIORNI_ATTIVITA);

  // ── Query in parallelo (tutte indicizzate, filtrate su utente_id IN (...)) ──
  const [studenti, attivita, kanaPerStud, kanjiPerStud, kanaAgg, kanjiAgg] = await Promise.all([
    // 1. Anagrafica + statistiche a vita degli studenti.
    Utente.findAll({
      where: { id: { [Op.in]: studentIds } },
      attributes: [
        'id', 'nome', 'cognome', 'xp', 'streak',
        'punteggio_record', 'quiz_completati', 'ultima_data_studio',
      ],
      raw: true,
    }),
    // 2. Attività aggregata nella finestra.
    AttivitaGiornaliera.findOne({
      where: { utente_id: { [Op.in]: studentIds }, giorno: { [Op.gte]: inizioFinestra } },
      attributes: [
        [fn('SUM', col('risposte_totali')), 'risposteTotali'],
        [fn('SUM', col('risposte_corrette')), 'risposteCorrette'],
        [fn('SUM', col('quiz_completati')), 'quizFinestra'],
        [fn('COUNT', col('id')), 'recordAttivi'],
      ],
      raw: true,
    }),
    // 3. Progressi kana per studente.
    aggregaProgressiPerStudente(ProgressoKana, studentIds),
    // 4. Progressi kanji per studente.
    aggregaProgressiPerStudente(ProgressoKanji, studentIds),
    // 5. Kana aggregati per carattere+tipo (problematici).
    ProgressoKana.findAll({
      where: { utente_id: { [Op.in]: studentIds } },
      attributes: [
        'kana', 'tipo',
        [fn('SUM', col('errori')), 'err'],
        [fn('SUM', col('tentativi')), 'tent'],
      ],
      group: ['kana', 'tipo'],
      raw: true,
    }),
    // 6. Kanji aggregati per carattere (più sbagliati/studiati/mai completati).
    ProgressoKanji.findAll({
      where: { utente_id: { [Op.in]: studentIds } },
      attributes: [
        'kanji', 'livello_jlpt',
        [fn('SUM', col('errori')), 'err'],
        [fn('SUM', col('tentativi')), 'tent'],
        [fn('MAX', col('punteggio')), 'maxp'],
      ],
      group: ['kanji', 'livello_jlpt'],
      raw: true,
    }),
  ]);

  // ── GENERALI ──
  const risposteTotali = num(attivita && attivita.risposteTotali);
  const risposteCorrette = num(attivita && attivita.risposteCorrette);
  const recordAttivi = num(attivita && attivita.recordAttivi);

  let studentiAttivi = 0;
  let eserciziCompletati = 0;
  let sommaPunteggioRecord = 0;
  for (const s of studenti) {
    eserciziCompletati += num(s.quiz_completati);
    sommaPunteggioRecord += num(s.punteggio_record);
    if (s.ultima_data_studio && String(s.ultima_data_studio) >= sogliaAttivo) {
      studentiAttivi += 1;
    }
  }

  // Progresso medio e tasso di errore per studente (merge kana+kanji).
  let sommaPunt = 0;
  let sommaCount = 0;
  let sommaErroriProgress = 0;
  const progressoStudente = new Map(); // utente_id → { progresso, tassoErrore, tent }
  for (const id of studentIds.map(String)) {
    const k = kanaPerStud.get(id) || { err: 0, tent: 0, punt: 0, n: 0 };
    const j = kanjiPerStud.get(id) || { err: 0, tent: 0, punt: 0, n: 0 };
    const err = k.err + j.err;
    const tent = k.tent + j.tent;
    const punt = k.punt + j.punt;
    const n = k.n + j.n;
    sommaPunt += punt;
    sommaCount += n;
    sommaErroriProgress += err;
    progressoStudente.set(id, {
      progresso: n > 0 ? Math.round((punt / (n * ProgressoKana.PUNTEGGIO_MAX)) * 100) : 0,
      tassoErrore: tent > 0 ? err / tent : 0,
      tent,
    });
  }

  const progressoMedioPercento =
    sommaCount > 0 ? Math.round((sommaPunt / (sommaCount * ProgressoKana.PUNTEGGIO_MAX)) * 100) : 0;
  const percentualeSuccessoMedia =
    risposteTotali > 0 ? Math.round((risposteCorrette / risposteTotali) * 100) : 0;
  const giorniStudioMedi = Math.round((recordAttivi / numStudenti) * 10) / 10;
  const mediaVoti = numStudenti > 0 ? Math.round(sommaPunteggioRecord / numStudenti) : 0;
  const mediaErrori = numStudenti > 0 ? Math.round((sommaErroriProgress / numStudenti) * 10) / 10 : 0;

  // ── KANA problematici (per tipo) ──
  const kanaConErrori = kanaAgg
    .map((r) => ({ kana: r.kana, tipo: r.tipo, errori: num(r.err), tentativi: num(r.tent) }))
    .filter((r) => r.errori > 0)
    .sort((a, b) => b.errori - a.errori);
  const hiraganaProblematici = kanaConErrori.filter((r) => r.tipo === 'hiragana').slice(0, limite);
  const katakanaProblematici = kanaConErrori.filter((r) => r.tipo === 'katakana').slice(0, limite);

  // ── KANJI (più sbagliati / più studiati / mai completati) ──
  const kanjiMap = kanjiAgg.map((r) => ({
    kanji: r.kanji,
    livelloJLPT: r.livello_jlpt,
    errori: num(r.err),
    tentativi: num(r.tent),
    punteggioMax: num(r.maxp),
  }));
  const piuSbagliati = [...kanjiMap]
    .filter((k) => k.errori > 0)
    .sort((a, b) => b.errori - a.errori)
    .slice(0, limite)
    .map(({ kanji, livelloJLPT, errori, tentativi }) => ({ kanji, livelloJLPT, errori, tentativi }));
  const piuStudiati = [...kanjiMap]
    .filter((k) => k.tentativi > 0)
    .sort((a, b) => b.tentativi - a.tentativi)
    .slice(0, limite)
    .map(({ kanji, livelloJLPT, tentativi, errori }) => ({ kanji, livelloJLPT, tentativi, errori }));
  // "Mai completati": studiati ma da nessuno portati al punteggio massimo (5).
  const maiCompletati = [...kanjiMap]
    .filter((k) => k.tentativi > 0 && k.punteggioMax < ProgressoKanji.PUNTEGGIO_MAX)
    .sort((a, b) => b.tentativi - a.tentativi)
    .slice(0, limite)
    .map(({ kanji, livelloJLPT, tentativi, punteggioMax }) => ({ kanji, livelloJLPT, tentativi, punteggioMax }));

  // ── CLASSIFICHE ──
  const anagrafica = new Map(studenti.map((s) => [String(s.id), s]));

  const migliori = [...studenti]
    .sort((a, b) => num(b.xp) - num(a.xp) || num(b.punteggio_record) - num(a.punteggio_record))
    .slice(0, limite)
    .map((s) => ({
      id: s.id,
      nome: s.nome,
      cognome: s.cognome,
      xp: num(s.xp),
      punteggioRecord: num(s.punteggio_record),
      quizCompletati: num(s.quiz_completati),
      progressoPercento: (progressoStudente.get(String(s.id)) || {}).progresso || 0,
    }));

  const inDifficolta = [...progressoStudente.entries()]
    .filter(([, p]) => p.tent >= MIN_TENTATIVI_DIFFICOLTA && p.tassoErrore > 0)
    .sort((a, b) => b[1].tassoErrore - a[1].tassoErrore)
    .slice(0, limite)
    .map(([id, p]) => {
      const s = anagrafica.get(id) || {};
      return {
        id,
        nome: s.nome || null,
        cognome: s.cognome || null,
        tassoErrorePercento: Math.round(p.tassoErrore * 100),
        progressoPercento: p.progresso,
        tentativi: p.tent,
      };
    });

  const inattiviTutti = studenti
    .filter((s) => !s.ultima_data_studio || String(s.ultima_data_studio) < sogliaAttivo)
    .sort((a, b) => {
      const av = a.ultima_data_studio ? String(a.ultima_data_studio) : '';
      const bv = b.ultima_data_studio ? String(b.ultima_data_studio) : '';
      return av.localeCompare(bv); // i "mai studiato" ('') per primi
    });
  const inattivi = inattiviTutti.slice(0, limite).map((s) => ({
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    ultimaAttivita: s.ultima_data_studio || null,
  }));

  return {
    finestraGiorni: finestra,
    generali: {
      studentiTotali: numStudenti,
      studentiAttivi,
      studentiInattivi: inattiviTutti.length,
      giorniStudioMedi,
      progressoMedioPercento,
      eserciziCompletati,
      risposteTotali,
      percentualeSuccessoMedia,
    },
    kanji: { piuSbagliati, piuStudiati, maiCompletati },
    kana: { hiraganaProblematici, katakanaProblematici },
    quiz: {
      quizCompletati: eserciziCompletati,
      mediaVoti,
      mediaErrori,
      percentualeSuccesso: percentualeSuccessoMedia,
      // Il tempo effettivo sul task non è tracciato: vedi giorniStudioMedi come proxy.
      tempoMedioDisponibile: false,
    },
    classifica: {
      migliori,
      inDifficolta,
      inattivi,
      totaleInattivi: inattiviTutti.length,
    },
  };
};

// ─────────────────────────────────────────────
// Studenti di un'aula (ruolo studente nella membership).
// ─────────────────────────────────────────────
const studentiDellAula = async (classeId) => {
  const righe = await ClasseUtente.findAll({
    where: { classe_id: classeId, ruolo_nella_classe: 'studente' },
    attributes: ['utente_id'],
    raw: true,
  });
  return righe.map((r) => r.utente_id);
};

// ─────────────────────────────────────────────
// DASHBOARD DI UN'AULA
// ─────────────────────────────────────────────
const dashboardAula = async ({ classeId, richiedente, opzioni }) => {
  const classe = await Classe.findByPk(classeId);
  if (!classe) throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
  if (!(await insegnaNellaClasse(classeId, richiedente))) {
    throw new AppError('Non hai accesso a questa aula.', 403, 'FORBIDDEN');
  }

  const studentIds = await studentiDellAula(classeId);
  const dati = await calcolaDashboard(studentIds, opzioni);

  return {
    aula: { id: classe.id, nome: classe.nome, livello: classe.livello },
    ...dati,
  };
};

// ─────────────────────────────────────────────
// DASHBOARD GLOBALE
//   insegnante → unione degli studenti di tutte le sue aule;
//   admin      → tutti gli studenti della piattaforma.
// ─────────────────────────────────────────────
const dashboardGlobale = async ({ richiedente, opzioni }) => {
  let studentIds;

  if (richiedente.ruolo === 'admin') {
    const righe = await Utente.findAll({
      where: { ruolo: 'studente' },
      attributes: ['id'],
      raw: true,
    });
    studentIds = righe.map((r) => r.id);
  } else {
    const aule = await ClasseUtente.findAll({
      where: { utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
      attributes: ['classe_id'],
      raw: true,
    });
    const classeIds = aule.map((a) => a.classe_id);
    if (!classeIds.length) {
      studentIds = [];
    } else {
      const membri = await ClasseUtente.findAll({
        where: { classe_id: { [Op.in]: classeIds }, ruolo_nella_classe: 'studente' },
        attributes: ['utente_id'],
        raw: true,
      });
      studentIds = [...new Set(membri.map((m) => m.utente_id))];
    }
  }

  const dati = await calcolaDashboard(studentIds, opzioni);
  return { aula: null, ambito: richiedente.ruolo === 'admin' ? 'globale' : 'mie_aule', ...dati };
};

module.exports = {
  dashboardAula,
  dashboardGlobale,
  calcolaDashboard,
  GIORNI_FINESTRA_DEFAULT,
  GIORNI_ATTIVITA,
};
