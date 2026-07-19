'use strict';

const fsp = require('fs/promises');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const MessaggioChat = require('../models/MessaggioChat');
const ChatLettura = require('../models/ChatLettura');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const Utente = require('../models/Utente');
const FileCaricato = require('../models/FileCaricato');

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { isAdmin, assicuraStessaScuola } = require('../utils/tenant');
const fileService = require('./fileService');
const notificheService = require('./notificheService');

/**
 * ChatService — CHAT DI GRUPPO D'AULA.
 *
 * A differenza della messaggistica interna (docente → studente, casella di
 * posta), qui ogni AULA ha un FEED CONDIVISO: tutti i suoi membri — studenti E
 * insegnanti — leggono lo stesso flusso e vi scrivono, con allegati facoltativi.
 *
 * Regole di accesso (tutte centralizzate in `risolviMembership`):
 *   - per scrivere/leggere una chat bisogna essere MEMBRO dell'aula (qualsiasi
 *     ruolo: studente o insegnante). Il ruolo GLOBALE non basta: uno studente
 *     vede solo le chat delle proprie aule, un insegnante solo quelle in cui
 *     insegna;
 *   - l'admin è trasversale e passa sempre;
 *   - vincolo di tenant: l'aula deve appartenere alla scuola del richiedente.
 *
 * Stato di lettura: un marcatore per membro (`ChatLettura.ultimo_letto_il`),
 * avanzato quando il membro apre la chat o invia un messaggio. I non letti sono
 * i messaggi più recenti della soglia e non scritti dal membro stesso.
 */

const ATTRIBUTI_MITTENTE = ['id', 'nome', 'cognome', 'ruolo'];

// Anteprima testuale massima del messaggio nell'elenco delle aule.
const ANTEPRIMA_MAX = 120;

// ─────────────────────────────────────────────
// Helpers interni
// ─────────────────────────────────────────────

/** Carica l'aula o lancia 404. */
const caricaClasse = async (classeId, opzioni = {}) => {
  const classe = await Classe.findByPk(classeId, opzioni);
  if (!classe) {
    throw new AppError('Aula non trovata.', 404, 'CLASSE_NOT_FOUND');
  }
  return classe;
};

/**
 * Verifica che il richiedente possa accedere alla chat dell'aula e ne
 * restituisce il ruolo NELL'AULA.
 *
 * Admin: passa sempre (ruolo 'admin'). Altrimenti deve esistere una membership
 * (`ClasseUtente`) per (aula, utente) e l'aula deve essere della sua scuola.
 *
 * @returns {Promise<{classe: Classe, ruoloNellaClasse: string}>}
 */
const risolviMembership = async (classeId, richiedente, transaction) => {
  const classe = await caricaClasse(classeId, { transaction });

  if (isAdmin(richiedente)) {
    return { classe, ruoloNellaClasse: 'admin' };
  }

  assicuraStessaScuola(richiedente, classe.scuola_id, 'Questa aula non appartiene alla tua scuola.');

  const membership = await ClasseUtente.findOne({
    where: { classe_id: classeId, utente_id: richiedente.id },
    transaction,
  });
  if (!membership) {
    throw new AppError('Non sei membro di questa aula.', 403, 'FORBIDDEN');
  }

  return { classe, ruoloNellaClasse: membership.ruolo_nella_classe };
};

/** Membri dell'aula (id + ruolo nell'aula), esclusi eventuali id in `escludi`. */
const membriAula = async (classeId, { escludi = [], transaction } = {}) => {
  const escludiSet = new Set(escludi.map(String));
  const righe = await ClasseUtente.findAll({
    where: { classe_id: classeId },
    attributes: ['utente_id', 'ruolo_nella_classe'],
    raw: true,
    transaction,
  });
  return righe.filter((r) => !escludiSet.has(String(r.utente_id)));
};

/**
 * Conta i messaggi NON LETTI di un membro in un'aula: quelli non eliminati, non
 * scritti da lui e successivi alla sua soglia di lettura (tutti, se mai letta).
 */
