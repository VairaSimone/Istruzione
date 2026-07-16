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

  // ── Chi blocca chi ──
  //
  // L'univocità NON è più globale (cfr. migrazione 20260716120002): due scuole
  // possono chiedere lo stesso host, perché una richiesta non verificata è
  // inerte — non risolve il tenant, non ottiene certificati, non toglie nulla a
  // nessuno. Prima bastava invece a bruciare l'host per tutti: un insegnante
  // poteva registrare `liceo-concorrente.it` sulla propria scuola e impedire
  // alla scuola legittima di aggiungerlo, con sblocco possibile solo da un admin.
  //
  // Restano due conflitti veri:
  //   1. l'host è già VERIFICATO da qualcuno → è assegnato, punto;
  //   2. la STESSA scuola lo ha già chiesto → è un doppione inutile.

  const verificatoAltrove = await DominioScuola.findOne({
    where: { dominio: host, verificato: true },
  });
  if (verificatoAltrove) {
    const propria = String(verificatoAltrove.scuola_id) === String(scuolaId);
    throw new AppError(
      propria
        ? 'Questo dominio è già associato a questa scuola.'
        : 'Questo dominio è già assegnato a un\'altra scuola.',
      409,
      'DOMINIO_TAKEN'
    );
  }

  const giaRichiesto = await DominioScuola.findOne({
    where: { dominio: host, scuola_id: scuolaId },
  });
  if (giaRichiesto) {
    throw new AppError(
      'Questo dominio è già associato a questa scuola.',
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

    // La VERIFICA è il momento in cui l'host smette di essere una richiesta e
    // diventa un'assegnazione: da qui in poi risolve il tenant ed è ammesso al
    // TLS on-demand. Due scuole possono averlo chiesto entrambe — è lecito, e
    // sta all'admin sapere di chi è davvero — ma una sola può ottenerlo.
    //
    // L'indice univoco sulla colonna generata `dominio_verificato` respingerebbe
    // comunque il secondo (ed è quello a reggere le verifiche simultanee, dove
    // un controllo applicativo non basterebbe). Qui lo anticipiamo solo per dire
    // all'admin QUALE scuola ce l'ha già, invece di un errore di vincolo grezzo.
    if (nuovoStato && !dominio.verificato) {
      const altro = await DominioScuola.findOne({
        where: {
          dominio: dominio.dominio,
          verificato: true,
          id: { [Op.ne]: dominio.id },
        },
      });
      if (altro) {
        throw new AppError(
          `Il dominio "${dominio.dominio}" è già verificato per un'altra scuola: rimuovi o annulla quella verifica prima di assegnarlo.`,
          409,
          'DOMINIO_GIA_VERIFICATO'
        );
      }
    }

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
