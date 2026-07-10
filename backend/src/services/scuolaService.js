'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Scuola = require('../models/Scuola');
const Utente = require('../models/Utente');
const Classe = require('../models/Classe');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const logger = require('../utils/logger');
const impostazioniService = require('./impostazioniService');
const {
  normalizzaImpostazioni,
  mergeImpostazioni,
  applicaDefault,
} = require('../constants/impostazioniScuola');

/**
 * ScuolaService — gestione delle SCUOLE (tenant) e delle loro IMPOSTAZIONI.
 *
 *   creazione · elenco · dettaglio · aggiornamento · impostazioni (merge) ·
 *   scuola predefinita · eliminazione · scuola corrente
 *
 * Le operazioni sull'anagrafica delle scuole (creazione, eliminazione, scelta
 * della scuola predefinita) sono riservate all'ADMIN. Le IMPOSTAZIONI della
 * propria scuola possono invece essere modificate anche dagli INSEGNANTI: sono
 * la configurazione del loro ente, non della piattaforma.
 *
 * La forma del blob `impostazioni` è governata da `constants/impostazioniScuola.js`;
 * questo service non conosce i singoli campi, si limita a normalizzare, unire e
 * persistere. Aggiungere un settaggio non tocca questo file.
 *
 * Ogni scrittura INVALIDA la cache delle impostazioni: il gate delle
 * funzionalità e gli endpoint pubblici vedono subito il nuovo stato.
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
 * Genera uno slug univoco a partire dal nome (o da quello proposto), evitando
 * le collisioni con un suffisso numerico progressivo.
 */
const slugUnivoco = async (proposto, nome, escludiId = null) => {
  const base = Scuola.slugifica(proposto || nome);
  if (!base) {
    throw new AppError(
      "Impossibile derivare uno slug dal nome della scuola: indicane uno esplicito.",
      422,
      'SLUG_REQUIRED'
    );
  }

  const where = { slug: { [Op.like]: `${escapeLike(base)}%` } };
  if (escludiId) where.id = { [Op.ne]: escludiId };

  const occupati = new Set((await Scuola.findAll({ where, attributes: ['slug'], raw: true })).map((r) => r.slug));

  if (!occupati.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidato = `${base}-${i}`;
    if (!occupati.has(candidato)) return candidato;
  }
  throw new AppError('Impossibile generare uno slug univoco per questa scuola.', 409, 'SLUG_CONFLICT');
};

/**
 * Autorizza la modifica delle impostazioni di `scuolaId`:
 *   - admin  → qualsiasi scuola;
 *   - insegnante → esclusivamente la propria.
 * Gli studenti non modificano nulla (gate di ruolo già nelle route).
 */
const assicuraGestioneImpostazioni = (richiedente, scuolaId) => {
  if (richiedente.ruolo === 'admin') return;
  if (!richiedente.scuola_id || String(richiedente.scuola_id) !== String(scuolaId)) {
    throw new AppError(
      'Puoi modificare solo le impostazioni della tua scuola.',
      403,
      'CROSS_SCUOLA_FORBIDDEN'
    );
  }
};

/** Toglie il flag `predefinita` a tutte le scuole tranne quella indicata. */
const smarcaAltrePredefinite = async (scuolaId, transaction) => {
  await Scuola.update(
    { predefinita: false },
    { where: { id: { [Op.ne]: scuolaId }, predefinita: true }, transaction }
  );
};

// ─────────────────────────────────────────────
// CREA SCUOLA (admin)
// ─────────────────────────────────────────────
const creaScuola = async ({ nome, slug, impostazioni, attiva, predefinita }) => {
  const nomeNorm = String(nome).trim();

  const esistente = await Scuola.findOne({ where: { nome: nomeNorm } });
  if (esistente) {
    throw new AppError('Esiste già una scuola con questo nome.', 409, 'SCUOLA_NAME_TAKEN');
  }

  const slugFinale = await slugUnivoco(slug, nomeNorm);
  // Le impostazioni sono normalizzate contro lo schema: le chiavi sconosciute
  // vengono scartate, i valori non conformi generano 422.
  const impostazioniNorm = normalizzaImpostazioni(impostazioni);

  const scuola = await sequelize.transaction(async (t) => {
    const nuova = await Scuola.create(
      {
        nome: nomeNorm,
        slug: slugFinale,
        attiva: attiva === undefined ? true : Boolean(attiva),
        predefinita: Boolean(predefinita),
        impostazioni: impostazioniNorm,
      },
      { transaction: t }
    );

    if (nuova.predefinita) await smarcaAltrePredefinite(nuova.id, t);
    return nuova;
  });

  impostazioniService.invalida();
  logger.info(`[SCUOLA] Creata scuola ${scuola.id} "${scuola.nome}" (slug: ${scuola.slug})`);
  return scuola.toPublicJSON();
};

