'use strict';

const { Op } = require('sequelize');
const Scuola = require('../models/Scuola');
const Utente = require('../models/Utente');
const Invito = require('../models/Invito');
const FileCaricato = require('../models/FileCaricato');
const AppError = require('../utils/AppError');

/**
 * QuotaService — misura e fa RISPETTARE le quote di una scuola (tenant).
 *
 * Tre quote, tutte impostate dall'ADMIN (colonne su `scuole`, NULL = illimitato):
 *   - STORAGE     → byte occupati dai file caricati (video/immagini/documenti);
 *   - UTENTI      → utenti totali (studenti + insegnanti) della scuola;
 *   - INSEGNANTI  → sotto-limite sul numero di insegnanti.
 *
 * DOVE si applica l'enforcement:
 *   - lo STORAGE è verificato DOPO che multer ha scritto il file su disco, ma
 *     PRIMA di persistere la riga `file_caricati` (cfr. middleware/quotaStorage):
 *     se il file sforerebbe la quota, il binario appena scritto viene rimosso e
 *     la richiesta respinta con 413.
 *   - UTENTI/INSEGNANTI sono verificati alla CREAZIONE DELL'INVITO (inviteService):
 *     è il punto in cui nasce un nuovo posto occupato. Per evitare di
 *     "sovra-prenotare", nel conteggio rientrano sia gli utenti già registrati
 *     sia gli INVITI ancora pendenti e non scaduti.
 *
 * Nota sui conteggi: l'admin ha `scuola_id = null` e quindi non entra MAI nei
 * conteggi di alcuna scuola (non occupa posti).
 */

// ─────────────────────────────────────────────
// MISURE (sola lettura)
// ─────────────────────────────────────────────

/** Byte occupati dai file della scuola (tutti i tipi). 0 se nessun file. */
const storageUsatoByte = async (scuolaId) => {
  if (!scuolaId) return 0;
  // SUM su colonna indicizzata per scuola. Restituisce null se non ci sono righe.
  const somma = await FileCaricato.sum('dimensione_byte', { where: { scuola_id: scuolaId } });
  return Number(somma || 0);
};

/** Numero di utenti (studenti + insegnanti) della scuola. */
const utentiUsati = async (scuolaId) => {
  if (!scuolaId) return 0;
  return Utente.count({
    where: { scuola_id: scuolaId, ruolo: { [Op.in]: ['studente', 'insegnante'] } },
  });
};

/** Numero di insegnanti della scuola. */
const insegnantiUsati = async (scuolaId) => {
  if (!scuolaId) return 0;
  return Utente.count({ where: { scuola_id: scuolaId, ruolo: 'insegnante' } });
};

/** Inviti pendenti e non scaduti della scuola (opzionalmente per ruolo). */
const invitiPendenti = async (scuolaId, ruolo = null) => {
  if (!scuolaId) return 0;
  const where = {
    scuola_id: scuolaId,
    stato: 'pendente',
    scadenza: { [Op.gt]: new Date() },
  };
  if (ruolo) where.ruolo = ruolo;
  return Invito.count({ where });
};

/**
 * Riepilogo completo delle quote di una scuola: quanto è usato, quale il limite,
 * se è illimitato. Include i posti "prenotati" dagli inviti pendenti.
 *
 * @param {Scuola|string} scuolaOId  istanza o id della scuola
 * @returns {Promise<object>} { storage, utenti, insegnanti }
 */
