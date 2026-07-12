'use strict';

/**
 * POLITICA DI CONSERVAZIONE DEI DATI (data retention).
 *
 * Definisce, in un unico punto, per quanto tempo la piattaforma conserva alcune
 * categorie di dati prima della loro CANCELLAZIONE EFFETTIVA (hard delete). È il
 * complemento operativo del diritto alla cancellazione (art. 17 GDPR): non basta
 * marcare un dato come "da eliminare", occorre eliminarlo davvero entro tempi
 * definiti e documentati.
 *
 * I periodi sono in GIORNI e sovrascrivibili via variabili d'ambiente, così una
 * scuola/deploy può adeguarli alle proprie esigenze legali senza toccare il
 * codice. Sono consumati dal job di retention nello `schedulerService`.
 *
 * ─────────────────────────────────────────────
 * COSA VIENE PURGATO
 * ─────────────────────────────────────────────
 *   - ACCOUNT con cancellazione richiesta → l'utente ha chiesto la cancellazione
 *     (`cancellazione_richiesta_at`). Dopo il periodo di grazia l'account viene
 *     eliminato DEFINITIVAMENTE (le relazioni con onDelete: CASCADE seguono).
 *     Il periodo di grazia consente il ripensamento (annullamento della richiesta).
 *
 *   - NOTIFICHE EMAIL già inviate → le righe della coda `notifiche_email` in stato
 *     'inviata' non servono più dopo un certo tempo: sono solo storico di recapito.
 */

const intEnv = (chiave, predefinito) => {
  const v = parseInt(process.env[chiave], 10);
  return Number.isFinite(v) && v >= 0 ? v : predefinito;
};

// Periodo di grazia (giorni) tra la richiesta di cancellazione dell'account e la
// sua eliminazione definitiva. Entro questo intervallo l'utente può annullare.
const ACCOUNT_CANCELLAZIONE_GIORNI = intEnv('RETENTION_ACCOUNT_GIORNI', 30);

// Giorni di conservazione delle notifiche email già inviate prima della purga.
const NOTIFICHE_INVIATE_GIORNI = intEnv('RETENTION_NOTIFICHE_GIORNI', 90);

/**
 * Restituisce la data-soglia: tutto ciò che è più vecchio di `giorni` rispetto a
 * "ora" è oltre il periodo di conservazione. `giorni = 0` ⇒ soglia = adesso.
 *
 * @param {number} giorni
 * @param {Date}  [riferimento] istante di riferimento (default: ora)
 * @returns {Date}
 */
const dataSoglia = (giorni, riferimento = new Date()) =>
  new Date(riferimento.getTime() - Math.max(0, giorni) * 24 * 60 * 60 * 1000);

module.exports = {
  ACCOUNT_CANCELLAZIONE_GIORNI,
  NOTIFICHE_INVIATE_GIORNI,
  dataSoglia,
};
