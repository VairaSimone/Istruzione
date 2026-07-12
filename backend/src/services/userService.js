'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('../models/Utente');
const AppError = require('../utils/AppError');
const { hashToken } = require('../utils/tokenHash');
const { escapeLike } = require('../utils/escapeLike');
const { assicuraStessaScuola } = require('../utils/tenant');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const notificheService = require('./notificheService');
const {
  ACCOUNT_CANCELLAZIONE_GIORNI,
  NOTIFICHE_INVIATE_GIORNI,
  dataSoglia,
} = require('../constants/retention');

// Modelli usati per l'esportazione dei dati personali e per la purga di
// retention. Richiesti qui (non in cima al file per macro-sezioni) per tenere
// vicino l'uso al punto di import.
const CompitoConsegna = require('../models/CompitoConsegna');
const ProgressoDomanda = require('../models/ProgressoDomanda');
const ProgressoKana = require('../models/ProgressoKana');
const ProgressoKanji = require('../models/ProgressoKanji');
const BadgeUtente = require('../models/BadgeUtente');
const AttivitaGiornaliera = require('../models/AttivitaGiornaliera');
const ClasseUtente = require('../models/ClasseUtente');
const Messaggio = require('../models/Messaggio');
const MessaggioDestinatario = require('../models/MessaggioDestinatario');
const NotificaEmail = require('../models/NotificaEmail');
const Certificato = require('../models/Certificato');
const EventoDestinatario = require('../models/EventoDestinatario');

/**
 * UserService — responsabilità ESCLUSIVA: gestione utenti e account.
 *
 *   cambio email · eliminazione account (self) · lingua ·
 *   lista utenti · aggiornamento ruolo · eliminazione utenti (admin)
 *
 * L'autenticazione vive in `authService.js`.
 */

// ─────────────────────────────────────────────
// RICHIESTA CAMBIO EMAIL
// ─────────────────────────────────────────────
const richiediCambioEmail = async (userId, nuovaEmail) => {
  const emailFormattata = nuovaEmail.toLowerCase().trim();

  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  const giaEsistente = await Utente.findOne({ where: { email: emailFormattata } });
  if (giaEsistente) {
    throw new AppError('Questa email è già associata a un altro account.', 409, 'EMAIL_TAKEN');
  }

  const tokenVerifica = crypto.randomBytes(32).toString('hex');
  const scadenzaVerifica = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 ore

  await utente.update({
    email_verification_token: hashToken(tokenVerifica),
    email_verification_expire: scadenzaVerifica,
    nuova_email_pendente: emailFormattata,
  });

  try {
    await emailService.sendEmailChangeEmail(emailFormattata, tokenVerifica, utente.lingua);
  } catch (err) {
    logger.error(`Errore invio email cambio indirizzo a ${emailFormattata}: ${err.message}`);
  }

  return tokenVerifica;
};

// ─────────────────────────────────────────────
// CONFERMA CAMBIO EMAIL
// ─────────────────────────────────────────────
const confermaCambioEmail = async (token) => {
  const utente = await Utente.findOne({
    where: {
      email_verification_token: hashToken(token),
      nuova_email_pendente: { [Op.ne]: null },
    },
  });

  if (!utente) {
    throw new AppError('Token di verifica non valido o non associato a un cambio email.', 400, 'INVALID_TOKEN');
  }

  if (utente.email_verification_expire && new Date(utente.email_verification_expire) < new Date()) {
    throw new AppError('Il token di verifica è scaduto. Richiedi un nuovo cambio email.', 400, 'EXPIRED_TOKEN');
  }

  const nuovaEmail = utente.nuova_email_pendente;

  // Verifica che l'email non sia stata occupata da un altro account nel
  // frattempo (consistenza dei dati / unique constraint).
  const giaPreso = await Utente.findOne({ where: { email: nuovaEmail } });
  if (giaPreso && giaPreso.id !== utente.id) {
    throw new AppError('Questa email è già associata a un altro account.', 409, 'EMAIL_TAKEN');
  }

  await utente.update({
    email: nuovaEmail,
    nuova_email_pendente: null,
    email_verification_token: null,
    email_verification_expire: null,
  });

  logger.info(`Email aggiornata con successo per utente ID: ${utente.id}`);
  return utente;
};

