'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const DominioScuola = require('../models/DominioScuola');
const Scuola = require('../models/Scuola');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const impostazioniService = require('./impostazioniService');
const { isAdmin } = require('../utils/tenant');
const { normalizzaDominio } = require('../utils/dominio');

/**
 * DominiService — gestione dei DOMINI PERSONALIZZATI di un tenant.
 *
 *   elenco · aggiunta · aggiornamento (verifica / principale / note) · rimozione
 *
 * REGOLE DI AUTORIZZAZIONE
 *   - ADMIN (trasversale): opera su qualunque scuola e può VERIFICARE un dominio;
 *   - INSEGNANTE: opera solo sulla PROPRIA scuola e può aggiungere/rimuovere
 *     domini, ma NON può verificarli. La verifica (che abilita la risoluzione
 *     del tenant) resta un atto dell'admin, dopo aver accertato il puntamento
 *     DNS: così nessuno può dirottare il traffico di un host non suo.
 *
 * Ogni scrittura invalida la cache delle impostazioni: la risoluzione per
 * dominio (`impostazioniService.perDominio`) vede subito il nuovo stato.
 */

/** Autorizza la gestione dei domini di `scuolaId` (admin: sempre; docente: solo la propria). */
const assicuraGestione = (richiedente, scuolaId) => {
  if (isAdmin(richiedente)) return;
  if (!richiedente || !richiedente.scuola_id || String(richiedente.scuola_id) !== String(scuolaId)) {
    throw new AppError('Puoi gestire solo i domini della tua scuola.', 403, 'CROSS_SCUOLA_FORBIDDEN');
  }
};

/** Carica la scuola o lancia 404. */
const caricaScuola = async (scuolaId) => {
  const scuola = await Scuola.findByPk(scuolaId);
  if (!scuola) throw new AppError('Scuola non trovata.', 404, 'SCUOLA_NOT_FOUND');
  return scuola;
};

/** Carica un dominio garantendo che appartenga alla scuola indicata. */
const caricaDominio = async (scuolaId, dominioId) => {
  const dominio = await DominioScuola.findByPk(dominioId);
  if (!dominio || String(dominio.scuola_id) !== String(scuolaId)) {
    throw new AppError('Dominio non trovato per questa scuola.', 404, 'DOMINIO_NOT_FOUND');
  }
  return dominio;
};

// ─────────────────────────────────────────────
// ELENCO
// ─────────────────────────────────────────────
const elencoDomini = async (richiedente, scuolaId) => {
  assicuraGestione(richiedente, scuolaId);
  await caricaScuola(scuolaId);

  const domini = await DominioScuola.findAll({
    where: { scuola_id: scuolaId },
    order: [
      ['principale', 'DESC'],
      ['dominio', 'ASC'],
    ],
  });

  return domini.map((d) => d.toPublicJSON());
};

// ─────────────────────────────────────────────
// AGGIUNGI
// ─────────────────────────────────────────────
const aggiungiDominio = async (richiedente, scuolaId, { dominio, principale, note } = {}) => {
  assicuraGestione(richiedente, scuolaId);
  await caricaScuola(scuolaId);

  const host = normalizzaDominio(dominio);
  if (!host) {
    throw new AppError('Il dominio non è valido (es. liceo-manzoni.it).', 422, 'DOMINIO_INVALID');
  }

  // Univocità globale: un dominio appartiene a una sola scuola.
  const esistente = await DominioScuola.findOne({ where: { dominio: host } });
  if (esistente) {
    const propria = String(esistente.scuola_id) === String(scuolaId);
    throw new AppError(
      propria
        ? 'Questo dominio è già associato a questa scuola.'
        : 'Questo dominio è già associato a un\'altra scuola.',
      409,
      'DOMINIO_TAKEN'
    );
  }

  // Solo l'admin, che è fidato, aggiunge domini già verificati. Lo staff crea
  // domini in attesa di verifica.
  const verificato = isAdmin(richiedente);
  const vuolePrincipale = Boolean(principale);

  const creato = await sequelize.transaction(async (t) => {
    if (vuolePrincipale) {
      await DominioScuola.update(
        { principale: false },
        { where: { scuola_id: scuolaId, principale: true }, transaction: t }
      );
    }
    return DominioScuola.create(
      {
        scuola_id: scuolaId,
        dominio: host,
        verificato,
        verificato_il: verificato ? new Date() : null,
        principale: vuolePrincipale,
        note: note ? String(note).trim().slice(0, 255) : null,
      },
      { transaction: t }
    );
  });

  impostazioniService.invalida(scuolaId);
  logger.info(
    `[DOMINIO] Aggiunto "${host}" alla scuola ${scuolaId} (verificato: ${verificato}) da utente ${richiedente.id}`
  );
  return creato.toPublicJSON();
};

// ─────────────────────────────────────────────
// AGGIORNA (verifica / principale / note)
// La verifica è riservata all'ADMIN; lo staff può solo cambiare `principale`/`note`.
// ─────────────────────────────────────────────
const aggiornaDominio = async (richiedente, scuolaId, dominioId, { verificato, principale, note } = {}) => {
  assicuraGestione(richiedente, scuolaId);
  const dominio = await caricaDominio(scuolaId, dominioId);

  if (verificato !== undefined) {
    if (!isAdmin(richiedente)) {
      throw new AppError(
        'Solo un amministratore può verificare un dominio.',
        403,
        'VERIFICA_RISERVATA_ADMIN'
      );
    }
    const nuovoStato = Boolean(verificato);
    dominio.verificato = nuovoStato;
    dominio.verificato_il = nuovoStato ? new Date() : null;
  }

  if (note !== undefined) {
    dominio.note = note ? String(note).trim().slice(0, 255) : null;
  }

  await sequelize.transaction(async (t) => {
    if (principale !== undefined && Boolean(principale)) {
      await DominioScuola.update(
        { principale: false },
        { where: { scuola_id: scuolaId, principale: true, id: { [Op.ne]: dominioId } }, transaction: t }
      );
      dominio.principale = true;
    } else if (principale !== undefined) {
      dominio.principale = false;
    }
    await dominio.save({ transaction: t });
  });

  impostazioniService.invalida(scuolaId);
  logger.info(`[DOMINIO] Aggiornato ${dominioId} (scuola ${scuolaId}) da utente ${richiedente.id}`);
  return dominio.toPublicJSON();
};

// ─────────────────────────────────────────────
// RIMUOVI
// ─────────────────────────────────────────────
const rimuoviDominio = async (richiedente, scuolaId, dominioId) => {
  assicuraGestione(richiedente, scuolaId);
  const dominio = await caricaDominio(scuolaId, dominioId);

  await dominio.destroy();

  impostazioniService.invalida(scuolaId);
  logger.info(`[DOMINIO] Rimosso ${dominioId} (scuola ${scuolaId}) da utente ${richiedente.id}`);
};

module.exports = {
  elencoDomini,
  aggiungiDominio,
  aggiornaDominio,
  rimuoviDominio,
};
