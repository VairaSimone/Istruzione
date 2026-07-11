'use strict';

const { Op } = require('sequelize');
const NotificaEmail = require('../models/NotificaEmail');
const Utente = require('../models/Utente');
const Scuola = require('../models/Scuola');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const tipiNotifica = require('../constants/tipiNotifica');

/**
 * NotificheService — recapito EMAIL delle notifiche, in forma di DIGEST.
 *
 * Due responsabilità:
 *
 *   1. ACCODAMENTO (`accodaNotifica`): i punti di dominio (nuovo messaggio,
 *      nuovo compito, scadenza, feedback) chiamano qui invece di spedire subito
 *      un'email. La notifica viene scritta nella coda `notifiche_email` in stato
 *      `in_attesa`, rispettando le preferenze dell'utente e (dove richiesto)
 *      l'idempotenza sul riferimento.
 *
 *   2. DIGEST (`elaboraDigest`): eseguito periodicamente dallo scheduler.
 *      Per ogni utente con notifiche in attesa, raccoglie TUTTO in un'unica
 *      email di riepilogo e la spedisce, entro un TETTO massimo di email al
 *      giorno per utente e con un intervallo minimo tra due invii. Le notifiche
 *      non recapitate (tetto raggiunto, invio fallito) restano in coda per il
 *      giro successivo.
 *
 * PRINCIPIO GUIDA: nessun evento genera un'email immediata. La casella
 * dell'utente non viene mai intasata, qualunque sia il volume degli eventi.
 */

// ─────────────────────────────────────────────
// Parametri (sovrascrivibili via variabili d'ambiente)
// ─────────────────────────────────────────────

const intEnv = (chiave, predefinito) => {
  const v = parseInt(process.env[chiave], 10);
  return Number.isFinite(v) && v > 0 ? v : predefinito;
};

const boolEnv = (chiave, predefinito) => {
  const v = process.env[chiave];
  if (v === undefined || v === '') return predefinito;
  return v === 'true' || v === '1';
};

// Interruttore generale: se false, nulla viene accodato né spedito (utile in
// sviluppo o quando l'SMTP non è configurato).
const NOTIFICHE_ATTIVE = boolEnv('EMAIL_NOTIFICHE_ATTIVE', true);

// Numero massimo di email di digest recapitabili a un singolo utente in 24h.
// Questo è il "massimo 2-3 al giorno" richiesto: il DEFAULT è 3.
const MAX_EMAIL_GIORNO = intEnv('DIGEST_MAX_EMAIL_GIORNO', 3);

// Intervallo minimo (in ore) tra due digest consecutivi allo stesso utente:
// evita che i pochi slot giornalieri si consumino in pochi minuti.
const INTERVALLO_MINIMO_ORE = intEnv('DIGEST_INTERVALLO_MINIMO_ORE', 6);

// Numero massimo di righe elencate per ciascuna sezione del digest (le
// eccedenze vengono conteggiate come "e altri N…").
const MAX_RIGHE_PER_SEZIONE = intEnv('DIGEST_MAX_RIGHE_SEZIONE', 20);

// ─────────────────────────────────────────────
// Helpers interni
// ─────────────────────────────────────────────

/** Data odierna in formato ISO `YYYY-MM-DD` (coerente con DATEONLY). */
const oggiISO = () => new Date().toISOString().slice(0, 10);

/**
 * Applica il "rollover" giornaliero al contatore dei digest di un utente: se
 * l'ultimo conteggio si riferisce a un giorno diverso da oggi, lo azzera. Non
 * persiste: restituisce solo il conteggio valido per oggi.
 */
const conteggioOggi = (utente) => {
  if (utente.notifiche_digest_data === oggiISO()) {
    return utente.notifiche_digest_conteggio || 0;
  }
  return 0;
};

/** True se è trascorso l'intervallo minimo dall'ultimo digest dell'utente. */
const intervalloRispettato = (utente, ora = Date.now()) => {
  if (!utente.notifiche_ultimo_invio) return true;
  const ultimo = new Date(utente.notifiche_ultimo_invio).getTime();
  return ora - ultimo >= INTERVALLO_MINIMO_ORE * 60 * 60 * 1000;
};

// ─────────────────────────────────────────────
// ACCODAMENTO
// ─────────────────────────────────────────────

