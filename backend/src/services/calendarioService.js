'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const EventoCalendario = require('../models/EventoCalendario');
const EventoDestinatario = require('../models/EventoDestinatario');
const ClasseUtente = require('../models/ClasseUtente');
const Classe = require('../models/Classe');
const Utente = require('../models/Utente');
const Compito = require('../models/Compito');
const CompitoConsegna = require('../models/CompitoConsegna');
const AppError = require('../utils/AppError');
const { escapeLike } = require('../utils/escapeLike');
const { assicuraStessaScuola, risolviScuolaCreazione, isAdmin } = require('../utils/tenant');
const logger = require('../utils/logger');
const { rilevaPiattaforma, trova: trovaTipoEvento } = require('../constants/tipiEvento');
// Riuso (DRY) della logica di derivazione dei compiti destinati a uno studente
// e dello stato per-studente: appartengono al dominio dei compiti e non vanno
// riscritti qui.
const { idCompitiDestinati, statoPerStudente } = require('./compitiService');

/**
 * CalendarioService — logica di dominio del CALENDARIO.
 *
 *   CRUD eventi · destinatari (aula/studente) · FEED UNIFICATO
 *
 * Il calendario è alimentato da DUE sorgenti che vengono unite nel feed:
 *   - EVENTI persistiti (`eventi_calendario`): lezioni, riunioni, verifiche e
 *     soprattutto videochiamate con link (Zoom/Meet/Teams…);
 *   - SCADENZE DEI COMPITI, derivate a runtime dai compiti pubblicati destinati
 *     all'utente (nessuna duplicazione: la fonte resta la sezione Compiti).
 *
 * Regole di accesso:
 *   - il feed è accessibile a studenti e insegnanti; ognuno vede solo ciò che lo
 *     riguarda (eventi a lui destinati / da lui creati; compiti a lui destinati /
 *     da lui creati);
 *   - la gestione degli eventi (crea/modifica/elimina/destinatari) è riservata a
 *     insegnante|admin; un insegnante gestisce SOLO i propri eventi e può
 *     destinarli solo alle proprie aule o a studenti delle proprie aule.
 */

// Finestra temporale di default del feed quando il client non passa ?da/?a.
const GIORNI_FINESTRA_DEFAULT = 60;
const MS_GIORNO = 24 * 60 * 60 * 1000;

const ATTRIBUTI_STUDENTE = ['id', 'nome', 'cognome', 'email'];

// ─────────────────────────────────────────────
// Helpers: caricamento e autorizzazione
// ─────────────────────────────────────────────

const caricaEvento = async (eventoId, opzioni = {}) => {
  const evento = await EventoCalendario.findByPk(eventoId, opzioni);
  if (!evento) {
    throw new AppError('Evento non trovato.', 404, 'EVENTO_NOT_FOUND');
  }
  return evento;
};

/** L'insegnante gestisce solo i propri eventi; l'admin tutti. */
const assicuraProprietaEvento = (evento, richiedente) => {
  if (isAdmin(richiedente)) return;
  if (String(evento.creato_da) !== String(richiedente.id)) {
    throw new AppError('Non hai accesso a questo evento.', 403, 'FORBIDDEN');
  }
};

