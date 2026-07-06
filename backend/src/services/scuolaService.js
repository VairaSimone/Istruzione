'use strict';

const { Op } = require('sequelize');
const Scuola = require('../models/Scuola');
const Utente = require('../models/Utente');
const Classe = require('../models/Classe');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const logger = require('../utils/logger');

/**
 * ScuolaService — gestione delle SCUOLE (tenant) e delle loro impostazioni.
 *
 *   creazione · elenco · dettaglio · aggiornamento (nome/impostazioni) ·
 *   aggiornamento impostazioni (merge) · eliminazione · scuola corrente
 *
 * Le operazioni di scrittura sono riservate all'admin (gate di ruolo nelle
 * route). Ogni scuola ha un blob `impostazioni` personale: settaggi differenti
 * per l'intera piattaforma, isolati dalle altre scuole.
 */

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Carica una scuola o lancia 404. */
const caricaScuola = async (scuolaId, opzioni = {}) => {
  const scuola = await Scuola.findByPk(scuolaId, opzioni);
  if (!scuola) {
    throw new AppError('Scuola non trovata.', 404, 'SCUOLA_NOT_FOUND');
  }
  return scuola;
};

/**
 * Valida che `impostazioni` sia un oggetto JSON semplice (no array, no null,
 * no primitivi). Le chiavi/valori sono liberi: lo schema è volutamente aperto.
 */
const validaImpostazioni = (impostazioni) => {
  if (
    impostazioni === undefined ||
    impostazioni === null ||
    typeof impostazioni !== 'object' ||
    Array.isArray(impostazioni)
  ) {
    throw new AppError(
      "Le impostazioni devono essere un oggetto JSON (coppie chiave/valore).",
      422,
      'INVALID_SETTINGS'
    );
  }
  return impostazioni;
};

// ─────────────────────────────────────────────
// CREA SCUOLA (admin)
// ─────────────────────────────────────────────
const creaScuola = async ({ nome, impostazioni }) => {
  const nomeNorm = String(nome).trim();

  const esistente = await Scuola.findOne({ where: { nome: nomeNorm } });
  if (esistente) {
    throw new AppError('Esiste già una scuola con questo nome.', 409, 'SCUOLA_NAME_TAKEN');
  }

  const scuola = await Scuola.create({
    nome: nomeNorm,
    impostazioni: impostazioni ? validaImpostazioni(impostazioni) : {},
  });

  logger.info(`[SCUOLA] Creata scuola ${scuola.id} "${scuola.nome}"`);
  return scuola.toPublicJSON();
};