const contaNonLettiAula = async (classeId, utenteId, ultimoLettoIl, transaction) => {
  const where = {
    classe_id: classeId,
    eliminato: false,
    mittente_id: { [Op.ne]: utenteId },
  };
  if (ultimoLettoIl) where.created_at = { [Op.gt]: ultimoLettoIl };
  return MessaggioChat.count({ where, transaction });
};

/**
 * Avanza (monotòno) il marcatore di lettura del membro sull'aula fino a
 * `quando`. Non lo riporta mai indietro. Upsert idempotente.
 */
const avanzaLettura = async (classeId, utenteId, quando, transaction) => {
  const [riga] = await ChatLettura.findOrCreate({
    where: { classe_id: classeId, utente_id: utenteId },
    defaults: { classe_id: classeId, utente_id: utenteId, ultimo_letto_il: quando },
    transaction,
  });
  if (!riga.ultimo_letto_il || new Date(riga.ultimo_letto_il) < quando) {
    riga.ultimo_letto_il = quando;
    await riga.save({ transaction });
  }
  return riga;
};

/** Vista pubblica di un messaggio con mittente e allegato risolti. */
const messaggioPubblico = (messaggio, classeId) => {
  const base = messaggio.toPublicJSON();

  base.mittente = messaggio.mittente
    ? {
        id: messaggio.mittente.id,
        nome: messaggio.mittente.nome,
        cognome: messaggio.mittente.cognome,
        ruolo: messaggio.mittente.ruolo,
      }
    : null;

  if (!messaggio.eliminato && messaggio.allegato) {
    base.allegato = {
      ...messaggio.allegato.toPublicJSON(),
      // URL protetto: il binario si scarica solo passando dal controller, che
      // verifica l'appartenenza all'aula (cfr. risolviAccessoFile).
      url: `/api/chat/${classeId}/file/${messaggio.allegato.id}`,
    };
  } else if (!messaggio.eliminato) {
    base.allegato = null;
  }

  return base;
};

/** Notifica (digest) ai membri dell'aula, esclusa la persona che ha scritto. */
const notificaNuovoMessaggio = async ({ classe, richiedente }) => {
  const membri = await membriAula(classe.id, { escludi: [richiedente.id] });
  if (!membri.length) return;

  await notificheService.accodaNotificaMulti({
    utenteIds: membri.map((m) => m.utente_id),
    tipo: 'chat_aula',
    titolo: `Nuovi messaggi nella chat di ${classe.nome}`,
    corpo: null,
    link: `/chat/${classe.id}`,
    scuolaId: classe.scuola_id ?? null,
    riferimentoTipo: 'chat_aula',
    riferimentoId: classe.id,
    // UNA sola notifica pendente per aula: il digest riepiloga senza spammare
    // un'email per ogni singolo messaggio.
    unicaPerRiferimento: true,
  });
};