/** True se il richiedente è insegnante dell'aula (o admin). */
const insegnaNellaClasse = async (classeId, richiedente, transaction) => {
  if (isAdmin(richiedente)) return true;
  const m = await ClasseUtente.findOne({
    where: { classe_id: classeId, utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    transaction,
  });
  return !!m;
};

/** True se il richiedente condivide almeno un'aula (come insegnante) con lo studente. */
const condivideClasseConStudente = async (utenteId, richiedente, transaction) => {
  if (isAdmin(richiedente)) return true;
  const auleInsegnate = await ClasseUtente.findAll({
    where: { utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  const ids = auleInsegnate.map((r) => r.classe_id);
  if (!ids.length) return false;
  const m = await ClasseUtente.findOne({
    where: { classe_id: { [Op.in]: ids }, utente_id: utenteId, ruolo_nella_classe: 'studente' },
    transaction,
  });
  return !!m;
};

/** Elenco degli id aula in cui l'utente ha il ruolo indicato ('insegnante'|'studente'). */
const idAuleUtente = async (utenteId, ruoloNellaClasse, transaction) => {
  const righe = await ClasseUtente.findAll({
    where: { utente_id: utenteId, ruolo_nella_classe: ruoloNellaClasse },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  return righe.map((r) => r.classe_id);
};

/** Valida la coppia (classeId|utenteId): esattamente uno dei due. */
const normalizzaBersaglio = ({ classeId, utenteId }) => {
  if (Boolean(classeId) === Boolean(utenteId)) {
    throw new AppError(
      'Specificare esattamente uno tra classeId e utenteId.',
      422,
      'INVALID_TARGET'
    );
  }
  return { classeId: classeId || null, utenteId: utenteId || null };
};

/**
 * Applica un singolo destinatario (aula o studente) con autorizzazione e
 * idempotenza. Usata sia in creazione (inline) sia dall'endpoint dedicato.
 */
const applicaDestinatario = async ({ eventoId, bersaglio, richiedente, transaction }) => {
  const { classeId, utenteId } = normalizzaBersaglio(bersaglio);

  if (classeId) {
    const classe = await Classe.findByPk(classeId, { transaction });
    if (!classe) throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
    // Confine di tenant + membership (difesa in profondità).
    assicuraStessaScuola(richiedente, classe.scuola_id, 'Questa aula non appartiene alla tua scuola.');
    if (!(await insegnaNellaClasse(classeId, richiedente, transaction))) {
      throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
    }
  } else {
    const studente = await Utente.findByPk(utenteId, { transaction });
    if (!studente || studente.ruolo !== 'studente') {
      throw new AppError('Studente non trovato.', 404, 'USER_NOT_FOUND');
    }
    assicuraStessaScuola(richiedente, studente.scuola_id, 'Questo studente non appartiene alla tua scuola.');
    if (!(await condivideClasseConStudente(utenteId, richiedente, transaction))) {
      throw new AppError('Puoi destinare eventi solo a studenti delle tue aule.', 403, 'FORBIDDEN');
    }
  }

  const [destinatario, creato] = await EventoDestinatario.findOrCreate({
    where: { evento_id: eventoId, classe_id: classeId, utente_id: utenteId },
    defaults: {
      evento_id: eventoId,
      classe_id: classeId,
      utente_id: utenteId,
      aggiunto_da: richiedente.id,
    },
    transaction,
  });

  if (!creato) {
    throw new AppError('Questo destinatario è già associato all\'evento.', 409, 'ALREADY_ASSIGNED');
  }

  return destinatario;
};

/** Normalizza un link: trim e null se vuoto. */
const normalizzaLink = (link) => {
  if (link === undefined) return undefined; // «non fornito» (per l'update)
  if (link === null) return null;
  const t = String(link).trim();
  return t.length ? t : null;
};

/** Coerenza dell'intervallo: la fine (se presente) non precede l'inizio. */
const validaIntervallo = (dataInizio, dataFine) => {
  if (dataInizio && dataFine && new Date(dataFine).getTime() < new Date(dataInizio).getTime()) {
    throw new AppError(
      'La data di fine non può precedere la data di inizio.',
      422,
      'INTERVALLO_NON_VALIDO'
    );
  }
};

// ─────────────────────────────────────────────
// INSEGNANTE/ADMIN — CREA EVENTO (con destinatari facoltativi inline)
// ─────────────────────────────────────────────
const creaEvento = async ({ dati, destinatari, richiedente }) => {
  // Scuola dell'evento: timbrata dalla scuola dell'insegnante (null per l'admin).
  const scuolaId = risolviScuolaCreazione(richiedente, null, {
    scuolaObbligatoriaPerAdmin: false,
  });

  const tipo = dati.tipo || 'lezione';
  const linkVideochiamata = normalizzaLink(dati.linkVideochiamata) ?? null;
  const piattaforma = rilevaPiattaforma(linkVideochiamata);
  const colore = dati.colore ?? (trovaTipoEvento(tipo)?.colore ?? null);

  validaIntervallo(dati.dataInizio, dati.dataFine);

  return sequelize.transaction(async (t) => {
    const evento = await EventoCalendario.create(
      {
        titolo: dati.titolo.trim(),
        descrizione: dati.descrizione ?? null,
        tipo,
        data_inizio: dati.dataInizio,
        data_fine: dati.dataFine ?? null,
        tutto_il_giorno: dati.tuttoIlGiorno ?? false,
        luogo: dati.luogo ?? null,
        link_videochiamata: linkVideochiamata,
        piattaforma_videochiamata: piattaforma,
        colore,
        scuola_id: scuolaId,
        creato_da: richiedente.id,
      },
      { transaction: t }
    );

    const destinatariCreati = [];
    if (Array.isArray(destinatari)) {
      for (const bersaglio of destinatari) {
        const d = await applicaDestinatario({
          eventoId: evento.id,
          bersaglio,
          richiedente,
          transaction: t,
        });
        destinatariCreati.push(d.toPublicJSON());
      }
    }

    logger.info(`[CALENDARIO] Creato evento ${evento.id} "${evento.titolo}" da ${richiedente.id}`);

    return { ...evento.toPublicJSON(), destinatari: destinatariCreati };
  });
};

// ─────────────────────────────────────────────
// INSEGNANTE/ADMIN — ELENCO EVENTI CREATI (gestione)
// ─────────────────────────────────────────────
const elencoEventi = async ({ richiedente, filtri }) => {
  const { tipo, q, da, a, page, limit } = filtri;
  const where = {};

  if (!isAdmin(richiedente)) where.creato_da = richiedente.id;
  if (tipo) where.tipo = tipo;
  if (q) where.titolo = { [Op.like]: `%${escapeLike(String(q).trim())}%` };
  if (da || a) {
    where.data_inizio = {};
    if (da) where.data_inizio[Op.gte] = da;
    if (a) where.data_inizio[Op.lte] = a;
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione =
    Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = { where, order: [['data_inizio', 'ASC']] };
  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  let righe;
  let totale = null;
  if (usaPaginazione) {
    const r = await EventoCalendario.findAndCountAll(queryOptions);
    righe = r.rows;
    totale = r.count;
  } else {
    righe = await EventoCalendario.findAll(queryOptions);
  }

  // Conteggio destinatari in una sola query aggregata (niente N+1).
  const ids = righe.map((e) => e.id);
  const mappaDest = new Map(); // evento_id → { classi, studenti }
  if (ids.length) {
    const destRows = await EventoDestinatario.findAll({
      where: { evento_id: { [Op.in]: ids } },
      attributes: ['evento_id', 'classe_id', 'utente_id'],
      raw: true,
    });
    for (const d of destRows) {
      const cur = mappaDest.get(d.evento_id) || { classi: 0, studenti: 0 };
      if (d.classe_id) cur.classi += 1;
      else cur.studenti += 1;
      mappaDest.set(d.evento_id, cur);
    }
  }

  const eventi = righe.map((e) => ({
    ...e.toPublicJSON(),
    destinatari: mappaDest.get(e.id) || { classi: 0, studenti: 0 },
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { eventi, paginazione };
};

// ─────────────────────────────────────────────
// INSEGNANTE/ADMIN — DETTAGLIO EVENTO (con destinatari espansi)
// ─────────────────────────────────────────────
const dettaglioEvento = async ({ eventoId, richiedente }) => {
  const evento = await caricaEvento(eventoId, {
    include: [
      {
        model: EventoDestinatario,
        as: 'destinatari',
        include: [
          { model: Classe, as: 'classe', attributes: ['id', 'nome'] },
          { model: Utente, as: 'studente', attributes: ATTRIBUTI_STUDENTE },
        ],
      },
    ],
  });

  assicuraProprietaEvento(evento, richiedente);

  const destinatari = (evento.destinatari || []).map((d) => ({
    ...d.toPublicJSON(),
    classe: d.classe ? { id: d.classe.id, nome: d.classe.nome } : null,
    studente: d.studente
      ? { id: d.studente.id, nome: d.studente.nome, cognome: d.studente.cognome, email: d.studente.email }
      : null,
  }));

  return { ...evento.toPublicJSON(), destinatari };
};

// ─────────────────────────────────────────────
// INSEGNANTE/ADMIN — AGGIORNA EVENTO
// ─────────────────────────────────────────────
const aggiornaEvento = async ({ eventoId, dati, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const evento = await caricaEvento(eventoId, { transaction: t });
    assicuraProprietaEvento(evento, richiedente);

    if (dati.titolo !== undefined) evento.titolo = dati.titolo.trim();
    if (dati.descrizione !== undefined) evento.descrizione = dati.descrizione;
    if (dati.tipo !== undefined) evento.tipo = dati.tipo;
    if (dati.dataInizio !== undefined) evento.data_inizio = dati.dataInizio;
    if (dati.dataFine !== undefined) evento.data_fine = dati.dataFine;
    if (dati.tuttoIlGiorno !== undefined) evento.tutto_il_giorno = dati.tuttoIlGiorno;
    if (dati.luogo !== undefined) evento.luogo = dati.luogo;
    if (dati.colore !== undefined) evento.colore = dati.colore;

    // Il link, se toccato, aggiorna anche la piattaforma rilevata.
    const linkNorm = normalizzaLink(dati.linkVideochiamata);
    if (linkNorm !== undefined) {
      evento.link_videochiamata = linkNorm;
      evento.piattaforma_videochiamata = rilevaPiattaforma(linkNorm);
    }

    // Coerenza dell'intervallo sui valori risultanti.
    validaIntervallo(evento.data_inizio, evento.data_fine);

    await evento.save({ transaction: t });

    logger.info(`[CALENDARIO] Aggiornato evento ${evento.id} da ${richiedente.id}`);
    return evento.toPublicJSON();
  });
};

// ─────────────────────────────────────────────
// INSEGNANTE/ADMIN — ELIMINA EVENTO (CASCADE sui destinatari)
// ─────────────────────────────────────────────
const eliminaEvento = async ({ eventoId, richiedente }) => {
  const evento = await caricaEvento(eventoId);
  assicuraProprietaEvento(evento, richiedente);
  await evento.destroy();
  logger.info(`[CALENDARIO] Eliminato evento ${eventoId} da ${richiedente.id}`);
};

// ─────────────────────────────────────────────
// INSEGNANTE/ADMIN — DESTINATARI (endpoint dedicati)
// ─────────────────────────────────────────────
const aggiungiDestinatario = async ({ eventoId, bersaglio, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const evento = await caricaEvento(eventoId, { transaction: t });
    assicuraProprietaEvento(evento, richiedente);
    const destinatario = await applicaDestinatario({ eventoId, bersaglio, richiedente, transaction: t });
    return destinatario.toPublicJSON();
  });
};

const rimuoviDestinatario = async ({ eventoId, destinatarioId, richiedente }) => {
  return sequelize.transaction(async (t) => {
    const evento = await caricaEvento(eventoId, { transaction: t });
    assicuraProprietaEvento(evento, richiedente);

    const destinatario = await EventoDestinatario.findOne({
      where: { id: destinatarioId, evento_id: eventoId },
      transaction: t,
    });
    if (!destinatario) {
      throw new AppError('Destinatario non trovato.', 404, 'DESTINATARIO_NOT_FOUND');
    }
    await destinatario.destroy({ transaction: t });
    logger.info(`[CALENDARIO] Rimosso destinatario ${destinatarioId} dall'evento ${eventoId}`);
  });
};

// ─────────────────────────────────────────────
// FEED UNIFICATO (studenti + insegnanti + admin)
//   Unisce eventi persistiti e scadenze dei compiti nella finestra [da, a].
// ─────────────────────────────────────────────

/** Risolve la finestra temporale del feed (default: da oggi, 60 giorni). */
const risolviFinestra = (filtri) => {
  const ora = new Date();
  const inizioGiorno = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate());
  const da = filtri.da ? new Date(filtri.da) : inizioGiorno;
  const a = filtri.a
    ? new Date(filtri.a)
    : new Date(da.getTime() + GIORNI_FINESTRA_DEFAULT * MS_GIORNO);
  return { da, a };
};

/** Voce di feed a partire da un evento persistito. */
const eventoAVoce = (evento, richiedente) => ({
  tipoVoce: 'evento',
  ...evento.toPublicJSON(),
  modificabile: isAdmin(richiedente) || String(evento.creato_da) === String(richiedente.id),
});

/** Voce di feed a partire da un compito (scadenza). */
const compitoAVoce = (compito, statoStudente = null) => ({
  tipoVoce: 'compito',
  id: compito.id,
  titolo: compito.titolo,
  descrizione: compito.descrizione ?? null,
  // Etichetta neutra: una scadenza non è un tipo di evento del registro, ma il
  // frontend può renderla con uno stile dedicato.
  tipo: 'scadenza_compito',
  dataInizio: compito.data_scadenza,
  dataFine: null,
  tuttoIlGiorno: false,
  luogo: null,
  linkVideochiamata: null,
  piattaformaVideochiamata: null,
  colore: null,
  // La gestione del compito resta nella sezione Compiti.
  modificabile: false,
  origine: { tipo: 'compito', compitoId: compito.id, statoCompito: compito.stato },
  ...(statoStudente ? { statoStudente } : {}),
});

/** Eventi visibili al richiedente nella finestra temporale. */
const eventiVisibili = async ({ richiedente, da, a, tipo }) => {
  // Intersezione evento↔finestra: inizio ≤ a e (fine ≥ da, oppure fine assente e
  // inizio ≥ da).
  const finestra = {
    [Op.and]: [
      { data_inizio: { [Op.lte]: a } },
      {
        [Op.or]: [
          { data_fine: { [Op.gte]: da } },
          { [Op.and]: [{ data_fine: null }, { data_inizio: { [Op.gte]: da } }] },
        ],
      },
    ],
  };

  const where = { [Op.and]: [finestra] };
  if (tipo) where[Op.and].push({ tipo });

  // L'admin è trasversale: vede tutti gli eventi nella finestra.
  if (!isAdmin(richiedente)) {
    const eventoIds = new Set();

    if (richiedente.ruolo === 'insegnante') {
      // Eventi creati da lui.
      const creati = await EventoCalendario.findAll({
        where: { creato_da: richiedente.id },
        attributes: ['id'],
        raw: true,
      });
      for (const e of creati) eventoIds.add(e.id);
    }

    // Aule di cui è membro (studente o insegnante) → eventi destinati a quelle aule.
    const ruoloAula = richiedente.ruolo === 'insegnante' ? 'insegnante' : 'studente';
    const auleIds = await idAuleUtente(richiedente.id, ruoloAula);

    const orDest = [{ utente_id: richiedente.id }];
    if (auleIds.length) orDest.push({ classe_id: { [Op.in]: auleIds } });

    const dest = await EventoDestinatario.findAll({
      where: { [Op.or]: orDest },
      attributes: ['evento_id'],
      raw: true,
    });
    for (const d of dest) eventoIds.add(d.evento_id);

    if (!eventoIds.size) return [];
    where[Op.and].push({ id: { [Op.in]: [...eventoIds] } });
  }

  const eventi = await EventoCalendario.findAll({ where, order: [['data_inizio', 'ASC']] });
  return eventi.map((e) => eventoAVoce(e, richiedente));
};

/** Scadenze dei compiti visibili al richiedente nella finestra temporale. */
const compitiVisibili = async ({ richiedente, da, a }) => {
  const rangeScadenza = { data_scadenza: { [Op.between]: [da, a] } };

  // Studente: compiti pubblicati a lui destinati, con lo stato per-studente.
  if (richiedente.ruolo === 'studente') {
    const compitoIds = await idCompitiDestinati(richiedente.id);
    if (!compitoIds.length) return [];

    const compiti = await Compito.findAll({
      where: { id: { [Op.in]: compitoIds }, stato: 'pubblicato', ...rangeScadenza },
      order: [['data_scadenza', 'ASC']],
    });
    if (!compiti.length) return [];

    const consegne = await CompitoConsegna.findAll({
      where: { compito_id: { [Op.in]: compiti.map((c) => c.id) }, utente_id: richiedente.id },
    });
    const mappaConsegne = new Map(consegne.map((c) => [String(c.compito_id), c]));

    const ora = Date.now();
    return compiti.map((c) =>
      compitoAVoce(c, statoPerStudente(c, mappaConsegne.get(String(c.id)) || null, ora))
    );
  }

  // Insegnante: compiti da lui creati. Admin: tutti (trasversale), sempre entro
  // la finestra temporale che limita la cardinalità.
  const where = { ...rangeScadenza };
  if (!isAdmin(richiedente)) where.creato_da = richiedente.id;

  const compiti = await Compito.findAll({ where, order: [['data_scadenza', 'ASC']] });
  return compiti.map((c) => compitoAVoce(c));
};

/**
 * Feed unificato del calendario.
 *
 * @param {Object} args
 * @param {Object} args.richiedente
 * @param {Object} args.filtri            { da?, a?, tipoVoce? }
 * @param {boolean} args.includiCompiti   se false, il feed omette le scadenze
 *   dei compiti (usato quando la scuola ha la sezione Compiti disattivata).
 */
const feedCalendario = async ({ richiedente, filtri = {}, includiCompiti = true }) => {
  const { da, a } = risolviFinestra(filtri);
  const soloTipo = filtri.tipoVoce || null; // 'evento' | 'compito' | null

  let voci = [];

  if (soloTipo !== 'compito') {
    const eventi = await eventiVisibili({ richiedente, da, a, tipo: null });
    voci = voci.concat(eventi);
  }

  if (includiCompiti && soloTipo !== 'evento') {
    const compiti = await compitiVisibili({ richiedente, da, a });
    voci = voci.concat(compiti);
  }

  // Ordinamento cronologico stabile per inizio.
  voci.sort((x, y) => new Date(x.dataInizio).getTime() - new Date(y.dataInizio).getTime());

  return {
    voci,
    finestra: { da, a },
  };
};

module.exports = {
  creaEvento,
  elencoEventi,
  dettaglioEvento,
  aggiornaEvento,
  eliminaEvento,
  aggiungiDestinatario,
  rimuoviDestinatario,
  feedCalendario,
};
