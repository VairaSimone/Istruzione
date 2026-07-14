'use strict';

const { Op } = require('sequelize');
const path = require('path');
const fsp = require('fs/promises');
const sequelize = require('../config/database');
const Scuola = require('../models/Scuola');
const Utente = require('../models/Utente');
const Classe = require('../models/Classe');
const FileCaricato = require('../models/FileCaricato');
const DominioScuola = require('../models/DominioScuola');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const denaro = require('../utils/denaro');
const { normalizzaDominio } = require('../utils/dominio');
const logger = require('../utils/logger');
const impostazioniService = require('./impostazioniService');
const quotaService = require('./quotaService');
const fileService = require('./fileService');
const { UPLOAD_DIR, UPLOAD_SUBDIR_CORSI } = require('../config/upload');
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

/**
 * Normalizza un limite intero proveniente dall'API: `null`/vuoto/non valido ⇒
 * `null` (illimitato); altrimenti un intero non negativo.
 */
const intONull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
const creaScuola = async ({
  nome,
  slug,
  impostazioni,
  attiva,
  predefinita,
  limiteStorageGb,
  limiteUtenti,
  limiteInsegnanti,
  dominio,
}) => {
  const nomeNorm = String(nome).trim();

  const esistente = await Scuola.findOne({ where: { nome: nomeNorm } });
  if (esistente) {
    throw new AppError('Esiste già una scuola con questo nome.', 409, 'SCUOLA_NAME_TAKEN');
  }

  const slugFinale = await slugUnivoco(slug, nomeNorm);
  // Le impostazioni sono normalizzate contro lo schema: le chiavi sconosciute
  // vengono scartate, i valori non conformi generano 422.
  const impostazioniNorm = normalizzaImpostazioni(impostazioni);

  // Dominio personalizzato opzionale: se assente la scuola resta sul dominio di
  // default della piattaforma (risolta via slug/predefinita). Se presente, viene
  // creato GIÀ VERIFICATO (l'admin è fidato) e come dominio PRINCIPALE.
  const host = dominio ? normalizzaDominio(dominio) : null;
  if (dominio && !host) {
    throw new AppError('Il dominio non è valido (es. liceo-manzoni.it).', 422, 'DOMINIO_INVALID');
  }
  if (host) {
    const dominioEsistente = await DominioScuola.findOne({ where: { dominio: host } });
    if (dominioEsistente) {
      throw new AppError('Questo dominio è già associato a un\'altra scuola.', 409, 'DOMINIO_TAKEN');
    }
  }

  const scuola = await sequelize.transaction(async (t) => {
    const nuova = await Scuola.create(
      {
        nome: nomeNorm,
        slug: slugFinale,
        attiva: attiva === undefined ? true : Boolean(attiva),
        predefinita: Boolean(predefinita),
        impostazioni: impostazioniNorm,
        limite_storage_byte: Scuola.gbABytes(limiteStorageGb),
        limite_utenti: intONull(limiteUtenti),
        limite_insegnanti: intONull(limiteInsegnanti),
      },
      { transaction: t }
    );

    if (nuova.predefinita) await smarcaAltrePredefinite(nuova.id, t);

    if (host) {
      await DominioScuola.create(
        {
          scuola_id: nuova.id,
          dominio: host,
          verificato: true,
          verificato_il: new Date(),
          principale: true,
        },
        { transaction: t }
      );
    }

    return nuova;
  });

  impostazioniService.invalida();
  logger.info(
    `[SCUOLA] Creata scuola ${scuola.id} "${scuola.nome}" (slug: ${scuola.slug}` +
      `${host ? `, dominio: ${host}` : ''})`
  );
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

  // Conteggi e occupazione quota per scuola, tutti in query aggregate (niente
  // N+1): utenti totali, aule, insegnanti, storage occupato e inviti pendenti.
  const ids = righe.map((s) => s.id);
  const mappaUtenti = new Map();
  const mappaAule = new Map();
  const mappaInsegnanti = new Map();
  const mappaStorage = new Map();
  const mappaPendTot = new Map();
  const mappaPendIns = new Map();
  if (ids.length) {
    const ora = new Date();
    const Invito = require('../models/Invito');
    const [utentiCount, auleCount, insegnantiCount, storageSum, pendTot, pendIns] = await Promise.all([
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
      Utente.findAll({
        where: { scuola_id: { [Op.in]: ids }, ruolo: 'insegnante' },
        attributes: ['scuola_id', [Utente.sequelize.fn('COUNT', Utente.sequelize.col('id')), 'totale']],
        group: ['scuola_id'],
        raw: true,
      }),
      FileCaricato.findAll({
        where: { scuola_id: { [Op.in]: ids } },
        attributes: [
          'scuola_id',
          [FileCaricato.sequelize.fn('SUM', FileCaricato.sequelize.col('dimensione_byte')), 'totale'],
        ],
        group: ['scuola_id'],
        raw: true,
      }),
      Invito.findAll({
        where: { scuola_id: { [Op.in]: ids }, stato: 'pendente', scadenza: { [Op.gt]: ora } },
        attributes: ['scuola_id', [Invito.sequelize.fn('COUNT', Invito.sequelize.col('id')), 'totale']],
        group: ['scuola_id'],
        raw: true,
      }),
      Invito.findAll({
        where: {
          scuola_id: { [Op.in]: ids },
          ruolo: 'insegnante',
          stato: 'pendente',
          scadenza: { [Op.gt]: ora },
        },
        attributes: ['scuola_id', [Invito.sequelize.fn('COUNT', Invito.sequelize.col('id')), 'totale']],
        group: ['scuola_id'],
        raw: true,
      }),
    ]);
    for (const r of utentiCount) mappaUtenti.set(String(r.scuola_id), parseInt(r.totale, 10));
    for (const r of auleCount) mappaAule.set(String(r.scuola_id), parseInt(r.totale, 10));
    for (const r of insegnantiCount) mappaInsegnanti.set(String(r.scuola_id), parseInt(r.totale, 10));
    for (const r of storageSum) mappaStorage.set(String(r.scuola_id), Number(r.totale || 0));
    for (const r of pendTot) mappaPendTot.set(String(r.scuola_id), parseInt(r.totale, 10));
    for (const r of pendIns) mappaPendIns.set(String(r.scuola_id), parseInt(r.totale, 10));
  }

  const percentuale = (usato, limite) =>
    limite === null || limite <= 0 ? null : Math.min(100, Math.round((usato / limite) * 100));

  const scuole = righe.map((s) => {
    const pub = s.toPublicJSON();
    const key = String(s.id);
    const utenti = mappaUtenti.get(key) || 0;
    const insegnanti = mappaInsegnanti.get(key) || 0;
    const storageByte = mappaStorage.get(key) || 0;
    const pendTotN = mappaPendTot.get(key) || 0;
    const pendInsN = mappaPendIns.get(key) || 0;
    const lim = pub.limiti;

    return {
      ...pub,
      conteggio: { utenti, aule: mappaAule.get(key) || 0 },
      quota: {
        storage: {
          usatoByte: storageByte,
          usatoGb: storageByte / Scuola.BYTE_PER_GB,
          limiteByte: lim.storageByte,
          limiteGb: lim.storageGb,
          illimitato: lim.storageByte === null,
          percentuale: percentuale(storageByte, lim.storageByte),
        },
        utenti: {
          usati: utenti,
          pendenti: pendTotN,
          occupati: utenti + pendTotN,
          limite: lim.utenti,
          illimitato: lim.utenti === null,
          percentuale: percentuale(utenti + pendTotN, lim.utenti),
        },
        insegnanti: {
          usati: insegnanti,
          pendenti: pendInsN,
          occupati: insegnanti + pendInsN,
          limite: lim.insegnanti,
          illimitato: lim.insegnanti === null,
          percentuale: percentuale(insegnanti + pendInsN, lim.insegnanti),
        },
      },
    };
  });

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

  const [utenti, aule, quota] = await Promise.all([
    Utente.count({ where: { scuola_id: scuolaId } }),
    Classe.count({ where: { scuola_id: scuolaId } }),
    quotaService.riepilogo(scuola),
  ]);

  return { ...scuola.toPublicJSON(), conteggio: { utenti, aule }, quota };
};