// ─────────────────────────────────────────────
// ELENCO AULE CON CHAT (le mie aule + anteprima + non letti)
// ─────────────────────────────────────────────
const elencoAule = async ({ richiedente }) => {
  // Aule di cui il richiedente è membro (non archiviate). L'admin non è membro
  // di alcuna aula: per lui l'elenco è vuoto (usa gli strumenti di gestione).
  const iscrizioni = await ClasseUtente.findAll({
    where: { utente_id: richiedente.id },
    attributes: ['classe_id', 'ruolo_nella_classe'],
    include: [
      {
        model: Classe,
        as: 'classe',
        where: { archiviata: false },
        attributes: ['id', 'nome', 'colore', 'icona', 'scuola_id'],
      },
    ],
  });

  const aule = await Promise.all(
    iscrizioni
      .filter((i) => i.classe)
      .map(async (i) => {
        const classe = i.classe;

        const lettura = await ChatLettura.findOne({
          where: { classe_id: classe.id, utente_id: richiedente.id },
          attributes: ['ultimo_letto_il'],
        });
        const soglia = lettura ? lettura.ultimo_letto_il : null;

        const [nonLetti, ultimo] = await Promise.all([
          contaNonLettiAula(classe.id, richiedente.id, soglia),
          MessaggioChat.findOne({
            where: { classe_id: classe.id, eliminato: false },
            order: [['created_at', 'DESC']],
            include: [{ model: Utente, as: 'mittente', attributes: ATTRIBUTI_MITTENTE }],
          }),
        ]);

        let ultimoMessaggio = null;
        if (ultimo) {
          const testo = ultimo.corpo
            ? ultimo.corpo.slice(0, ANTEPRIMA_MAX)
            : ultimo.file_id
            ? '[allegato]'
            : '';
          ultimoMessaggio = {
            anteprima: testo,
            haAllegato: Boolean(ultimo.file_id),
            created_at: ultimo.created_at,
            mittente: ultimo.mittente
              ? { id: ultimo.mittente.id, nome: ultimo.mittente.nome, cognome: ultimo.mittente.cognome }
              : null,
          };
        }

        return {
          id: classe.id,
          nome: classe.nome,
          colore: classe.colore,
          icona: classe.icona,
          ruoloNellaClasse: i.ruolo_nella_classe,
          nonLetti,
          ultimoMessaggio,
        };
      })
  );

  // Ordina: prima le aule con messaggi più recenti, poi le altre per nome.
  aule.sort((a, b) => {
    const ta = a.ultimoMessaggio ? new Date(a.ultimoMessaggio.created_at).getTime() : 0;
    const tb = b.ultimoMessaggio ? new Date(b.ultimoMessaggio.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.nome.localeCompare(b.nome);
  });

  return aule;
};

// ─────────────────────────────────────────────
// FEED — elenco messaggi di un'aula (con cursore e segna-letto)
// ─────────────────────────────────────────────
const elencoMessaggi = async ({ classeId, richiedente, filtri = {} }) => {
  const { classe } = await risolviMembership(classeId, richiedente);

  const limit = Number.isInteger(filtri.limit) ? filtri.limit : 50;

  const where = { classe_id: classeId };
  // Cursore per lo scroll all'indietro: solo i messaggi PRECEDENTI a `primaDi`.
  if (filtri.primaDi) {
    const data = new Date(filtri.primaDi);
    if (!Number.isNaN(data.getTime())) where.created_at = { [Op.lt]: data };
  }

  // Prendiamo gli ULTIMI `limit` (DESC), poi li restituiamo in ordine
  // cronologico (ASC) come li mostra la chat.
  const righe = await MessaggioChat.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    include: [
      { model: Utente, as: 'mittente', attributes: ATTRIBUTI_MITTENTE },
      { model: FileCaricato, as: 'allegato' },
    ],
  });

  const messaggi = righe.reverse().map((m) => messaggioPubblico(m, classeId));

  // Apertura del fondo della chat (nessun cursore): segna come letto fino ad ora.
  // L'admin non ha un marcatore da avanzare (non è membro).
  if (!filtri.primaDi && !isAdmin(richiedente)) {
    await avanzaLettura(classeId, richiedente.id, new Date());
  }

  return {
    messaggi,
    aula: { id: classe.id, nome: classe.nome, colore: classe.colore, icona: classe.icona },
    // Cursore per la pagina successiva (messaggi ancora più vecchi).
    haAltri: righe.length === limit,
  };
};