/**
 * Accoda una notifica per un utente. NON invia nulla: la notifica confluirà nel
 * prossimo digest. Rispetta le preferenze dell'utente (se ha disattivato la
 * categoria, la notifica non viene creata) e, quando è fornita la coppia di
 * riferimento con `unicaPerRiferimento`, garantisce l'idempotenza (una sola
 * notifica per (riferimento, tipo, utente)).
 *
 * L'operazione è "best effort": non deve mai far fallire l'azione di dominio che
 * l'ha invocata. Ogni errore viene loggato e assorbito.
 *
 * @param {Object}  opzioni
 * @param {string}  opzioni.utenteId
 * @param {string}  opzioni.tipo               chiave del registro tipiNotifica
 * @param {string}  opzioni.titolo
 * @param {string} [opzioni.corpo]
 * @param {string} [opzioni.link]
 * @param {string} [opzioni.scuolaId]
 * @param {string} [opzioni.riferimentoTipo]
 * @param {string} [opzioni.riferimentoId]
 * @param {boolean}[opzioni.unicaPerRiferimento=false]
 * @param {import('sequelize').Transaction} [opzioni.transaction]
 * @returns {Promise<NotificaEmail|null>} la notifica creata, o null se scartata
 */
const accodaNotifica = async ({
  utenteId,
  tipo,
  titolo,
  corpo = null,
  link = null,
  scuolaId = null,
  riferimentoTipo = null,
  riferimentoId = null,
  unicaPerRiferimento = false,
  transaction = null,
}) => {
  if (!NOTIFICHE_ATTIVE) return null;

  try {
    if (!tipiNotifica.esiste(tipo)) {
      logger.warn(`[NOTIFICHE] Tipo sconosciuto ignorato: ${tipo}`);
      return null;
    }
    if (!utenteId) return null;

    const utente = await Utente.findByPk(utenteId, {
      attributes: ['id', 'stato', 'email', 'preferenze_notifiche'],
      transaction,
    });
    // Solo account attivi con un indirizzo email ricevono notifiche.
    if (!utente || utente.stato !== 'attivo' || !utente.email) return null;

    // Rispetta le preferenze dell'utente (interruttore generale + categoria).
    if (!tipiNotifica.vuoleRicevere(utente.preferenze_notifiche, tipo)) return null;

    // Idempotenza: non riaccodare lo stesso evento per lo stesso destinatario.
    if (unicaPerRiferimento && riferimentoTipo && riferimentoId) {
      const esistente = await NotificaEmail.findOne({
        where: {
          utente_id: utenteId,
          tipo,
          riferimento_tipo: riferimentoTipo,
          riferimento_id: riferimentoId,
        },
        attributes: ['id'],
        transaction,
      });
      if (esistente) return null;
    }

    const notifica = await NotificaEmail.create(
      {
        utente_id: utenteId,
        scuola_id: scuolaId,
        tipo,
        titolo: String(titolo || '').slice(0, 200),
        corpo: corpo != null ? String(corpo).slice(0, 500) : null,
        link: link != null ? String(link).slice(0, 500) : null,
        riferimento_tipo: riferimentoTipo,
        riferimento_id: riferimentoId,
        stato: 'in_attesa',
      },
      { transaction }
    );
    return notifica;
  } catch (err) {
    // Una notifica non deve MAI compromettere l'operazione principale.
    logger.error(`[NOTIFICHE] Accodamento fallito (tipo=${tipo}, utente=${utenteId}): ${err.message}`);
    return null;
  }
};

/**
 * Accoda la stessa notifica a più destinatari. Comodo per i messaggi d'aula e i
 * compiti assegnati a una classe. Restituisce il numero di notifiche create.
 *
 * PERFORMANCE: versione BATCH, priva del problema N+1. A prescindere dal numero
 * di destinatari esegue al massimo:
 *   - 1 SELECT   per recuperare tutti gli utenti coinvolti (`findAll`);
 *   - 1 SELECT   (solo se `unicaPerRiferimento`) per l'idempotenza di gruppo;
 *   - 1 INSERT   per creare tutte le notifiche in blocco (`bulkCreate`).
 * Il filtraggio (account attivo, email presente, preferenza attiva) avviene in
 * memoria sui dati già caricati, senza ulteriori query per-utente.
 *
 * Come `accodaNotifica`, è "best effort": non deve mai far fallire l'azione di
 * dominio che l'ha invocata. Ogni errore viene loggato e assorbito.
 */
