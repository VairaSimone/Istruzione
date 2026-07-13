'use strict';

/**
 * BANCHE DATI (motore `banca`) — registro delle sorgenti dei quiz "a banca".
 *
 * Una BANCA DATI è un insieme statico di voci (fatti verificabili: codici HTTP,
 * verbi irregolari, elementi chimici, capitali…) su cui il motore `banca`
 * costruisce quiz a scelta multipla. È l'analogo generico di `kanjiData`: la
 * FONTE DI VERITÀ del backend, mai contenuti inventati a runtime.
 *
 * Ogni banca è un modulo con questa forma:
 *   {
 *     codice,                       // identificatore univoco della banca
 *     materia, categoria,           // classificazione (ereditata dai quiz)
 *     nome: {it,en}, descrizione,   // testi localizzati
 *     campi: { <campo>: {it,en} },  // etichette dei campi di una voce
 *     modalita: [                   // direzioni di interrogazione
 *       { codice, promptCampo, rispostaCampo, nome:{it,en}, istruzione:{it,en} }
 *     ],
 *     sezioni: [ { codice, nome:{it,en} } ],   // raggruppamenti (livelli/temi)
 *     voci: [ { id, sezione, campi:{...}, spiegazione?:{it,en} } ]
 *   }
 *
 * INVARIANTI (verificate al caricamento, fail-fast):
 *   - ogni `id` di voce è GLOBALMENTE univoco (chiave del progresso SRS, che non
 *     porta con sé il codice banca: l'unicità globale evita collisioni);
 *   - la `sezione` di ogni voce esiste tra le `sezioni` della banca;
 *   - ogni `modalita` referenzia campi esistenti in `campi`;
 *   - almeno una modalità e almeno una voce per banca.
 *
 * COME AGGIUNGERE UNA BANCA:
 *   1. creare `bancaData/<nome>.js` seguendo la forma qui sopra;
 *   2. importarlo nel vettore `MODULI` in fondo;
 *   3. registrare il template corrispondente in `constants/quizTemplates`.
 * Nessuna migrazione: i progressi vivono nella tabella generica `progressi_banca`.
 */

// ─────────────────────────────────────────────
// Normalizzazione di una banca (forma + invarianti)
// ─────────────────────────────────────────────
const localizza = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { it: v.it || v.en || '', en: v.en || v.it || '' };
  }
  const s = v == null ? '' : String(v);
  return { it: s, en: s };
};

const caricaBanca = (mod, idsGlobali) => {
  if (!mod || typeof mod !== 'object') {
    throw new Error('[bancaData] modulo banca non valido.');
  }
  const { codice } = mod;
  if (!codice || typeof codice !== 'string') {
    throw new Error('[bancaData] ogni banca deve avere un `codice` stringa.');
  }

  const campi = mod.campi && typeof mod.campi === 'object' ? mod.campi : {};
  const nomiCampi = Object.keys(campi);

  const modalita = Array.isArray(mod.modalita) ? mod.modalita : [];
  if (modalita.length === 0) {
    throw new Error(`[bancaData:${codice}] almeno una modalità è richiesta.`);
  }
  for (const m of modalita) {
    if (!m.codice || !nomiCampi.includes(m.promptCampo) || !nomiCampi.includes(m.rispostaCampo)) {
      throw new Error(
        `[bancaData:${codice}] modalità "${m && m.codice}" referenzia campi inesistenti.`
      );
    }
    if (m.promptCampo === m.rispostaCampo) {
      throw new Error(`[bancaData:${codice}] modalità "${m.codice}": prompt e risposta coincidono.`);
    }
  }

  const sezioni = Array.isArray(mod.sezioni) ? mod.sezioni : [];
  const codiciSezione = new Set(sezioni.map((s) => s.codice));

  const voci = Array.isArray(mod.voci) ? mod.voci : [];
  if (voci.length === 0) {
    throw new Error(`[bancaData:${codice}] almeno una voce è richiesta.`);
  }

  for (const voce of voci) {
    if (!voce.id || typeof voce.id !== 'string') {
      throw new Error(`[bancaData:${codice}] ogni voce deve avere un id stringa.`);
    }
    if (idsGlobali.has(voce.id)) {
      throw new Error(`[bancaData] id voce duplicato globalmente: "${voce.id}".`);
    }
    idsGlobali.add(voce.id);
    if (sezioni.length > 0 && !codiciSezione.has(voce.sezione)) {
      throw new Error(`[bancaData:${codice}] voce "${voce.id}" ha sezione sconosciuta "${voce.sezione}".`);
    }
    if (!voce.campi || typeof voce.campi !== 'object') {
      throw new Error(`[bancaData:${codice}] voce "${voce.id}" senza campi.`);
    }
  }

  return {
    codice,
    materia: mod.materia || null,
    categoria: mod.categoria || null,
    nome: localizza(mod.nome || codice),
    descrizione: localizza(mod.descrizione || ''),
    lingua: mod.lingua || null,
    licenza: mod.licenza || null,
    campi: Object.fromEntries(nomiCampi.map((c) => [c, localizza(campi[c])])),
    modalita: modalita.map((m) => ({
      codice: m.codice,
      promptCampo: m.promptCampo,
      rispostaCampo: m.rispostaCampo,
      nome: localizza(m.nome || m.codice),
      istruzione: localizza(m.istruzione || ''),
    })),
    sezioni: sezioni.map((s) => ({ codice: s.codice, nome: localizza(s.nome || s.codice) })),
    voci: voci.map((v) => ({
      id: v.id,
      sezione: v.sezione || null,
      campi: { ...v.campi },
      spiegazione: v.spiegazione ? localizza(v.spiegazione) : null,
    })),
  };
};