// ─────────────────────────────────────────────
// INVIO MESSAGGIO (solo testo)
// ─────────────────────────────────────────────
const inviaMessaggio = async ({ classeId, corpo, richiedente }) => {
  const { classe } = await risolviMembership(classeId, richiedente);

  const messaggio = await sequelize.transaction(async (t) => {
    const msg = await MessaggioChat.create(
      {
        classe_id: classeId,
        mittente_id: richiedente.id,
        scuola_id: classe.scuola_id ?? richiedente.scuola_id ?? null,
        corpo: corpo.trim(),
        file_id: null,
      },
      { transaction: t }
    );
    // Chi scrive ha letto fino al proprio messaggio.
    if (!isAdmin(richiedente)) {
      await avanzaLettura(classeId, richiedente.id, new Date(), t);
    }
    return msg;
  });

  logger.info(`[CHAT] Messaggio ${messaggio.id} in aula ${classeId} da ${richiedente.id}`);

  // Notifiche (best effort, fuori transazione).
  await notificaNuovoMessaggio({ classe, richiedente });

  return componiRisposta(messaggio.id, classeId);
};

// ─────────────────────────────────────────────
// INVIO MESSAGGIO CON ALLEGATO
// ─────────────────────────────────────────────
const inviaMessaggioConAllegato = async ({ classeId, tipo, corpo, file, richiedente }) => {
  if (!file) {
    throw new AppError('Nessun file caricato.', 400, 'NO_FILE');
  }

  let messaggio;
  try {
    messaggio = await sequelize.transaction(async (t) => {
      const { classe } = await risolviMembership(classeId, richiedente, t);

      // La riga file_caricati è timbrata col tenant del richiedente (fileService).
      const fileCaricato = await fileService.persistiFile({ tipo, file, richiedente, transaction: t });

      const msg = await MessaggioChat.create(
        {
          classe_id: classeId,
          mittente_id: richiedente.id,
          scuola_id: classe.scuola_id ?? richiedente.scuola_id ?? null,
          corpo: corpo && corpo.trim() ? corpo.trim() : null,
          file_id: fileCaricato.id,
        },
        { transaction: t }
      );

      if (!isAdmin(richiedente)) {
        await avanzaLettura(classeId, richiedente.id, new Date(), t);
      }

      return { msg, classe };
    });
  } catch (err) {
    // La transazione è rollbackata: la riga file (se creata) è sparita, ma il
    // binario scritto da multer resta su disco. Rimuovilo (best effort).
    if (file && file.path) {
      try {
        await fsp.unlink(file.path);
      } catch (e) {
        if (e.code !== 'ENOENT') {
          logger.warn(`[CHAT] Impossibile rimuovere l'allegato orfano ${file.path}: ${e.message}`);
        }
      }
    }
    throw err;
  }

  logger.info(
    `[CHAT] Messaggio ${messaggio.msg.id} (allegato ${tipo}) in aula ${classeId} da ${richiedente.id}`
  );

  await notificaNuovoMessaggio({ classe: messaggio.classe, richiedente });

  return componiRisposta(messaggio.msg.id, classeId);
};

/** Ricarica un messaggio con mittente+allegato e ne compone la vista pubblica. */
const componiRisposta = async (messaggioId, classeId) => {
  const completo = await MessaggioChat.findByPk(messaggioId, {
    include: [
      { model: Utente, as: 'mittente', attributes: ATTRIBUTI_MITTENTE },
      { model: FileCaricato, as: 'allegato' },
    ],
  });
  return messaggioPubblico(completo, classeId);
};

// ─────────────────────────────────────────────
// SEGNA LA CHAT COME LETTA
// ─────────────────────────────────────────────
const segnaLetto = async ({ classeId, richiedente }) => {
  await risolviMembership(classeId, richiedente);
  if (isAdmin(richiedente)) return { ultimoLettoIl: null };
  const riga = await avanzaLettura(classeId, richiedente.id, new Date());
  return { ultimoLettoIl: riga.ultimo_letto_il };
};