// ─────────────────────────────────────────────
// AGGIORNA LINGUA
// ─────────────────────────────────────────────
const aggiornaLingua = async (userId, lingua) => {
  if (!['it', 'en'].includes(lingua)) {
    throw new AppError('Lingua non supportata.', 400, 'INVALID_LANGUAGE');
  }

  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  utente.lingua = lingua;
  await utente.save();

  return utente;
};

// ─────────────────────────────────────────────
// Preferenze di notifica email (digest)
// Delegate al notificheService, che le normalizza contro il registro dei tipi.
// ─────────────────────────────────────────────
const leggiPreferenzeNotifiche = async (userId) => {
  const preferenze = await notificheService.leggiPreferenze(userId);
  if (!preferenze) throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  return preferenze;
};

const aggiornaPreferenzeNotifiche = async (userId, blob) => {
  const preferenze = await notificheService.aggiornaPreferenze(userId, blob);
  if (!preferenze) throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  return preferenze;
};

// ─────────────────────────────────────────────
// ELIMINA ACCOUNT (self)
// ─────────────────────────────────────────────
const eliminaAccount = async (userId) => {
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  await utente.destroy();
  logger.info(`Account eliminato definitivamente. ID Utente: ${userId}`);
};

// ─────────────────────────────────────────────
// ESPORTAZIONE DATI PERSONALI (art. 20 GDPR — portabilità)
// Aggrega, in un unico oggetto JSON, tutti i dati riferiti all'utente:
// profilo, iscrizioni, consegne, progressi, badge, attività, messaggi,
// notifiche, certificati ed eventi. Il profilo passa da toPublicJSON, quindi
// NON include mai password né token; le altre tabelle non contengono segreti.
// ─────────────────────────────────────────────
const esportaDatiUtente = async (userId) => {
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  const [
    iscrizioniAule,
    consegne,
    progressiQuiz,
    progressiKana,
    progressiKanji,
    badge,
    attivita,
    messaggiInviati,
    messaggiRicevuti,
    notifiche,
    certificati,
    eventiDestinatario,
  ] = await Promise.all([
    ClasseUtente.findAll({ where: { utente_id: userId }, raw: true }),
    CompitoConsegna.findAll({ where: { utente_id: userId }, raw: true }),
    ProgressoDomanda.findAll({ where: { utente_id: userId }, raw: true }),
    ProgressoKana.findAll({ where: { utente_id: userId }, raw: true }),
    ProgressoKanji.findAll({ where: { utente_id: userId }, raw: true }),
    BadgeUtente.findAll({ where: { utente_id: userId }, raw: true }),
    AttivitaGiornaliera.findAll({ where: { utente_id: userId }, raw: true }),
    Messaggio.findAll({ where: { mittente_id: userId }, raw: true }),
    MessaggioDestinatario.findAll({ where: { utente_id: userId }, raw: true }),
    NotificaEmail.findAll({ where: { utente_id: userId }, raw: true }),
    Certificato.findAll({ where: { utente_id: userId }, raw: true }),
    EventoDestinatario.findAll({ where: { utente_id: userId }, raw: true }),
  ]);

  return {
    _meta: {
      generato_il: new Date().toISOString(),
      formato: 'json',
      versione_schema: 1,
      descrizione:
        'Esportazione dei dati personali associati al tuo account (art. 20 GDPR).',
    },
    profilo: utente.toPublicJSON(),
    iscrizioni_aule: iscrizioniAule,
    consegne_compiti: consegne,
    progressi_quiz: progressiQuiz,
    progressi_kana: progressiKana,
    progressi_kanji: progressiKanji,
    badge,
    attivita_giornaliera: attivita,
    messaggi_inviati: messaggiInviati,
    messaggi_ricevuti: messaggiRicevuti,
    notifiche_email: notifiche,
    certificati,
    eventi_destinatario: eventiDestinatario,
  };
};

