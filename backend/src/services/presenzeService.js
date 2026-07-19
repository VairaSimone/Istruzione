'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const RegistroPresenza = require('../models/RegistroPresenza');
const VocePresenza = require('../models/VocePresenza');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { assicuraStessaScuola, risolviScuolaCreazione, isAdmin } = require('../utils/tenant');
const { esiste: statoEsiste, STATO_PRESENZA_DEFAULT, contaPerLimite } = require('../constants/statiPresenza');
const impostazioniService = require('./impostazioniService');
const { configPresenze } = require('../constants/impostazioniScuola');

/**
 * PresenzeService — logica di dominio del REGISTRO PRESENZE.
 *
 *   Appello per aula/data · voci per-studente · riepilogo con LIMITE ASSENZE
 *
 * Struttura speculare ai compiti: il `RegistroPresenza` è l'intestazione
 * dell'appello di un'aula in un giorno, le `VocePresenza` sono il corpo (una
 * riga per studente). All'apertura di un registro il roster viene precompilato
 * dagli studenti attualmente iscritti all'aula, tutti con stato «presente».
 *
 * Regole di accesso:
 *   - la gestione (apri/modifica/elimina appello, segna presenze, riepilogo) è
 *     riservata a insegnante|admin; un insegnante opera SOLO sulle proprie aule;
 *   - lo studente vede SOLO le proprie presenze e il proprio conteggio.
 *
 * Il LIMITE DI ASSENZE è configurato per scuola
 * (`impostazioni.presenze.limiteAssenze`) e applicato qui: il servizio decide,
 * in base a `conteggioGiustificate`, quali stati contano come assenza e segnala
 * gli studenti che superano (>) il limite. `limiteAssenze` null ⇒ nessuna
 * segnalazione (il conteggio resta comunque disponibile).
 */

const ATTRIBUTI_STUDENTE = ['id', 'nome', 'cognome', 'email'];

// ─────────────────────────────────────────────
// Helpers: caricamento e autorizzazione
// ─────────────────────────────────────────────

/** Normalizza una data (Date | 'YYYY-MM-DD') nella sola parte giorno. */
const soloGiorno = (valore) => {
  if (!valore) return null;
  if (valore instanceof Date) {
    if (Number.isNaN(valore.getTime())) return null;
    return valore.toISOString().slice(0, 10);
  }
  const s = String(valore).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
};