// ─────────────────────────────────────────────
// CONTEGGIO NON LETTI (tutte le mie aule)
// ─────────────────────────────────────────────
const contaNonLetti = async ({ richiedente }) => {
  if (isAdmin(richiedente)) return { nonLetti: 0, perAula: [] };

  const iscrizioni = await ClasseUtente.findAll({
    where: { utente_id: richiedente.id },
    attributes: ['classe_id'],
    raw: true,
  });
  const classeIds = iscrizioni.map((i) => i.classe_id);
  if (!classeIds.length) return { nonLetti: 0, perAula: [] };

  const letture = await ChatLettura.findAll({
    where: { classe_id: { [Op.in]: classeIds }, utente_id: richiedente.id },
    attributes: ['classe_id', 'ultimo_letto_il'],
    raw: true,
  });
  const soglie = new Map(letture.map((l) => [String(l.classe_id), l.ultimo_letto_il]));

  const perAula = await Promise.all(
    classeIds.map(async (classeId) => {
      const soglia = soglie.get(String(classeId)) || null;
      const n = await contaNonLettiAula(classeId, richiedente.id, soglia);
      return { classeId, nonLetti: n };
    })
  );

  const nonLetti = perAula.reduce((tot, a) => tot + a.nonLetti, 0);
  return { nonLetti, perAula: perAula.filter((a) => a.nonLetti > 0) };
};

// ─────────────────────────────────────────────
// ELIMINA MESSAGGIO (autore | insegnante dell'aula | admin) — soft delete
// ─────────────────────────────────────────────
const eliminaMessaggio = async ({ classeId, messaggioId, richiedente }) => {
  const { ruoloNellaClasse } = await risolviMembership(classeId, richiedente);

  const messaggio = await MessaggioChat.findOne({
    where: { id: messaggioId, classe_id: classeId },
  });
  if (!messaggio) {
    throw new AppError('Messaggio non trovato.', 404, 'MESSAGE_NOT_FOUND');
  }

  const eAutore = String(messaggio.mittente_id) === String(richiedente.id);
  const puoModerare = ruoloNellaClasse === 'admin' || ruoloNellaClasse === 'insegnante';
  if (!eAutore && !puoModerare) {
    throw new AppError('Non puoi eliminare questo messaggio.', 403, 'FORBIDDEN');
  }

  if (messaggio.eliminato) return; // idempotente

  const fileId = messaggio.file_id;

  await sequelize.transaction(async (t) => {
    messaggio.eliminato = true;
    messaggio.eliminato_da = richiedente.id;
    messaggio.eliminato_il = new Date();
    messaggio.file_id = null; // stacca l'allegato prima di rimuoverne la riga
    await messaggio.save({ transaction: t });

    // Un allegato di un messaggio eliminato non deve restare scaricabile:
    // rimuovi riga file + binario su disco.
    if (fileId) {
      await fileService.eliminaFileCaricato(fileId, t);
    }
  });

  logger.info(`[CHAT] Messaggio ${messaggioId} eliminato da ${richiedente.id} (aula ${classeId})`);
};

// ─────────────────────────────────────────────
// ACCESSO ALL'ALLEGATO (per lo streaming protetto del binario)
// ─────────────────────────────────────────────
const risolviAccessoFile = async ({ classeId, fileId, richiedente }) => {
  // Deve essere membro dell'aula (o admin) — stesso controllo del feed.
  await risolviMembership(classeId, richiedente);

  // Il file deve essere l'allegato di un messaggio NON eliminato di QUESTA aula:
  // così non si può indovinare l'id di un file di un'altra aula/scuola.
  const messaggio = await MessaggioChat.findOne({
    where: { classe_id: classeId, file_id: fileId, eliminato: false },
    attributes: ['id'],
  });
  if (!messaggio) {
    throw new AppError('Allegato non trovato.', 404, 'FILE_NOT_FOUND');
  }

  const file = await FileCaricato.findByPk(fileId);
  if (!file) {
    throw new AppError('Allegato non trovato.', 404, 'FILE_NOT_FOUND');
  }

  // disposition lasciata al default sicuro di fileService.inviaFile
  // (inline solo per immagini/video, attachment per i documenti).
  return { file };
};

module.exports = {
  elencoAule,
  elencoMessaggi,
  inviaMessaggio,
  inviaMessaggioConAllegato,
  segnaLetto,
  contaNonLetti,
  eliminaMessaggio,
  risolviAccessoFile,
};