// ─────────────────────────────────────────────
// Registro
// ─────────────────────────────────────────────
const MODULI = [
  require('./webdev'),
  require('./ingleseVerbi'),
  require('./chimica'),
  require('./geografia'),
  require('./matematicaSimboli'),
  require('./cineseHsk1'),
];

/** @type {Map<string, object>} codice banca → banca normalizzata */
const MAPPA_BANCHE = new Map();
/** @type {Map<string, {voce:object, banca:object}>} id voce → voce + banca */
const MAPPA_VOCI = new Map();

const _idsGlobali = new Set();
for (const mod of MODULI) {
  const banca = caricaBanca(mod, _idsGlobali);
  if (MAPPA_BANCHE.has(banca.codice)) {
    throw new Error(`[bancaData] codice banca duplicato: "${banca.codice}".`);
  }
  MAPPA_BANCHE.set(banca.codice, banca);
  for (const voce of banca.voci) {
    MAPPA_VOCI.set(voce.id, { voce, banca });
  }
}

const CODICI_BANCA = Array.from(MAPPA_BANCHE.keys());

// ─────────────────────────────────────────────
// Helpers pubblici
// ─────────────────────────────────────────────

/** Banca normalizzata o `null`. */
const trovaBanca = (codice) => MAPPA_BANCHE.get(codice) || null;

/** { voce, banca } dell'id, o `null` se sconosciuto (validazione difensiva SRS). */
const trovaVoce = (voceId) => MAPPA_VOCI.get(voceId) || null;

/** Descrittore della modalità (o `null`) di una banca. */
const trovaModalita = (banca, codiceModalita) =>
  (banca && banca.modalita.find((m) => m.codice === codiceModalita)) || null;

/**
 * Voci candidate di una banca, filtrate per sezioni e per la presenza di
 * ENTRAMBI i campi (prompt e risposta) non vuoti nella modalità scelta.
 *
 * @param {object} banca      banca normalizzata
 * @param {object} modalita   descrittore modalità
 * @param {string[]} [sezioni] sottoinsieme di codici sezione (vuoto = tutte)
 */
const vociCandidate = (banca, modalita, sezioni = []) => {
  const filtroSezioni = Array.isArray(sezioni) && sezioni.length > 0 ? new Set(sezioni) : null;
  return banca.voci.filter((v) => {
    if (filtroSezioni && !filtroSezioni.has(v.sezione)) return false;
    const p = v.campi[modalita.promptCampo];
    const r = v.campi[modalita.rispostaCampo];
    return p != null && String(p) !== '' && r != null && String(r) !== '';
  });
};

/** Catalogo pubblico (metadati) di una banca, per costruire la UI di configurazione. */
const catalogoBanca = (codice) => {
  const banca = trovaBanca(codice);
  if (!banca) return null;
  return {
    codice: banca.codice,
    materia: banca.materia,
    categoria: banca.categoria,
    nome: banca.nome,
    descrizione: banca.descrizione,
    lingua: banca.lingua,
    licenza: banca.licenza,
    campi: banca.campi,
    modalita: banca.modalita.map((m) => ({
      codice: m.codice,
      nome: m.nome,
      istruzione: m.istruzione,
    })),
    sezioni: banca.sezioni.map((s) => ({ codice: s.codice, nome: s.nome })),
    totaleVoci: banca.voci.length,
  };
};

module.exports = {
  CODICI_BANCA,
  MAPPA_BANCHE,
  trovaBanca,
  trovaVoce,
  trovaModalita,
  vociCandidate,
  catalogoBanca,
};