const accodaNotificaMulti = async ({
  utenteIds,
  tipo,
  titolo,
  corpo = null,
  link = null,
  scuolaId = null,
  riferimentoTipo = null,
  riferimentoId = null,
  unicaPerRiferimento = false,
  transaction = null,
}) => {
  if (!NOTIFICHE_ATTIVE) return 0;
  if (!Array.isArray(utenteIds) || !utenteIds.length) return 0;

  try {
    if (!tipiNotifica.esiste(tipo)) {
      logger.warn(`[NOTIFICHE] Tipo sconosciuto ignorato: ${tipo}`);
      return 0;
    }

    const unici = [...new Set(utenteIds.map(String))];

    // 1. UNA sola query per TUTTI i destinatari (elimina l'N+1).
    const utenti = await Utente.findAll({
      where: { id: { [Op.in]: unici } },
      attributes: ['id', 'stato', 'email', 'preferenze_notifiche'],
      transaction,
    });

    // 2. Filtro in memoria: solo account attivi, con email, che desiderano
    //    ricevere questa categoria di notifica.
    let destinatari = utenti
      .filter(
        (u) =>
          u.stato === 'attivo' &&
          u.email &&
          tipiNotifica.vuoleRicevere(u.preferenze_notifiche, tipo)
      )
      .map((u) => String(u.id));

    if (!destinatari.length) return 0;

    // 3. Idempotenza opzionale: UNA sola query scopre quali destinatari hanno
    //    già una notifica per questo (riferimento, tipo), così da non duplicarla.
    if (unicaPerRiferimento && riferimentoTipo && riferimentoId) {
      const esistenti = await NotificaEmail.findAll({
        where: {
          utente_id: { [Op.in]: destinatari },
          tipo,
          riferimento_tipo: riferimentoTipo,
          riferimento_id: riferimentoId,
        },
        attributes: ['utente_id'],
        transaction,
        raw: true,
      });
      const gia = new Set(esistenti.map((r) => String(r.utente_id)));
      destinatari = destinatari.filter((id) => !gia.has(id));
      if (!destinatari.length) return 0;
    }

    // 4. UNA sola INSERT per tutte le notifiche.
    const titoloOk = String(titolo || '').slice(0, 200);
    const corpoOk = corpo != null ? String(corpo).slice(0, 500) : null;
    const linkOk = link != null ? String(link).slice(0, 500) : null;

    const righe = destinatari.map((utenteId) => ({
      utente_id: utenteId,
      scuola_id: scuolaId,
      tipo,
      titolo: titoloOk,
      corpo: corpoOk,
      link: linkOk,
      riferimento_tipo: riferimentoTipo,
      riferimento_id: riferimentoId,
      stato: 'in_attesa',
    }));

    await NotificaEmail.bulkCreate(righe, { transaction });
    return righe.length;
  } catch (err) {
    // Una notifica non deve MAI compromettere l'operazione principale.
    logger.error(`[NOTIFICHE] Accodamento multiplo fallito (tipo=${tipo}): ${err.message}`);
    return 0;
  }
};

// ─────────────────────────────────────────────
// DIGEST
// ─────────────────────────────────────────────

/**
 * Costruisce le sezioni del digest a partire dalle notifiche in attesa: le
 * raggruppa per tipo, le ordina secondo il registro e taglia ogni sezione a
 * MAX_RIGHE_PER_SEZIONE (conteggiando l'eccedenza).
 */
const componiSezioni = (notifiche) => {
  const perTipo = new Map();
  for (const n of notifiche) {
    if (!perTipo.has(n.tipo)) perTipo.set(n.tipo, []);
    perTipo.get(n.tipo).push(n);
  }

  const sezioni = [];
  for (const descr of tipiNotifica.TIPI_NOTIFICA) {
    const righe = perTipo.get(descr.chiave);
    if (!righe || !righe.length) continue;

    const totale = righe.length;
    const mostrate = righe.slice(0, MAX_RIGHE_PER_SEZIONE).map((n) => ({
      titolo: n.titolo,
      corpo: n.corpo,
      link: n.link,
    }));

    sezioni.push({
      tipo: descr.chiave,
      i18nSezione: descr.i18nSezione,
      ordine: descr.ordine,
      totale,
      eccedenza: Math.max(0, totale - mostrate.length),
      righe: mostrate,
    });
  }

  sezioni.sort((a, b) => a.ordine - b.ordine);
  return sezioni;
};

/**
 * Elabora il digest di UN utente: verifica tetto giornaliero e intervallo
 * minimo, compone e invia l'email, poi marca le notifiche come inviate e
 * aggiorna i contatori. Se il tetto è raggiunto o l'intervallo non è ancora
 * trascorso, non fa nulla (le notifiche restano in coda).
 *
 * @returns {Promise<'inviato'|'tetto'|'intervallo'|'vuoto'|'errore'>}
 */