// ─────────────────────────────────────────────
// QUOTA CORRENTE — occupazione vs limiti per una scuola.
//   - admin      → qualsiasi scuola (passando scuolaId);
//   - insegnante → esclusivamente la propria.
// Serve al pannello per mostrare barre di occupazione (storage/utenti/insegnanti).
// ─────────────────────────────────────────────
const quotaScuola = async (richiedente, scuolaId) => {
  assicuraGestioneImpostazioni(richiedente, scuolaId);
  const scuola = await caricaScuola(scuolaId);
  return quotaService.riepilogo(scuola);
};

// ─────────────────────────────────────────────
// AGGIORNA SCUOLA (admin) — anagrafica + impostazioni (sostituzione integrale)
// ─────────────────────────────────────────────
const aggiornaScuola = async (
  scuolaId,
  { nome, slug, impostazioni, attiva, predefinita, limiteStorageGb, limiteUtenti, limiteInsegnanti, commissionePiattaformaPercentuale }
) => {
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

  // Quote (solo se il campo è presente nel payload). `null`/vuoto ⇒ illimitato.
  if (limiteStorageGb !== undefined) scuola.limite_storage_byte = Scuola.gbABytes(limiteStorageGb);
  if (limiteUtenti !== undefined) scuola.limite_utenti = intONull(limiteUtenti);
  if (limiteInsegnanti !== undefined) scuola.limite_insegnanti = intONull(limiteInsegnanti);

  // Commissione della piattaforma (application fee), decisa dall'ADMIN. `null`/
  // vuoto ⇒ nessuna commissione (0%). Colonna dedicata, fuori dalla portata
  // dello staff.
  if (commissionePiattaformaPercentuale !== undefined) {
    scuola.commissione_piattaforma_percentuale = denaro.aPercentuale(
      commissionePiattaformaPercentuale
    );
  }

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
// BLOCCA / SBLOCCA SCUOLA (admin)
//
// Imposta il flag `attiva`. Una scuola sospesa (attiva = false):
//   - non risolve il proprio dominio pubblico (impostazioniService.perDominio);
//   - nega il LOGIN e le sessioni attive a TUTTI i suoi utenti, studenti
//     compresi (impostazioniService.assicuraScuolaAccessibile, usato in
//     authService e nel middleware auth);
//   - conserva INTATTI tutti i dati: è reversibile in qualsiasi momento.
//
// È lo strumento pensato per i contratti scaduti/non rinnovati: si blocca
// l'accesso senza perdere nulla, e si sblocca alla ripresa del rapporto.
// ─────────────────────────────────────────────
const impostaStatoScuola = async (scuolaId, attiva) => {
  const scuola = await caricaScuola(scuolaId);
  scuola.attiva = Boolean(attiva);
  await scuola.save();

  impostazioniService.invalida(scuolaId);
  logger.info(
    `[SCUOLA] Scuola ${scuolaId} ${scuola.attiva ? 'sbloccata (attiva)' : 'BLOCCATA (sospesa)'}`
  );
  return scuola.toPublicJSON();
};

/** Rimuove ricorsivamente la cartella upload della scuola (best-effort). */
const rimuoviCartellaScuola = async (scuolaId) => {
  const dir = path.join(UPLOAD_DIR, UPLOAD_SUBDIR_CORSI, String(scuolaId));
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch (err) {
    logger.warn(`[SCUOLA] Impossibile rimuovere la cartella ${dir}: ${err.message}`);
  }
};

// ─────────────────────────────────────────────
// ELIMINA SCUOLA (admin)
//
// Due modalità:
//   - STANDARD (forza = false): bloccata se esistono utenti collegati
//     (FK RESTRICT su utenti.scuola_id), per non orfanare account per sbaglio.
//   - FORZATA  (forza = true): elimina la scuola e TUTTI i suoi dati —
//     utenti, aule, corsi (video/immagini/documenti), compiti, messaggi,
//     quiz, certificati, notifiche, eventi, inviti, domini. I binari su disco
//     vengono rimossi; i metadati e le righe collegate cadono in CASCADE.
//     Operazione IRREVERSIBILE.
//
// Ordine dell'eliminazione forzata:
//   1. rimozione dei binari su disco (i metadati file_caricati cadono poi in
//      CASCADE con la scuola);
//   2. in transazione: prima gli UTENTI (unico vincolo RESTRICT verso la
//      scuola), poi la SCUOLA — che porta con sé, in CASCADE, tutto il resto.
// ─────────────────────────────────────────────
const eliminaScuola = async (scuolaId, { forza = false } = {}) => {
  const scuola = await caricaScuola(scuolaId);

  if (!forza) {
    const utentiCollegati = await Utente.count({ where: { scuola_id: scuolaId } });
    if (utentiCollegati > 0) {
      throw new AppError(
        `Impossibile eliminare la scuola: ha ancora ${utentiCollegati} utenti collegati. ` +
          'Sposta o elimina prima gli utenti, oppure usa l\'eliminazione definitiva.',
        409,
        'SCUOLA_HAS_USERS'
      );
    }

    await scuola.destroy();
    impostazioniService.invalida();
    logger.info(`[SCUOLA] Eliminata scuola ${scuolaId}`);
    return;
  }

  // ── Eliminazione FORZATA (definitiva) ──
  // 1. Binari su disco: iteriamo i metadati file_caricati della scuola e ne
  //    rimuoviamo il binario (best-effort, qualunque sottocartella).
  const file = await FileCaricato.findAll({
    where: { scuola_id: scuolaId },
    attributes: ['id', 'percorso', 'tipo', 'nome_originale'],
  });
  for (const f of file) {
    await fileService.rimuoviBinario(f);
  }
  await rimuoviCartellaScuola(scuolaId);

  // 2. Database: utenti (FK RESTRICT verso la scuola) poi la scuola (CASCADE).
  await sequelize.transaction(async (t) => {
    await Utente.destroy({ where: { scuola_id: scuolaId }, transaction: t });
    await scuola.destroy({ transaction: t });
  });

  impostazioniService.invalida();
  logger.warn(
    `[SCUOLA] Eliminazione DEFINITIVA della scuola ${scuolaId} "${scuola.nome}": ` +
      `${file.length} file rimossi dal disco e tutti i dati cancellati.`
  );
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
  quotaScuola,
  aggiornaScuola,
  aggiornaImpostazioni,
  impostaStatoScuola,
  eliminaScuola,
  scuolaCorrente,
  impostazioniCorrenti,
  slugUnivoco,
};
