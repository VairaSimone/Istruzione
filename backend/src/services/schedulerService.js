'use strict';

const { Op } = require('sequelize');
const Compito = require('../models/Compito');
const CompitoAssegnazione = require('../models/CompitoAssegnazione');
const CompitoConsegna = require('../models/CompitoConsegna');
const ClasseUtente = require('../models/ClasseUtente');
const notificheService = require('./notificheService');
const userService = require('./userService');
const logger = require('../utils/logger');

/**
 * SchedulerService — job periodici in-process, SENZA dipendenze esterne.
 *
 * Due compiti ricorrenti:
 *
 *   1. DIGEST NOTIFICHE — a intervalli regolari raccoglie le notifiche in coda e
 *      spedisce a ogni utente un'unica email di riepilogo (entro il tetto
 *      giornaliero). Cfr. `notificheService.elaboraDigest`.
 *
 *   2. SCANSIONE SCADENZE — periodicamente cerca i compiti pubblicati in
 *      scadenza entro la finestra di preavviso e accoda una notifica
 *      `scadenza_compito` per ogni studente destinatario che non ha ancora
 *      consegnato. L'accodamento è IDEMPOTENTE (una sola notifica di scadenza
 *      per compito+studente), così la ripetizione del giro non genera duplicati.
 *
 * ┌─ NOTA sul deploy multi-istanza ─────────────────────────────────────────┐
 * │ Lo scheduler gira nel processo del server: con PIÙ istanze del backend    │
 * │ ognuna eseguirebbe i job. Per i digest il rischio è mitigato (le notifiche │
 * │ vengono marcate `inviata` in blocco: una seconda istanza troverebbe la     │
 * │ coda vuota), ma la scelta più pulita in quel caso è eseguire i job in un    │
 * │ solo processo (worker dedicato) oppure con un lock condiviso (es. Redis).  │
 * │ Per il deploy MONO-ISTANZA tipico di questa piattaforma è sufficiente così.│
 * └────────────────────────────────────────────────────────────────────────┘
 */

const MINUTO = 60 * 1000;

const intEnv = (chiave, predefinito) => {
  const v = parseInt(process.env[chiave], 10);
  return Number.isFinite(v) && v > 0 ? v : predefinito;
};

const boolEnv = (chiave, predefinito) => {
  const v = process.env[chiave];
  if (v === undefined || v === '') return predefinito;
  return v === 'true' || v === '1';
};

// Attivazione dello scheduler (spegnibile in sviluppo o nei worker separati).
const SCHEDULER_ATTIVO = boolEnv('NOTIFICHE_SCHEDULER_ATTIVO', true);

// Cadenza del giro di digest (minuti). Default 4 ore: con il tetto di 2-3
// email/giorno per utente, i digest risultano ben distanziati.
const DIGEST_OGNI_MINUTI = intEnv('DIGEST_INTERVALLO_MINUTI', 240);

// Cadenza della scansione scadenze (minuti). Default 12 ore.
const SCADENZE_OGNI_MINUTI = intEnv('SCADENZE_INTERVALLO_MINUTI', 720);

// Finestra di preavviso: un compito è "in scadenza" se scade entro queste ore.
const SCADENZA_PREAVVISO_ORE = intEnv('SCADENZA_COMPITO_PREAVVISO_ORE', 48);

// Cadenza del giro di retention (minuti). Default 24 ore: purga account con
// cancellazione richiesta oltre il periodo di grazia e notifiche email vecchie.
const RETENTION_OGNI_MINUTI = intEnv('RETENTION_INTERVALLO_MINUTI', 1440);

// Ritardo prima del PRIMO giro dopo l'avvio, per non gravare sul bootstrap.
const RITARDO_INIZIALE_MINUTI = intEnv('SCHEDULER_RITARDO_INIZIALE_MINUTI', 1);

// Riferimenti dei timer, per un arresto pulito.
let timerDigest = null;
let timerScadenze = null;
let timerRetention = null;

// ─────────────────────────────────────────────
// SCANSIONE SCADENZE COMPITI
// ─────────────────────────────────────────────

/**
 * Risolve l'insieme DISTINTO degli id studente destinatari di un compito:
 * studenti delle aule assegnate ∪ studenti assegnati direttamente.
 * (Equivalente a `compitiService.risolviDestinatari`, replicato qui senza
 * transazione per non accoppiare i due service.)
 */
const destinatariDiCompito = async (compitoId) => {
  const assegnazioni = await CompitoAssegnazione.findAll({
    where: { compito_id: compitoId },
    attributes: ['classe_id', 'utente_id'],
    raw: true,
  });

  const classeIds = assegnazioni.filter((a) => a.classe_id).map((a) => a.classe_id);
  const studentIds = new Set(assegnazioni.filter((a) => a.utente_id).map((a) => a.utente_id));

  if (classeIds.length) {
    const membri = await ClasseUtente.findAll({
      where: { classe_id: { [Op.in]: classeIds }, ruolo_nella_classe: 'studente' },
      attributes: ['utente_id'],
      raw: true,
    });
    for (const m of membri) studentIds.add(m.utente_id);
  }

  return [...studentIds];
};

/**
 * Formatta una data di scadenza in modo leggibile per il corpo della notifica.
 * (Formato neutro, indipendente dalla lingua: data + ora in locale del server.)
 */