const elaboraDigestUtente = async (utenteId) => {
  const utente = await Utente.findByPk(utenteId);
  if (!utente || utente.stato !== 'attivo' || !utente.email) return 'vuoto';

  const notifiche = await NotificaEmail.findAll({
    where: { utente_id: utenteId, stato: 'in_attesa' },
    order: [['created_at', 'ASC']],
  });
  if (!notifiche.length) return 'vuoto';

  // Interruttore generale disattivato a posteriori: chiudi la coda senza inviare.
  if (!tipiNotifica.normalizzaPreferenze(utente.preferenze_notifiche).emailAttive) {
    await NotificaEmail.update(
      { stato: 'annullata' },
      { where: { utente_id: utenteId, stato: 'in_attesa' } }
    );
    return 'vuoto';
  }

  if (!intervalloRispettato(utente)) return 'intervallo';
  if (conteggioOggi(utente) >= MAX_EMAIL_GIORNO) return 'tetto';

  // Nome della scuola per il mittente/branding (best effort).
  let nomeScuola = null;
  if (utente.scuola_id) {
    const scuola = await Scuola.findByPk(utente.scuola_id, { attributes: ['nome'] });
    nomeScuola = scuola ? scuola.nome : null;
  }

  const sezioni = componiSezioni(notifiche);

  try {
    await emailService.sendDigestEmail(utente.email, {
      nomeScuola,
      sezioni,
      totale: notifiche.length,
      lingua: utente.lingua || 'it',
    });
  } catch (err) {
    // Invio fallito: NON marcare come inviate, non incrementare il contatore.
    // Le notifiche resteranno in coda per il prossimo giro.
    logger.error(`[NOTIFICHE] Invio digest fallito per ${utente.email}: ${err.message}`);
    return 'errore';
  }

  const ora = new Date();
  const ids = notifiche.map((n) => n.id);
  await NotificaEmail.update(
    { stato: 'inviata', inviata_il: ora },
    { where: { id: { [Op.in]: ids } } }
  );

  // Aggiorna i contatori del digest (con rollover giornaliero).
  const conteggio = conteggioOggi(utente) + 1;
  utente.notifiche_digest_data = oggiISO();
  utente.notifiche_digest_conteggio = conteggio;
  utente.notifiche_ultimo_invio = ora;
  await utente.save();

  logger.info(
    `[NOTIFICHE] Digest inviato a ${utente.email}: ${notifiche.length} notifiche (${conteggio}/${MAX_EMAIL_GIORNO} oggi)`
  );
  return 'inviato';
};

/**
 * Elabora il digest per TUTTI gli utenti che hanno notifiche in attesa.
 * Eseguito periodicamente dallo scheduler. Ritorna un riepilogo dei conteggi.
 */
const elaboraDigest = async () => {
  if (!NOTIFICHE_ATTIVE) return { attive: false };

  // Utenti DISTINTI con almeno una notifica in attesa.
  const righe = await NotificaEmail.findAll({
    where: { stato: 'in_attesa' },
    attributes: ['utente_id'],
    group: ['utente_id'],
    raw: true,
  });
  const utenteIds = righe.map((r) => r.utente_id);

  const esiti = { inviato: 0, tetto: 0, intervallo: 0, vuoto: 0, errore: 0 };
  for (const utenteId of utenteIds) {
    try {
      const esito = await elaboraDigestUtente(utenteId);
      esiti[esito] = (esiti[esito] || 0) + 1;
    } catch (err) {
      esiti.errore += 1;
      logger.error(`[NOTIFICHE] Errore digest utente ${utenteId}: ${err.message}`);
    }
  }

  if (utenteIds.length) {
    logger.info(
      `[NOTIFICHE] Digest completato: ${esiti.inviato} inviati, ${esiti.tetto} a tetto, ` +
        `${esiti.intervallo} in attesa di intervallo, ${esiti.errore} errori`
    );
  }
  return { attive: true, utenti: utenteIds.length, ...esiti };
};

// ─────────────────────────────────────────────
// PREFERENZE UTENTE
// ─────────────────────────────────────────────

/** Legge le preferenze notifiche di un utente, complete dei default. */
const leggiPreferenze = async (utenteId) => {
  const utente = await Utente.findByPk(utenteId, {
    attributes: ['id', 'preferenze_notifiche'],
  });
  if (!utente) return null;
  return tipiNotifica.normalizzaPreferenze(utente.preferenze_notifiche);
};

/** Aggiorna (normalizzandole) le preferenze notifiche di un utente. */
const aggiornaPreferenze = async (utenteId, blob) => {
  const utente = await Utente.findByPk(utenteId);
  if (!utente) return null;
  const normalizzate = tipiNotifica.normalizzaPreferenze(blob);
  utente.preferenze_notifiche = normalizzate;
  await utente.save();
  return normalizzate;
};

module.exports = {
  accodaNotifica,
  accodaNotificaMulti,
  elaboraDigest,
  elaboraDigestUtente,
  leggiPreferenze,
  aggiornaPreferenze,
  // Parametri esposti per test/diagnostica.
  MAX_EMAIL_GIORNO,
  INTERVALLO_MINIMO_ORE,
};