const caricaRegistro = async (registroId, opzioni = {}) => {
  const registro = await RegistroPresenza.findByPk(registroId, opzioni);
  if (!registro) {
    throw new AppError('Registro presenze non trovato.', 404, 'REGISTRO_NOT_FOUND');
  }
  return registro;
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

/**
 * Carica un'aula assicurando confine di tenant e (per l'insegnante) che vi
 * insegni. Restituisce l'istanza dell'aula.
 */
const caricaAulaAutorizzata = async (classeId, richiedente, transaction) => {
  const aula = await Classe.findByPk(classeId, { transaction });
  if (!aula) throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
  assicuraStessaScuola(richiedente, aula.scuola_id, 'Questa aula non appartiene alla tua scuola.');
  if (!(await insegnaNellaClasse(classeId, richiedente, transaction))) {
    throw new AppError('Non insegni in questa aula.', 403, 'FORBIDDEN');
  }
  return aula;
};

/** L'insegnante gestisce solo i registri delle proprie aule; l'admin tutti. */
const assicuraAccessoRegistro = async (registro, richiedente, transaction) => {
  if (isAdmin(richiedente)) return;
  assicuraStessaScuola(richiedente, registro.scuola_id, 'Questo registro non appartiene alla tua scuola.');
  if (!(await insegnaNellaClasse(registro.classe_id, richiedente, transaction))) {
    throw new AppError('Non hai accesso a questo registro.', 403, 'FORBIDDEN');
  }
};

/** Id degli studenti attualmente iscritti all'aula. */
const idStudentiAula = async (classeId, transaction) => {
  const righe = await ClasseUtente.findAll({
    where: { classe_id: classeId, ruolo_nella_classe: 'studente' },
    attributes: ['utente_id'],
    raw: true,
    transaction,
  });
  return righe.map((r) => r.utente_id);
};

/** Elenco degli id aula in cui il richiedente insegna (per lo scope docente). */
const idAuleInsegnate = async (richiedente, transaction) => {
  const righe = await ClasseUtente.findAll({
    where: { utente_id: richiedente.id, ruolo_nella_classe: 'insegnante' },
    attributes: ['classe_id'],
    raw: true,
    transaction,
  });
  return righe.map((r) => r.classe_id);
};

/** Config presenze risolta per la scuola dell'aula/registro. */
const configPerScuola = async (scuolaId) => {
  const persistite = scuolaId ? await impostazioniService.perScuola(scuolaId) : null;
  // `perScuola` restituisce già il blob con i default applicati: rileggiamo la
  // sola sezione presenze da lì per non riapplicare i default due volte.
  if (persistite && persistite.presenze) return { ...persistite.presenze };
  return configPresenze(null);
};

// ═════════════════════════════ GESTIONE APPELLO ═════════════════════════════

/**
 * Apre un registro per un'aula in una data e ne precompila il roster con gli
 * studenti iscritti (tutti «presente»). Se il registro di quel giorno esiste
 * già, la creazione è respinta con 409 (usare l'endpoint di dettaglio/voci per
 * modificarlo).
 */
const creaRegistro = async ({ dati, richiedente }) => {
  const { classeId, data, argomento, note } = dati;
  const giorno = soloGiorno(data);
  if (!giorno) throw new AppError('La data dell\'appello non è valida.', 422, 'INVALID_DATE');

  return sequelize.transaction(async (transaction) => {
    const aula = await caricaAulaAutorizzata(classeId, richiedente, transaction);

    // Tenant del registro: per l'insegnante la propria scuola, per l'admin
    // quella dell'aula (coerente, l'aula ha già uno scuola_id).
    const scuolaId = risolviScuolaCreazione(richiedente, aula.scuola_id) || aula.scuola_id;

    const esistente = await RegistroPresenza.findOne({
      where: { classe_id: classeId, data: giorno },
      transaction,
    });
    if (esistente) {
      throw new AppError(
        'Esiste già un appello per questa aula in questa data.',
        409,
        'REGISTRO_ESISTENTE'
      );
    }

    const registro = await RegistroPresenza.create(
      {
        classe_id: classeId,
        scuola_id: scuolaId,
        data: giorno,
        argomento: argomento || null,
        note: note || null,
        creato_da: richiedente.id,
      },
      { transaction }
    );

    // Roster iniziale: una voce per studente iscritto, tutti «presente».
    const studenti = await idStudentiAula(classeId, transaction);
    if (studenti.length) {
      await VocePresenza.bulkCreate(
        studenti.map((utenteId) => ({
          registro_id: registro.id,
          utente_id: utenteId,
          stato: STATO_PRESENZA_DEFAULT,
          registrato_da: richiedente.id,
        })),
        { transaction }
      );
    }

    logger.info(`[PRESENZE] Aperto registro ${registro.id} aula ${classeId} data ${giorno} da ${richiedente.id}`);
    return dettaglioRegistroInterno(registro.id, transaction);
  });
};

/** Costruisce il dettaglio (registro + voci con dati studente) in una transazione. */
const dettaglioRegistroInterno = async (registroId, transaction) => {
  const registro = await caricaRegistro(registroId, { transaction });
  const voci = await VocePresenza.findAll({
    where: { registro_id: registroId },
    include: [{ model: Utente, as: 'studente', attributes: ATTRIBUTI_STUDENTE }],
    transaction,
  });

  const vociPubbliche = voci
    .map((v) => ({
      ...v.toPublicJSON(),
      studente: v.studente ? v.studente.toPublicJSON?.() ?? {
        id: v.studente.id, nome: v.studente.nome, cognome: v.studente.cognome, email: v.studente.email,
      } : null,
    }))
    .sort((a, b) => {
      const na = `${a.studente?.cognome ?? ''} ${a.studente?.nome ?? ''}`.trim().toLowerCase();
      const nb = `${b.studente?.cognome ?? ''} ${b.studente?.nome ?? ''}`.trim().toLowerCase();
      return na.localeCompare(nb);
    });

  return { ...registro.toPublicJSON(), voci: vociPubbliche };
};

/** GET dettaglio (con autorizzazione). */
const dettaglioRegistro = async ({ registroId, richiedente }) => {
  const registro = await caricaRegistro(registroId);
  await assicuraAccessoRegistro(registro, richiedente);
  return dettaglioRegistroInterno(registroId);
};

/** Elenco registri delle aule del richiedente, con conteggi di sintesi. */
const elencoRegistri = async ({ richiedente, filtri = {} }) => {
  const { classeId, da, a, page, limit } = filtri;

  const where = {};

  if (classeId) {
    // L'accesso all'aula richiesta è verificato (tenant + membership).
    await caricaAulaAutorizzata(classeId, richiedente);
    where.classe_id = classeId;
  } else if (!isAdmin(richiedente)) {
    const ids = await idAuleInsegnate(richiedente);
    if (!ids.length) return { registri: [], paginazione: null };
    where.classe_id = { [Op.in]: ids };
  }

  const giornoDa = soloGiorno(da);
  const giornoA = soloGiorno(a);
  if (giornoDa || giornoA) {
    where.data = {};
    if (giornoDa) where.data[Op.gte] = giornoDa;
    if (giornoA) where.data[Op.lte] = giornoA;
  }

  const pageNum = Number.isInteger(page) && page > 0 ? page : null;
  const limitNum = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : null;
  const usaPaginazione = pageNum !== null && limitNum !== null;

  const queryOptions = {
    where,
    order: [['data', 'DESC']],
    include: [{ model: Classe, as: 'aula', attributes: ['id', 'nome', 'colore'] }],
  };

  let righe;
  let totale = 0;
  if (usaPaginazione) {
    const res = await RegistroPresenza.findAndCountAll({
      ...queryOptions,
      offset: (pageNum - 1) * limitNum,
      limit: limitNum,
    });
    righe = res.rows;
    totale = res.count;
  } else {
    righe = await RegistroPresenza.findAll(queryOptions);
  }

  // Conteggio voci per stato in un'unica query aggregata (niente N+1).
  const ids = righe.map((r) => r.id);
  const conteggi = new Map(); // registro_id → { totale, assenti }
  if (ids.length) {
    const rows = await VocePresenza.findAll({
      where: { registro_id: { [Op.in]: ids } },
      attributes: ['registro_id', 'stato'],
      raw: true,
    });
    for (const r of rows) {
      const cur = conteggi.get(r.registro_id) || { totale: 0, assenti: 0 };
      cur.totale += 1;
      if (contaPerLimite(r.stato, true)) cur.assenti += 1; // sintesi grezza (assenze totali)
      conteggi.set(r.registro_id, cur);
    }
  }

  const registri = righe.map((r) => ({
    ...r.toPublicJSON(),
    aula: r.aula ? { id: r.aula.id, nome: r.aula.nome, colore: r.aula.colore } : null,
    conteggi: conteggi.get(r.id) || { totale: 0, assenti: 0 },
  }));

  const paginazione = usaPaginazione
    ? {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: totale,
        totalePagine: Math.ceil(totale / limitNum),
      }
    : null;

  return { registri, paginazione };
};

/** Aggiorna i metadati dell'appello (argomento/note). */
const aggiornaRegistro = async ({ registroId, dati, richiedente }) => {
  return sequelize.transaction(async (transaction) => {
    const registro = await caricaRegistro(registroId, { transaction });
    await assicuraAccessoRegistro(registro, richiedente, transaction);

    const patch = {};
    if (dati.argomento !== undefined) patch.argomento = dati.argomento || null;
    if (dati.note !== undefined) patch.note = dati.note || null;
    if (Object.keys(patch).length) await registro.update(patch, { transaction });

    return dettaglioRegistroInterno(registroId, transaction);
  });
};

/** Elimina l'appello (e, a cascata, le sue voci). */
const eliminaRegistro = async ({ registroId, richiedente }) => {
  return sequelize.transaction(async (transaction) => {
    const registro = await caricaRegistro(registroId, { transaction });
    await assicuraAccessoRegistro(registro, richiedente, transaction);
    await registro.destroy({ transaction });
    logger.info(`[PRESENZE] Eliminato registro ${registroId} da ${richiedente.id}`);
  });
};

/**
 * Salva (upsert) le voci di presenza di un registro. Accetta solo studenti che
 * risultano ATTUALMENTE iscritti all'aula: le voci per utenti non iscritti sono
 * scartate silenziosamente (difesa in profondità contro id arbitrari). Gli
 * studenti iscritti non citati nel payload restano invariati.
 */
const salvaVoci = async ({ registroId, voci, richiedente }) => {
  if (!Array.isArray(voci) || !voci.length) {
    throw new AppError('Nessuna voce da salvare.', 422, 'NO_VOCI');
  }

  return sequelize.transaction(async (transaction) => {
    const registro = await caricaRegistro(registroId, { transaction });
    await assicuraAccessoRegistro(registro, richiedente, transaction);

    const iscritti = new Set(await idStudentiAula(registro.classe_id, transaction));

    for (const voce of voci) {
      const utenteId = voce.utenteId;
      const stato = voce.stato;
      if (!utenteId || !iscritti.has(utenteId)) continue; // non iscritto ⇒ scartato
      if (!statoEsiste(stato)) {
        throw new AppError(`Stato di presenza non valido: ${stato}.`, 422, 'INVALID_STATO');
      }

      const nota = voce.nota === undefined ? undefined : voce.nota || null;

      const [riga, creata] = await VocePresenza.findOrCreate({
        where: { registro_id: registroId, utente_id: utenteId },
        defaults: {
          registro_id: registroId,
          utente_id: utenteId,
          stato,
          nota: nota ?? null,
          registrato_da: richiedente.id,
        },
        transaction,
      });

      if (!creata) {
        const patch = { stato, registrato_da: richiedente.id };
        if (nota !== undefined) patch.nota = nota;
        await riga.update(patch, { transaction });
      }
    }

    return dettaglioRegistroInterno(registroId, transaction);
  });
};

// ═════════════════════════════ RIEPILOGO AULA ═════════════════════════════

/**
 * Riepilogo delle presenze di un'aula: per ogni studente iscritto il numero di
 * sessioni, le assenze (secondo la politica della scuola), i ritardi e il flag
 * `oltreLimite` rispetto a `impostazioni.presenze.limiteAssenze`.
 */
const riepilogoAula = async ({ classeId, richiedente }) => {
  const aula = await caricaAulaAutorizzata(classeId, richiedente);
  const config = await configPerScuola(aula.scuola_id);
  const limite = config.limiteAssenze; // null | intero
  const conteggioGiustificate = Boolean(config.conteggioGiustificate);

  // Studenti attualmente iscritti (anche chi ha 0 sessioni deve comparire).
  const studenti = await Utente.findAll({
    include: [
      {
        model: ClasseUtente,
        as: 'iscrizioniClasse',
        attributes: [],
        where: { classe_id: classeId, ruolo_nella_classe: 'studente' },
        required: true,
      },
    ],
    attributes: ATTRIBUTI_STUDENTE,
  });

  // Numero di sessioni (registri) dell'aula.
  const registri = await RegistroPresenza.findAll({
    where: { classe_id: classeId },
    attributes: ['id'],
    raw: true,
  });
  const totaleSessioni = registri.length;
  const registroIds = registri.map((r) => r.id);

  // Voci per-studente in un'unica query.
  const perStudente = new Map(); // utente_id → { assenze, giustificate, ritardi, presenze }
  if (registroIds.length) {
    const rows = await VocePresenza.findAll({
      where: { registro_id: { [Op.in]: registroIds } },
      attributes: ['utente_id', 'stato'],
      raw: true,
    });
    for (const r of rows) {
      const cur = perStudente.get(r.utente_id) || {
        assenzeLimite: 0, assenzeTotali: 0, ritardi: 0, presenze: 0, uscite: 0,
      };
      if (r.stato === 'presente') cur.presenze += 1;
      else if (r.stato === 'ritardo') cur.ritardi += 1;
      else if (r.stato === 'uscita_anticipata') cur.uscite += 1;
      if (r.stato === 'assente' || r.stato === 'assente_giustificato') cur.assenzeTotali += 1;
      if (contaPerLimite(r.stato, conteggioGiustificate)) cur.assenzeLimite += 1;
      perStudente.set(r.utente_id, cur);
    }
  }

  const righe = studenti
    .map((s) => {
      const c = perStudente.get(s.id) || { assenzeLimite: 0, assenzeTotali: 0, ritardi: 0, presenze: 0, uscite: 0 };
      return {
        studente: { id: s.id, nome: s.nome, cognome: s.cognome, email: s.email },
        presenze: c.presenze,
        assenze: c.assenzeTotali,
        assenzeConteggiate: c.assenzeLimite,
        ritardi: c.ritardi,
        usciteAnticipate: c.uscite,
        oltreLimite: limite !== null && c.assenzeLimite > limite,
      };
    })
    .sort((a, b) =>
      `${a.studente.cognome} ${a.studente.nome}`.toLowerCase()
        .localeCompare(`${b.studente.cognome} ${b.studente.nome}`.toLowerCase())
    );

  return {
    aula: { id: aula.id, nome: aula.nome, colore: aula.colore },
    totaleSessioni,
    limiteAssenze: limite,
    conteggioGiustificate,
    studenti: righe,
    studentiOltreLimite: righe.filter((r) => r.oltreLimite).length,
  };
};

// ═════════════════════════════ VISTA STUDENTE ═════════════════════════════

/**
 * Le presenze del richiedente-studente: elenco delle proprie voci (con data e
 * aula) e conteggio aggregato rispetto al limite della propria scuola.
 */
const miePresenze = async ({ richiedente, filtri = {} }) => {
  const { da, a } = filtri;

  const config = await configPerScuola(richiedente.scuola_id || null);
  const limite = config.limiteAssenze;
  const conteggioGiustificate = Boolean(config.conteggioGiustificate);

  const whereRegistro = {};
  const giornoDa = soloGiorno(da);
  const giornoA = soloGiorno(a);
  if (giornoDa || giornoA) {
    whereRegistro.data = {};
    if (giornoDa) whereRegistro.data[Op.gte] = giornoDa;
    if (giornoA) whereRegistro.data[Op.lte] = giornoA;
  }

  const voci = await VocePresenza.findAll({
    where: { utente_id: richiedente.id },
    include: [
      {
        model: RegistroPresenza,
        as: 'registro',
        where: Object.keys(whereRegistro).length ? whereRegistro : undefined,
        required: true,
        attributes: ['id', 'data', 'classe_id', 'argomento'],
        include: [{ model: Classe, as: 'aula', attributes: ['id', 'nome', 'colore'] }],
      },
    ],
  });

  const righe = voci
    .map((v) => ({
      id: v.id,
      stato: v.stato,
      nota: v.nota,
      data: v.registro?.data ?? null,
      argomento: v.registro?.argomento ?? null,
      aula: v.registro?.aula
        ? { id: v.registro.aula.id, nome: v.registro.aula.nome, colore: v.registro.aula.colore }
        : null,
    }))
    .sort((a2, b2) => String(b2.data).localeCompare(String(a2.data)));

  let assenzeConteggiate = 0;
  let assenzeTotali = 0;
  let ritardi = 0;
  for (const r of righe) {
    if (r.stato === 'assente' || r.stato === 'assente_giustificato') assenzeTotali += 1;
    if (r.stato === 'ritardo') ritardi += 1;
    if (contaPerLimite(r.stato, conteggioGiustificate)) assenzeConteggiate += 1;
  }

  return {
    voci: righe,
    riepilogo: {
      sessioni: righe.length,
      assenze: assenzeTotali,
      assenzeConteggiate,
      ritardi,
      limiteAssenze: limite,
      oltreLimite: limite !== null && assenzeConteggiate > limite,
    },
  };
};

module.exports = {
  creaRegistro,
  elencoRegistri,
  dettaglioRegistro,
  aggiornaRegistro,
  eliminaRegistro,
  salvaVoci,
  riepilogoAula,
  miePresenze,
};