const formattaScadenza = (data) => {
  try {
    return new Date(data).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(data);
  }
};

/**
 * Accoda le notifiche di scadenza per i compiti pubblicati in scadenza entro la
 * finestra di preavviso. Idempotente: ogni compito+studente riceve al più una
 * notifica di scadenza.
 */
const scansionaScadenze = async () => {
  const ora = new Date();
  const limite = new Date(ora.getTime() + SCADENZA_PREAVVISO_ORE * 60 * 60 * 1000);

  const compiti = await Compito.findAll({
    where: {
      stato: 'pubblicato',
      data_scadenza: { [Op.gt]: ora, [Op.lte]: limite },
    },
  });
  if (!compiti.length) return { compiti: 0, notifiche: 0 };

  let totaleNotifiche = 0;

  for (const compito of compiti) {
    const studentIds = await destinatariDiCompito(compito.id);
    if (!studentIds.length) continue;

    // Esclude chi ha già consegnato: non ha senso ricordargli la scadenza.
    const consegne = await CompitoConsegna.findAll({
      where: { compito_id: compito.id, utente_id: { [Op.in]: studentIds } },
      attributes: ['utente_id'],
      raw: true,
    });
    const consegnato = new Set(consegne.map((c) => String(c.utente_id)));
    const daNotificare = studentIds.filter((id) => !consegnato.has(String(id)));
    if (!daNotificare.length) continue;

    const scadenzaLeggibile = formattaScadenza(compito.data_scadenza);

    for (const utenteId of daNotificare) {
      const notifica = await notificheService.accodaNotifica({
        utenteId,
        tipo: 'scadenza_compito',
        titolo: compito.titolo,
        corpo: `In scadenza il ${scadenzaLeggibile}`,
        link: `/studente/compiti/${compito.id}`,
        scuolaId: compito.scuola_id ?? null,
        riferimentoTipo: 'compito',
        riferimentoId: compito.id,
        unicaPerRiferimento: true, // una sola notifica di scadenza per compito+studente
      });
      if (notifica) totaleNotifiche += 1;
    }
  }

  if (totaleNotifiche) {
    logger.info(
      `[SCHEDULER] Scansione scadenze: ${totaleNotifiche} notifiche accodate su ${compiti.length} compiti`
    );
  }
  return { compiti: compiti.length, notifiche: totaleNotifiche };
};

// ─────────────────────────────────────────────
// ESECUZIONE PROTETTA (un errore in un job non deve fermare lo scheduler)
// ─────────────────────────────────────────────
const eseguiProtetto = async (nome, fn) => {
  try {
    await fn();
  } catch (err) {
    logger.error(`[SCHEDULER] Errore nel job "${nome}": ${err.message}`, { stack: err.stack });
  }
};

// ─────────────────────────────────────────────
// AVVIO / ARRESTO
// ─────────────────────────────────────────────

/**
 * Avvia i job periodici. Idempotente: chiamate ripetute non creano timer
 * duplicati. Il primo giro parte dopo un breve ritardo per non gravare sul
 * bootstrap del server.
 */
const avvia = () => {
  if (!SCHEDULER_ATTIVO) {
    logger.info('[SCHEDULER] Disattivato (NOTIFICHE_SCHEDULER_ATTIVO=false).');
    return;
  }
  if (timerDigest || timerScadenze || timerRetention) return; // già avviato

  logger.info(
    `[SCHEDULER] Avvio — digest ogni ${DIGEST_OGNI_MINUTI} min, ` +
      `scadenze ogni ${SCADENZE_OGNI_MINUTI} min (preavviso ${SCADENZA_PREAVVISO_ORE}h), ` +
      `retention ogni ${RETENTION_OGNI_MINUTI} min.`
  );

  // Primo giro ritardato, poi a intervalli regolari.
  setTimeout(() => {
    eseguiProtetto('scansionaScadenze', scansionaScadenze).then(() =>
      eseguiProtetto('elaboraDigest', notificheService.elaboraDigest)
    );
    eseguiProtetto('retention', userService.eseguiRetention);

    timerScadenze = setInterval(
      () => eseguiProtetto('scansionaScadenze', scansionaScadenze),
      SCADENZE_OGNI_MINUTI * MINUTO
    );
    timerDigest = setInterval(
      () => eseguiProtetto('elaboraDigest', notificheService.elaboraDigest),
      DIGEST_OGNI_MINUTI * MINUTO
    );
    timerRetention = setInterval(
      () => eseguiProtetto('retention', userService.eseguiRetention),
      RETENTION_OGNI_MINUTI * MINUTO
    );

    // I timer non devono tenere vivo il processo durante lo shutdown.
    if (timerScadenze.unref) timerScadenze.unref();
    if (timerDigest.unref) timerDigest.unref();
    if (timerRetention.unref) timerRetention.unref();
  }, RITARDO_INIZIALE_MINUTI * MINUTO);
};

/** Arresta i job (usato dal graceful shutdown e nei test). */
const arresta = () => {
  if (timerDigest) clearInterval(timerDigest);
  if (timerScadenze) clearInterval(timerScadenze);
  if (timerRetention) clearInterval(timerRetention);
  timerDigest = null;
  timerScadenze = null;
  timerRetention = null;
};

module.exports = {
  avvia,
  arresta,
  // Esposti per esecuzione manuale/test.
  scansionaScadenze,
};