// ─────────────────────────────────────────────
// ELENCO SCUOLE (admin) — con conteggi utenti/aule
// ─────────────────────────────────────────────
const elencoScuole = async ({ q, page, limit, attiva } = {}) => {
  const where = {};
  if (q) where.nome = { [Op.like]: `%${escapeLike(String(q).trim())}%` };
  if (attiva !== undefined) where.attiva = attiva;

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
// AGGIORNA SCUOLA (admin) — anagrafica + impostazioni (sostituzione integrale)
// ─────────────────────────────────────────────
const aggiornaScuola = async (scuolaId, { nome, slug, impostazioni, attiva, predefinita }) => {
  const scuola = await caricaScuola(scuolaId);

  if (nome !== undefined) {
    const nomeNorm = String(nome).trim();
    const esistente = await Scuola.findOne({ where: { nome: nomeNorm, id: { [Op.ne]: scuolaId } } });
    if (esistente) {
      throw new AppError('Esiste già una scuola con questo nome.', 409, 'SCUOLA_NAME_TAKEN');
    }
    scuola.nome = nomeNorm;
  }

  if (slug !== undefined) {
    scuola.slug = await slugUnivoco(slug, scuola.nome, scuolaId);
  }

  if (impostazioni !== undefined) {
    // Sostituzione integrale: il chiamante ha inviato il blob completo.
    scuola.impostazioni = normalizzaImpostazioni(impostazioni);
  }

  if (attiva !== undefined) scuola.attiva = Boolean(attiva);
  if (predefinita !== undefined) scuola.predefinita = Boolean(predefinita);

  await sequelize.transaction(async (t) => {
    await scuola.save({ transaction: t });
    if (scuola.predefinita) await smarcaAltrePredefinite(scuola.id, t);
  });

  impostazioniService.invalida(scuolaId);
  logger.info(`[SCUOLA] Aggiornata scuola ${scuolaId}`);
  return scuola.toPublicJSON();
};

// ─────────────────────────────────────────────
// AGGIORNA IMPOSTAZIONI — MERGE per sezione (admin | insegnante della scuola)
//
// Le sezioni non citate restano invariate; dentro una sezione citata restano
// invariati i campi non citati. È il comportamento atteso da un pannello che
// salva una scheda per volta (Identità, Aspetto, Contatti, Funzionalità…).
// ─────────────────────────────────────────────
const aggiornaImpostazioni = async (scuolaId, impostazioniParziali, richiedente) => {
  assicuraGestioneImpostazioni(richiedente, scuolaId);

  const scuola = await caricaScuola(scuolaId);
  const correnti =
    scuola.impostazioni && typeof scuola.impostazioni === 'object' ? scuola.impostazioni : {};

  scuola.impostazioni = mergeImpostazioni(correnti, impostazioniParziali);
  // Sequelize non rileva le mutazioni "in place" sui JSON: segnala il cambiamento.
  scuola.changed('impostazioni', true);

  await scuola.save();

  impostazioniService.invalida(scuolaId);
  logger.info(`[SCUOLA] Impostazioni aggiornate per scuola ${scuolaId} da utente ${richiedente.id}`);
  return scuola.toPublicJSON();
};

// ─────────────────────────────────────────────
// ELIMINA SCUOLA (admin)
// Bloccata finché esistono utenti collegati (FK RESTRICT su utenti.scuola_id):
// si evita di orfanare account. Aule/compiti/messaggi/inviti/quiz/corsi seguono
// in CASCADE.
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

  impostazioniService.invalida();
  logger.info(`[SCUOLA] Eliminata scuola ${scuolaId}`);
};

// ─────────────────────────────────────────────
// SCUOLA CORRENTE — la scuola del richiedente, con impostazioni complete.
//
// Disponibile a TUTTI i ruoli autenticati (studenti compresi): è il frontend a
// usarla per applicare tema, colori e menu dell'utente loggato.
// L'admin non appartiene ad alcuna scuola: restituisce `null` e il frontend
// ricade sull'identità di piattaforma esposta da `GET /api/config`.
// ─────────────────────────────────────────────
const scuolaCorrente = async (richiedente) => {
  if (richiedente.ruolo === 'admin' || !richiedente.scuola_id) {
    return null;
  }
  const scuola = await caricaScuola(richiedente.scuola_id);
  return scuola.toPublicJSON();
};

/** Solo il blob delle impostazioni complete della scuola del richiedente. */
const impostazioniCorrenti = async (richiedente) => {
  if (richiedente.ruolo === 'admin' || !richiedente.scuola_id) {
    return applicaDefault({});
  }
  return impostazioniService.perScuola(richiedente.scuola_id);
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
  impostazioniCorrenti,
  slugUnivoco,
};