const riepilogo = async (scuolaOId) => {
  const scuola =
    scuolaOId && typeof scuolaOId === 'object' ? scuolaOId : await Scuola.findByPk(scuolaOId);
  if (!scuola) throw new AppError('Scuola non trovata.', 404, 'SCUOLA_NOT_FOUND');

  const scuolaId = scuola.id;
  const limiteStorage =
    scuola.limite_storage_byte === null || scuola.limite_storage_byte === undefined
      ? null
      : Number(scuola.limite_storage_byte);
  const limiteUtenti =
    scuola.limite_utenti === null || scuola.limite_utenti === undefined
      ? null
      : Number(scuola.limite_utenti);
  const limiteInsegnanti =
    scuola.limite_insegnanti === null || scuola.limite_insegnanti === undefined
      ? null
      : Number(scuola.limite_insegnanti);

  const [usatoByte, utenti, insegnanti, pendentiTot, pendentiIns] = await Promise.all([
    storageUsatoByte(scuolaId),
    utentiUsati(scuolaId),
    insegnantiUsati(scuolaId),
    invitiPendenti(scuolaId),
    invitiPendenti(scuolaId, 'insegnante'),
  ]);

  const percentuale = (usato, limite) =>
    limite === null || limite <= 0 ? null : Math.min(100, Math.round((usato / limite) * 100));

  return {
    storage: {
      usatoByte,
      usatoGb: usatoByte / Scuola.BYTE_PER_GB,
      limiteByte: limiteStorage,
      limiteGb: limiteStorage === null ? null : limiteStorage / Scuola.BYTE_PER_GB,
      illimitato: limiteStorage === null,
      percentuale: percentuale(usatoByte, limiteStorage),
    },
    utenti: {
      usati: utenti,
      pendenti: pendentiTot,
      occupati: utenti + pendentiTot,
      limite: limiteUtenti,
      illimitato: limiteUtenti === null,
      percentuale: percentuale(utenti + pendentiTot, limiteUtenti),
    },
    insegnanti: {
      usati: insegnanti,
      pendenti: pendentiIns,
      occupati: insegnanti + pendentiIns,
      limite: limiteInsegnanti,
      illimitato: limiteInsegnanti === null,
      percentuale: percentuale(insegnanti + pendentiIns, limiteInsegnanti),
    },
  };
};

// ─────────────────────────────────────────────
// ENFORCEMENT
// ─────────────────────────────────────────────

/**
 * Verifica che caricare `dimensioneByte` non sfori la quota storage della scuola.
 * @throws {AppError} 413 QUOTA_STORAGE se lo spazio residuo è insufficiente.
 */
const assicuraSpazioStorage = async (scuola, dimensioneByte) => {
  const limite =
    scuola && scuola.limite_storage_byte !== null && scuola.limite_storage_byte !== undefined
      ? Number(scuola.limite_storage_byte)
      : null;
  if (limite === null) return; // illimitato

  const usato = await storageUsatoByte(scuola.id);
  const richiesto = Number(dimensioneByte || 0);
  if (usato + richiesto > limite) {
    const residuoMb = Math.max(0, (limite - usato) / (1024 * 1024));
    throw new AppError(
      `Spazio di archiviazione della scuola esaurito: restano circa ${residuoMb.toFixed(
        1
      )} MB. Contatta l'amministratore per aumentare la quota.`,
      413,
      'QUOTA_STORAGE'
    );
  }
};

/**
 * Verifica che ci sia posto per un nuovo utente del ruolo indicato prima di
 * creare un invito. Considera utenti registrati + inviti pendenti (non scaduti).
 *
 * @param {Scuola} scuola  istanza della scuola di destinazione
 * @param {'studente'|'insegnante'} ruolo
 * @throws {AppError} 409 QUOTA_UTENTI | QUOTA_INSEGNANTI
 */
const assicuraPostoUtente = async (scuola, ruolo) => {
  if (!scuola) return;

  const limiteUtenti =
    scuola.limite_utenti === null || scuola.limite_utenti === undefined
      ? null
      : Number(scuola.limite_utenti);
  const limiteInsegnanti =
    scuola.limite_insegnanti === null || scuola.limite_insegnanti === undefined
      ? null
      : Number(scuola.limite_insegnanti);

  // Limite totale utenti (vale per qualsiasi ruolo invitato).
  if (limiteUtenti !== null) {
    const [utenti, pendenti] = await Promise.all([
      utentiUsati(scuola.id),
      invitiPendenti(scuola.id),
    ]);
    if (utenti + pendenti >= limiteUtenti) {
      throw new AppError(
        `Numero massimo di utenti raggiunto per questa scuola (${limiteUtenti}). ` +
          'Contatta l\'amministratore per aumentare il limite.',
        409,
        'QUOTA_UTENTI'
      );
    }
  }

  // Sotto-limite insegnanti (solo per gli inviti insegnante).
  if (ruolo === 'insegnante' && limiteInsegnanti !== null) {
    const [insegnanti, pendentiIns] = await Promise.all([
      insegnantiUsati(scuola.id),
      invitiPendenti(scuola.id, 'insegnante'),
    ]);
    if (insegnanti + pendentiIns >= limiteInsegnanti) {
      throw new AppError(
        `Numero massimo di insegnanti raggiunto per questa scuola (${limiteInsegnanti}). ` +
          'Contatta l\'amministratore per aumentare il limite.',
        409,
        'QUOTA_INSEGNANTI'
      );
    }
  }
};

module.exports = {
  storageUsatoByte,
  utentiUsati,
  insegnantiUsati,
  invitiPendenti,
  riepilogo,
  assicuraSpazioStorage,
  assicuraPostoUtente,
};