// ─────────────────────────────────────────────
// ELENCO SCUOLE (admin) — con conteggi utenti/aule
// ─────────────────────────────────────────────
const elencoScuole = async ({ q, page, limit } = {}) => {
  const where = {};
  if (q) where.nome = { [Op.like]: `%${escapeLike(String(q).trim())}%` };

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = { where, order: [['nome', 'ASC']] };
  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPaginazione) {
    const r = await Scuola.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await Scuola.findAll(queryOptions);
  }

  // Conteggi utenti/aule per scuola in due sole query aggregate (niente N+1).
  const ids = righe.map((s) => s.id);
  const mappaUtenti = new Map();
  const mappaAule = new Map();
  if (ids.length) {
    const [utentiCount, auleCount] = await Promise.all([
      Utente.findAll({
        where: { scuola_id: { [Op.in]: ids } },
        attributes: ['scuola_id', [Utente.sequelize.fn('COUNT', Utente.sequelize.col('id')), 'totale']],
        group: ['scuola_id'],
        raw: true,
      }),
      Classe.findAll({
        where: { scuola_id: { [Op.in]: ids } },
        attributes: ['scuola_id', [Classe.sequelize.fn('COUNT', Classe.sequelize.col('id')), 'totale']],
        group: ['scuola_id'],
        raw: true,
      }),
    ]);
    for (const r of utentiCount) mappaUtenti.set(String(r.scuola_id), parseInt(r.totale, 10));
    for (const r of auleCount) mappaAule.set(String(r.scuola_id), parseInt(r.totale, 10));
  }

  const scuole = righe.map((s) => ({
    ...s.toPublicJSON(),
    conteggio: {
      utenti: mappaUtenti.get(String(s.id)) || 0,
      aule: mappaAule.get(String(s.id)) || 0,
    },
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { scuole, paginazione };
};

// ─────────────────────────────────────────────
// DETTAGLIO SCUOLA (admin)
// ─────────────────────────────────────────────
const dettaglioScuola = async (scuolaId) => {
  const scuola = await caricaScuola(scuolaId);

  const [utenti, aule] = await Promise.all([
    Utente.count({ where: { scuola_id: scuolaId } }),
    Classe.count({ where: { scuola_id: scuolaId } }),
  ]);

  return { ...scuola.toPublicJSON(), conteggio: { utenti, aule } };
};

// ─────────────────────────────────────────────
// AGGIORNA SCUOLA (admin) — nome e/o impostazioni (sostituzione integrale)
// ─────────────────────────────────────────────
const aggiornaScuola = async (scuolaId, { nome, impostazioni }) => {
  const scuola = await caricaScuola(scuolaId);

  if (nome !== undefined) {
    const nomeNorm = String(nome).trim();
    const esistente = await Scuola.findOne({ where: { nome: nomeNorm, id: { [Op.ne]: scuolaId } } });
    if (esistente) {
      throw new AppError('Esiste già una scuola con questo nome.', 409, 'SCUOLA_NAME_TAKEN');
    }
    scuola.nome = nomeNorm;
  }

  if (impostazioni !== undefined) {
    scuola.impostazioni = validaImpostazioni(impostazioni);
  }

  await scuola.save();
  logger.info(`[SCUOLA] Aggiornata scuola ${scuolaId}`);
  return scuola.toPublicJSON();
};

// ─────────────────────────────────────────────
// AGGIORNA IMPOSTAZIONI (admin) — MERGE superficiale sulle chiavi fornite
// Utile per modificare singoli settaggi senza reinviare l'intero blob.
// ─────────────────────────────────────────────
const aggiornaImpostazioni = async (scuolaId, impostazioniParziali) => {
  validaImpostazioni(impostazioniParziali);
  const scuola = await caricaScuola(scuolaId);

  const correnti = scuola.impostazioni && typeof scuola.impostazioni === 'object' ? scuola.impostazioni : {};
  scuola.impostazioni = { ...correnti, ...impostazioniParziali };
  // Sequelize non rileva le mutazioni "in place" sui JSON: segnala il cambiamento.
  scuola.changed('impostazioni', true);

  await scuola.save();
  logger.info(`[SCUOLA] Impostazioni aggiornate per scuola ${scuolaId}`);
  return scuola.toPublicJSON();
};

// ─────────────────────────────────────────────
// ELIMINA SCUOLA (admin)
// Bloccata finché esistono utenti collegati (FK RESTRICT su utenti.scuola_id):
// si evita di orfanare account. Aule/compiti/messaggi/inviti seguono in CASCADE.
// ─────────────────────────────────────────────
const eliminaScuola = async (scuolaId) => {
  const scuola = await caricaScuola(scuolaId);

  const utentiCollegati = await Utente.count({ where: { scuola_id: scuolaId } });
  if (utentiCollegati > 0) {
    throw new AppError(
      `Impossibile eliminare la scuola: ha ancora ${utentiCollegati} utenti collegati. ` +
        'Sposta o elimina prima gli utenti.',
      409,
      'SCUOLA_HAS_USERS'
    );
  }

  await scuola.destroy();
  logger.info(`[SCUOLA] Eliminata scuola ${scuolaId}`);
};

// ─────────────────────────────────────────────
// SCUOLA CORRENTE (insegnante) — legge la propria scuola + impostazioni
// L'admin non appartiene ad alcuna scuola: restituisce null.
// ─────────────────────────────────────────────
const scuolaCorrente = async (richiedente) => {
  if (richiedente.ruolo === 'admin' || !richiedente.scuola_id) {
    return null;
  }
  const scuola = await caricaScuola(richiedente.scuola_id);
  return scuola.toPublicJSON();
};

module.exports = {
  caricaScuola,
  creaScuola,
  elencoScuole,
  dettaglioScuola,
  aggiornaScuola,
  aggiornaImpostazioni,
  eliminaScuola,
  scuolaCorrente,
};