// ─────────────────────────────────────────────
// RICHIESTA DI CANCELLAZIONE ACCOUNT (art. 17 GDPR, con periodo di grazia)
// Non elimina subito: marca l'account con l'istante della richiesta. Lo
// scheduler lo eliminerà DEFINITIVAMENTE al termine del periodo di grazia (cfr.
// constants/retention). Entro quel termine l'utente può annullare la richiesta.
// Idempotente: una seconda richiesta non modifica l'istante originale.
// ─────────────────────────────────────────────
const richiediCancellazioneAccount = async (userId) => {
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  if (!utente.cancellazione_richiesta_at) {
    utente.cancellazione_richiesta_at = new Date();
    await utente.save();
    logger.info(`[GDPR] Richiesta di cancellazione registrata per utente ${userId}`);
  }

  return utente;
};

// ─────────────────────────────────────────────
// ANNULLAMENTO DELLA RICHIESTA DI CANCELLAZIONE
// Rimuove il marcatore: l'account non verrà più purgato.
// ─────────────────────────────────────────────
const annullaCancellazioneAccount = async (userId) => {
  const utente = await Utente.findByPk(userId);
  if (!utente) {
    throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
  }

  if (utente.cancellazione_richiesta_at) {
    utente.cancellazione_richiesta_at = null;
    await utente.save();
    logger.info(`[GDPR] Richiesta di cancellazione annullata per utente ${userId}`);
  }

  return utente;
};

// ─────────────────────────────────────────────
// PURGA ACCOUNT OLTRE IL PERIODO DI GRAZIA (retention)
// Elimina DEFINITIVAMENTE gli account la cui richiesta di cancellazione è più
// vecchia del periodo di grazia. Le relazioni con onDelete: CASCADE seguono.
// Salvaguardia: NON elimina l'ultimo admin, per non bloccare la piattaforma;
// la richiesta resta pendente e va gestita manualmente.
// ─────────────────────────────────────────────
const purgaAccountCancellati = async () => {
  const soglia = dataSoglia(ACCOUNT_CANCELLAZIONE_GIORNI);

  const candidati = await Utente.findAll({
    where: {
      cancellazione_richiesta_at: { [Op.ne]: null, [Op.lte]: soglia },
    },
  });
  if (!candidati.length) return { eliminati: 0, saltati: 0 };

  let eliminati = 0;
  let saltati = 0;

  for (const utente of candidati) {
    if (utente.ruolo === 'admin') {
      const numAdmin = await Utente.count({ where: { ruolo: 'admin' } });
      if (numAdmin <= 1) {
        saltati += 1;
        logger.warn(
          `[RETENTION] Purga saltata: l'utente ${utente.id} è l'ultimo amministratore.`
        );
        continue;
      }
    }

    await utente.destroy(); // CASCADE sulle relazioni collegate
    eliminati += 1;
  }

  if (eliminati || saltati) {
    logger.info(
      `[RETENTION] Account purgati: ${eliminati} eliminati, ${saltati} saltati.`
    );
  }
  return { eliminati, saltati };
};

// ─────────────────────────────────────────────
// PURGA NOTIFICHE EMAIL GIÀ INVIATE (retention)
// Le notifiche in stato 'inviata' più vecchie del periodo di conservazione sono
// solo storico di recapito: vengono rimosse.
// ─────────────────────────────────────────────
const purgaNotificheInviate = async () => {
  const soglia = dataSoglia(NOTIFICHE_INVIATE_GIORNI);

  const eliminate = await NotificaEmail.destroy({
    where: {
      stato: 'inviata',
      inviata_il: { [Op.ne]: null, [Op.lt]: soglia },
    },
  });

  if (eliminate) {
    logger.info(`[RETENTION] Notifiche email purgate: ${eliminate}.`);
  }
  return { eliminate };
};

// ─────────────────────────────────────────────
// GIRO COMPLETO DI RETENTION (invocato dallo scheduler)
// ─────────────────────────────────────────────
const eseguiRetention = async () => {
  const account = await purgaAccountCancellati();
  const notifiche = await purgaNotificheInviate();
  return { account, notifiche };
};

