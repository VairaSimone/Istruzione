'use strict';

const { Op } = require('sequelize');
const RichiestaContatto = require('../models/RichiestaContatto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { escapeLike } = require('../utils/escapeLike');
const impostazioniService = require('./impostazioniService');
const emailService = require('./emailService');
const { isAdmin, assicuraStessaScuola } = require('../utils/tenant');
const {
  TIPO_DEFAULT,
  tipoEsiste,
  statoEsiste,
} = require('../constants/tipiRichiestaContatto');

/**
 * ContattiService — richieste inviate dal FORM della homepage pubblica.
 *
 *   invio (pubblico) · elenco (staff) · dettaglio (staff) · aggiornamento
 *   (stato / prise in carico / note) · rimozione
 *
 * L'INVIO è pubblico: proviene da un visitatore non autenticato e la scuola
 * destinataria è già stata risolta a monte (dal dominio o dal tenant indicato).
 * Il service applica le regole configurate dalla scuola (form abilitato, tipi di
 * richiesta ammessi) e recapita la richiesta via email, oltre a persisterla come
 * lead consultabile dallo staff.
 *
 * La CONSULTAZIONE e la GESTIONE sono riservate allo staff della scuola
 * (insegnante della scuola) e all'admin (trasversale), sempre entro il tenant.
 */

// ─────────────────────────────────────────────
// INVIO (pubblico)
// ─────────────────────────────────────────────

/**
 * Registra una richiesta di contatto per la scuola risolta.
 *
 * @param {import('../models/Scuola')} scuola  tenant destinatario (risolto)
 * @param {Object} dati  { tipo, nome, email, telefono, messaggio }
 * @param {Object} [contesto]  { dominio, origine }
 * @returns {Promise<{id:string, messaggioConferma:?string}>}
 */
const creaRichiesta = async (scuola, dati, contesto = {}) => {
  if (!scuola) {
    throw new AppError(
      'Impossibile identificare la scuola destinataria della richiesta.',
      400,
      'SCUOLA_NON_RISOLTA'
    );
  }
  if (!scuola.attiva) {
    throw new AppError('Questa scuola non è al momento raggiungibile.', 403, 'SCUOLA_SOSPESA');
  }

  const impostazioni = await impostazioniService.perScuola(scuola.id);
  const form = (impostazioni.homepage && impostazioni.homepage.form) || {};

  if (form.abilitato === false) {
    throw new AppError(
      'Il modulo di contatto non è attivo per questa scuola.',
      403,
      'FORM_CONTATTO_DISATTIVO'
    );
  }

  const tipo = dati.tipo && tipoEsiste(dati.tipo) ? dati.tipo : TIPO_DEFAULT;
  const tipiAmmessi = Array.isArray(form.tipiRichiesta) && form.tipiRichiesta.length
    ? form.tipiRichiesta
    : null;
  if (tipiAmmessi && !tipiAmmessi.includes(tipo)) {
    throw new AppError(
      'Questo tipo di richiesta non è accettato da questa scuola.',
      422,
      'TIPO_RICHIESTA_NON_AMMESSO'
    );
  }

  const richiesta = await RichiestaContatto.create({
    scuola_id: scuola.id,
    tipo,
    stato: 'nuova',
    nome: String(dati.nome).trim(),
    email: String(dati.email).trim().toLowerCase(),
    telefono: dati.telefono ? String(dati.telefono).trim() : null,
    messaggio: dati.messaggio ? String(dati.messaggio).trim() : null,
    // Solo contesto tecnico non identificativo (nessun IP grezzo).
    meta: {
      origine: contesto.origine || 'homepage',
      dominio: contesto.dominio || null,
    },
  });

  // Recapito email alla scuola (best-effort: un guasto SMTP non deve perdere il
  // lead, che resta comunque persistito e consultabile dallo staff).
  const destinatario =
    form.emailDestinazione ||
    (impostazioni.contatti && impostazioni.contatti.email) ||
    null;

  if (destinatario) {
    try {
      await emailService.sendContactRequestEmail(destinatario, {
        nomeScuola: impostazioni.identita && impostazioni.identita.nomeVisualizzato,
        richiesta: richiesta.toPublicJSON(),
        lingua: 'it',
      });
    } catch (err) {
      logger.error(`[CONTATTI] Invio email della richiesta ${richiesta.id} fallito: ${err.message}`);
    }
  } else {
    logger.warn(
      `[CONTATTI] Nessuna email di destinazione per la scuola ${scuola.id}: la richiesta ${richiesta.id} è solo persistita.`
    );
  }

  logger.info(`[CONTATTI] Nuova richiesta ${richiesta.id} (${tipo}) per la scuola ${scuola.id}`);

  return {
    id: richiesta.id,
    messaggioConferma: form.messaggioConferma || null,
  };
};

// ─────────────────────────────────────────────
// ELENCO (staff)
// ─────────────────────────────────────────────

/**
 * Determina la scuola su cui operare:
 *   - insegnante → sempre la propria (uno `scuolaId` diverso è vietato);
 *   - admin      → quella indicata (obbligatoria: l'admin non ha tenant proprio).
 */
const risolviScuolaOperativa = (richiedente, scuolaIdRichiesta) => {
  if (isAdmin(richiedente)) {
    if (!scuolaIdRichiesta) {
      throw new AppError(
        'Come amministratore devi indicare la scuola (scuolaId).',
        422,
        'SCUOLA_REQUIRED'
      );
    }
    return String(scuolaIdRichiesta);
  }
  if (!richiedente.scuola_id) {
    throw new AppError('Il tuo account non è associato ad alcuna scuola.', 403, 'NO_SCUOLA');
  }
  if (scuolaIdRichiesta && String(scuolaIdRichiesta) !== String(richiedente.scuola_id)) {
    throw new AppError('Puoi consultare solo le richieste della tua scuola.', 403, 'CROSS_SCUOLA_FORBIDDEN');
  }
  return String(richiedente.scuola_id);
};

const elencoRichieste = async (richiedente, { scuolaId, stato, tipo, q, page, limit } = {}) => {
  const scuola = risolviScuolaOperativa(richiedente, scuolaId);

  const where = { scuola_id: scuola };
  if (stato) {
    if (!statoEsiste(stato)) throw new AppError('Stato non valido.', 422, 'STATO_INVALID');
    where.stato = stato;
  }
  if (tipo) {
    if (!tipoEsiste(tipo)) throw new AppError('Tipo non valido.', 422, 'TIPO_INVALID');
    where.tipo = tipo;
  }
  if (q) {
    const like = `%${escapeLike(String(q).trim())}%`;
    where[Op.or] = [{ nome: { [Op.like]: like } }, { email: { [Op.like]: like } }];
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = { where, order: [['created_at', 'DESC']] };
  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPaginazione) {
    const r = await RichiestaContatto.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await RichiestaContatto.findAll(queryOptions);
  }

  const richieste = righe.map((r) => r.toPublicJSON());
  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { richieste, paginazione };
};

// ─────────────────────────────────────────────
// DETTAGLIO (staff)
// ─────────────────────────────────────────────
const caricaEControlla = async (richiedente, id) => {
  const richiesta = await RichiestaContatto.findByPk(id);
  if (!richiesta) throw new AppError('Richiesta non trovata.', 404, 'RICHIESTA_NOT_FOUND');
  assicuraStessaScuola(richiedente, richiesta.scuola_id, 'Questa richiesta non appartiene alla tua scuola.');
  return richiesta;
};

const dettaglioRichiesta = async (richiedente, id) => {
  const richiesta = await caricaEControlla(richiedente, id);
  return richiesta.toPublicJSON();
};

// ─────────────────────────────────────────────
// AGGIORNA (stato / presa in carico / note)
// ─────────────────────────────────────────────
const aggiornaRichiesta = async (richiedente, id, { stato, noteInterne, prendiInCarico } = {}) => {
  const richiesta = await caricaEControlla(richiedente, id);

  if (stato !== undefined) {
    if (!statoEsiste(stato)) throw new AppError('Stato non valido.', 422, 'STATO_INVALID');
    richiesta.stato = stato;
  }
  if (noteInterne !== undefined) {
    richiesta.note_interne = noteInterne ? String(noteInterne).trim() : null;
  }
  if (prendiInCarico === true) {
    richiesta.gestita_da = richiedente.id;
    if (stato === undefined && richiesta.stato === 'nuova') richiesta.stato = 'in_gestione';
  } else if (prendiInCarico === false) {
    richiesta.gestita_da = null;
  }

  await richiesta.save();
  logger.info(`[CONTATTI] Richiesta ${id} aggiornata da utente ${richiedente.id}`);
  return richiesta.toPublicJSON();
};

// ─────────────────────────────────────────────
// RIMUOVI (staff)
// ─────────────────────────────────────────────
const rimuoviRichiesta = async (richiedente, id) => {
  const richiesta = await caricaEControlla(richiedente, id);
  await richiesta.destroy();
  logger.info(`[CONTATTI] Richiesta ${id} eliminata da utente ${richiedente.id}`);
};

module.exports = {
  creaRichiesta,
  elencoRichieste,
  dettaglioRichiesta,
  aggiornaRichiesta,
  rimuoviRichiesta,
};