// ─────────────────────────────────────────────
// VISTA GESTIONALE UTENTI (Per Insegnanti)
// SCOPE TENANT: un insegnante vede SOLO gli utenti della propria scuola;
// l'admin vede tutti (con filtro facoltativo per scuola).
// ─────────────────────────────────────────────
const getUtentiPerInsegnante = async (richiedente, filtri) => {
  const { ruolo, classe, nome, scuola, page, limit } = filtri;
  const where = {};

  // Confine di tenant.
  if (richiedente.ruolo !== 'admin') {
    // Un insegnante senza scuola non deve vedere alcun utente (fail-closed).
    if (!richiedente.scuola_id) {
      return { utenti: [], paginazione: null };
    }
    where.scuola_id = richiedente.scuola_id;
  } else if (scuola) {
    where.scuola_id = scuola;
  }

  if (ruolo) {
    where.ruolo = ruolo;
  }

  if (classe) {
    where.classe = classe;
  }

  if (nome) {
    // Escape dei wildcard LIKE (% _ \) sull'input utente per prevenire
    // LIKE injection e query a costo esponenziale.
    const termine = `%${escapeLike(nome)}%`;
    where[Op.or] = [
      { nome: { [Op.like]: termine } },
      { cognome: { [Op.like]: termine } },
    ];
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const usaPaginazione = Number.isInteger(pageNum) && Number.isInteger(limitNum) && pageNum > 0 && limitNum > 0;

  const queryOptions = {
    where,
    attributes: {
      exclude: [
        'password',
        'refresh_token',
        'reset_password_token',
        'reset_password_expire',
        'email_verification_token',
        'email_verification_expire',
      ],
    },
    order: [['cognome', 'ASC'], ['nome', 'ASC']],
  };

  if (usaPaginazione) {
    queryOptions.limit = limitNum;
    queryOptions.offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Utente.findAndCountAll(queryOptions);
    return {
      utenti: rows,
      paginazione: {
        paginaCorrente: pageNum,
        elementiPerPagina: limitNum,
        totaleElementi: count,
        totalePagine: Math.ceil(count / limitNum),
      },
    };
  }

  const utenti = await Utente.findAll(queryOptions);
  return { utenti, paginazione: null };
};

// ─────────────────────────────────────────────
// CAMBIO RUOLO UTENTE (Per Insegnanti)
// Eseguito in TRANSAZIONE con lock di riga: impedisce la race condition in
// cui due declassamenti concorrenti lascino il sistema senza insegnanti.
// Incrementa inoltre token_version del bersaglio (revoca sessioni) così che
// il nuovo ruolo abbia effetto immediato.
// ─────────────────────────────────────────────
const aggiornaRuoloUtente = async (richiedente, userId, nuovoRuolo) => {
  const actingUserId = richiedente.id;
  const actingRole = richiedente.ruolo;

  if (!Utente.RUOLI_VALIDI.includes(nuovoRuolo)) {
    throw new AppError('Ruolo non valido.', 422, 'INVALID_ROLE');
  }

  if (String(actingUserId) === String(userId)) {
    throw new AppError('Non puoi modificare il tuo stesso ruolo.', 403, 'SELF_ROLE_CHANGE_FORBIDDEN');
  }

  // Solo un admin può assegnare (o revocare) il ruolo admin: impedisce a un
  // insegnante di promuovere se stesso o altri ad amministratore.
  if (nuovoRuolo === 'admin' && actingRole !== 'admin') {
    throw new AppError('Solo un amministratore può assegnare il ruolo admin.', 403, 'ADMIN_ROLE_FORBIDDEN');
  }

  return sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    // Confine di tenant: un insegnante può modificare solo utenti della propria
    // scuola (l'admin è trasversale).
    assicuraStessaScuola(richiedente, utente.scuola_id, "L'utente non appartiene alla tua scuola.");

    // Solo un admin può declassare un altro admin.
    if (utente.ruolo === 'admin' && actingRole !== 'admin') {
      throw new AppError('Solo un amministratore può modificare un account admin.', 403, 'ADMIN_ROLE_FORBIDDEN');
    }

    // Salvaguardia atomica: non declassare l'ultimo admin rimasto.
    if (utente.ruolo === 'admin' && nuovoRuolo !== 'admin') {
      const admin = await Utente.findAll({
        where: { ruolo: 'admin' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (admin.length <= 1) {
        throw new AppError('Impossibile declassare l\'ultimo amministratore.', 409, 'LAST_ADMIN');
      }
    }

    // Salvaguardia atomica: non declassare l'ultimo insegnante rimasto.
    if (utente.ruolo === 'insegnante' && nuovoRuolo !== 'insegnante') {
      // Blocca TUTTE le righe insegnante per la durata della transazione:
      // un'altra transazione concorrente che voglia declassare/eliminare un
      // insegnante resta in attesa, evitando il "double demote".
      const insegnanti = await Utente.findAll({
        where: { ruolo: 'insegnante' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (insegnanti.length <= 1) {
        throw new AppError('Impossibile declassare l\'ultimo insegnante.', 409, 'LAST_TEACHER');
      }
    }

    await utente.update(
      {
        ruolo: nuovoRuolo,
        // Revoca delle sessioni attive del bersaglio: il cambio ruolo ha
        // effetto immediato e i refresh token preesistenti vengono invalidati.
        token_version: utente.token_version + 1,
        refresh_token: null,
      },
      { transaction: t }
    );

    logger.info(`[AUDIT] Ruolo modificato dall'insegnante ${actingUserId}: utente ${userId} -> ${nuovoRuolo}`);

    return utente.toPublicJSON();
  });
};

// ─────────────────────────────────────────────
// ELIMINA ACCOUNT (azione amministrativa insegnante)
// Eseguito in TRANSAZIONE con lock di riga per garantire l'atomicità del
// controllo "ultimo insegnante".
// ─────────────────────────────────────────────
const eliminaUtenteComeInsegnante = async (richiedente, targetUserId) => {
  const actingUserId = richiedente.id;
  const actingRole = richiedente.ruolo;

  if (String(actingUserId) === String(targetUserId)) {
    throw new AppError(
      'Non puoi eliminare il tuo account da questa sezione. Usa le impostazioni del profilo.',
      403,
      'SELF_DELETE_FORBIDDEN'
    );
  }

  return sequelize.transaction(async (t) => {
    const utente = await Utente.findByPk(targetUserId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!utente) {
      throw new AppError('Utente non trovato.', 404, 'USER_NOT_FOUND');
    }

    // Confine di tenant: un insegnante può eliminare solo utenti della propria
    // scuola (l'admin è trasversale).
    assicuraStessaScuola(richiedente, utente.scuola_id, "L'utente non appartiene alla tua scuola.");

    // Solo un admin può eliminare un altro admin.
    if (utente.ruolo === 'admin' && actingRole !== 'admin') {
      throw new AppError('Solo un amministratore può eliminare un account admin.', 403, 'ADMIN_ROLE_FORBIDDEN');
    }

    // Salvaguardia atomica: non eliminare l'ultimo admin rimasto.
    if (utente.ruolo === 'admin') {
      const admin = await Utente.findAll({
        where: { ruolo: 'admin' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (admin.length <= 1) {
        throw new AppError('Impossibile eliminare l\'ultimo amministratore.', 409, 'LAST_ADMIN');
      }
    }

    if (utente.ruolo === 'insegnante') {
      const insegnanti = await Utente.findAll({
        where: { ruolo: 'insegnante' },
        attributes: ['id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (insegnanti.length <= 1) {
        throw new AppError('Impossibile eliminare l\'ultimo insegnante.', 409, 'LAST_TEACHER');
      }
    }

    await utente.destroy({ transaction: t });
    logger.info(`[AUDIT] Account ${targetUserId} eliminato dall'utente ${actingUserId}`);
  });
};

module.exports = {
  richiediCambioEmail,
  confermaCambioEmail,
  aggiornaLingua,
  leggiPreferenzeNotifiche,
  aggiornaPreferenzeNotifiche,
  eliminaAccount,
  esportaDatiUtente,
  richiediCancellazioneAccount,
  annullaCancellazioneAccount,
  purgaAccountCancellati,
  purgaNotificheInviate,
  eseguiRetention,
  getUtentiPerInsegnante,
  aggiornaRuoloUtente,
  eliminaUtenteComeInsegnante,
};
