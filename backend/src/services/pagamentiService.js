'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const sequelize = require('../config/database');
const Scuola = require('../models/Scuola');
const Corso = require('../models/Corso');
const Classe = require('../models/Classe');
const ClasseUtente = require('../models/ClasseUtente');
const Pagamento = require('../models/Pagamento');

const stripeService = require('./stripeService');
const impostazioniService = require('./impostazioniService');
const notificheService = require('./notificheService');
const denaro = require('../utils/denaro');
const piattaforma = require('../config/piattaforma');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * pagamentiService — DOMINIO delle iscrizioni a pagamento.
 *
 * Orchestra il flusso completo:
 *   1. la scuola configura l'incasso (attiva Stripe, onboarding Connect);
 *   2. lo studente sfoglia il CATALOGO con i prezzi personalizzati della scuola;
 *   3. avvia il CHECKOUT: creiamo un ordine `Pagamento` in stato `in_attesa` e
 *      una sessione Stripe (addebito diretto sull'account della scuola, con la
 *      commissione della piattaforma come application fee);
 *   4. a pagamento riuscito, il WEBHOOK segna l'ordine `completato`, ISCRIVE
 *      automaticamente lo studente nell'aula di destinazione decisa dalla scuola
 *      e notifica studente e staff.
 *
 * La verità contabile è su Stripe; qui teniamo lo stato applicativo e l'effetto
 * di dominio (l'iscrizione). Tutte le operazioni sono vincolate al TENANT.
 */

// ─────────────────────────────────────────────
// URL di ritorno (Checkout / onboarding)
// ─────────────────────────────────────────────
const FE = () => (piattaforma.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
const urlSuccesso = () => `${FE()}/pagamenti/esito?stato=successo&session_id={CHECKOUT_SESSION_ID}`;
const urlAnnullato = () => `${FE()}/pagamenti/esito?stato=annullato`;
const urlOnboardingRitorno = () => `${FE()}/scuola/pagamenti?onboarding=completato`;
const urlOnboardingRefresh = () => `${FE()}/scuola/pagamenti?onboarding=riprova`;

// ─────────────────────────────────────────────
// Helper di risoluzione tenant
// ─────────────────────────────────────────────

/**
 * Risolve la scuola su cui operano gli endpoint di configurazione/onboarding:
 *   - staff (insegnante) → la propria scuola;
 *   - admin              → la scuola indicata (`scuolaId`), obbligatoria.
 */
const risolviScuolaId = (richiedente, scuolaIdRichiesta = null) => {
  if (richiedente.ruolo === 'admin') {
    if (!scuolaIdRichiesta) {
      throw new AppError(
        'Come amministratore devi indicare la scuola (scuolaId).',
        422,
        'SCUOLA_REQUIRED'
      );
    }
    return scuolaIdRichiesta;
  }
  if (!richiedente.scuola_id) {
    throw new AppError('Il tuo account non è associato ad alcuna scuola.', 403, 'NO_SCUOLA');
  }
  return richiedente.scuola_id;
};

/** Carica la scuola (istanza Sequelize) o lancia 404. */
const caricaScuola = async (scuolaId, opzioni = {}) => {
  const scuola = await Scuola.findByPk(scuolaId, opzioni);
  if (!scuola) throw new AppError('Scuola non trovata.', 404, 'SCUOLA_NOT_FOUND');
  return scuola;
};

// ═════════════════════════════════════════════
// CONFIGURAZIONE (staff | admin)
// ═════════════════════════════════════════════

/** Ritorna lo stato dei pagamenti della scuola + se la piattaforma è configurata. */
const configScuola = async (richiedente, scuolaIdRichiesta = null) => {
  const scuolaId = risolviScuolaId(richiedente, scuolaIdRichiesta);
  const scuola = await caricaScuola(scuolaId);
  return {
    piattaformaConfigurata: stripeService.disponibile(),
    ...scuola.toPublicJSON().pagamenti,
  };
};

/**
 * Attiva/disattiva la scelta della scuola di usare Stripe. Non tocca l'onboarding
 * né la commissione: è solo l'interruttore operativo. `operativi` resterà false
 * finché anche l'account Connect non è pronto.
 */
const aggiornaConfigScuola = async (richiedente, { attivi }, scuolaIdRichiesta = null) => {
  const scuolaId = risolviScuolaId(richiedente, scuolaIdRichiesta);
  const scuola = await caricaScuola(scuolaId);

  if (attivi === true && !stripeService.disponibile()) {
    throw new AppError(
      'I pagamenti non sono configurati su questa piattaforma.',
      503,
      'PAGAMENTI_NON_CONFIGURATI'
    );
  }

  scuola.pagamenti_stripe_attivi = Boolean(attivi);
  await scuola.save();
  impostazioniService.invalida(scuolaId);
  logger.info(`[PAGAMENTI] Scuola ${scuolaId}: pagamenti_stripe_attivi=${scuola.pagamenti_stripe_attivi}`);
  return scuola.toPublicJSON().pagamenti;
};

/**
 * Avvia (o riprende) l'onboarding Stripe Connect della scuola: crea l'account
 * connesso se non esiste, poi genera l'Account Link a cui inviare la scuola.
 */
const avviaOnboarding = async (richiedente, scuolaIdRichiesta = null) => {
  if (!stripeService.disponibile()) {
    throw new AppError(
      'I pagamenti non sono configurati su questa piattaforma.',
      503,
      'PAGAMENTI_NON_CONFIGURATI'
    );
  }
  const scuolaId = risolviScuolaId(richiedente, scuolaIdRichiesta);
  const scuola = await caricaScuola(scuolaId);

  if (!scuola.stripe_account_id) {
    const accountId = await stripeService.creaAccountConnesso({
      email: richiedente.email,
      nomeScuola: scuola.nome,
    });
    scuola.stripe_account_id = accountId;
    await scuola.save();
    impostazioniService.invalida(scuolaId);
    logger.info(`[PAGAMENTI] Scuola ${scuolaId}: creato account Connect ${accountId}`);
  }

  const url = await stripeService.creaAccountLink({
    accountId: scuola.stripe_account_id,
    refreshUrl: urlOnboardingRefresh(),
    returnUrl: urlOnboardingRitorno(),
  });
  return { url };
};

/**
 * Sincronizza lo stato dell'onboarding con Stripe: aggiorna
 * `stripe_onboarding_completato` in base a `charges_enabled`. Da chiamare al
 * ritorno dall'onboarding.
 */
const statoOnboarding = async (richiedente, scuolaIdRichiesta = null) => {
  const scuolaId = risolviScuolaId(richiedente, scuolaIdRichiesta);
  const scuola = await caricaScuola(scuolaId);

  if (!scuola.stripe_account_id) {
    return { ...scuola.toPublicJSON().pagamenti };
  }

  const account = await stripeService.recuperaAccount(scuola.stripe_account_id);
  const abilitato = Boolean(account && account.charges_enabled);
  if (scuola.stripe_onboarding_completato !== abilitato) {
    scuola.stripe_onboarding_completato = abilitato;
    await scuola.save();
    impostazioniService.invalida(scuolaId);
    logger.info(`[PAGAMENTI] Scuola ${scuolaId}: onboarding_completato=${abilitato}`);
  }
  return { ...scuola.toPublicJSON().pagamenti };
};

// ═════════════════════════════════════════════
// CATALOGO (studente)
// ═════════════════════════════════════════════

/**
 * Elenco dei corsi ACQUISTABILI della scuola dell'utente, con prezzi e
 * descrizioni personalizzati. Vuoto se la scuola non ha i pagamenti operativi.
 * Per ogni corso segnala se l'utente è già iscritto all'aula di destinazione o
 * ha già un pagamento completato.
 */
const catalogo = async (richiedente) => {
  if (!richiedente.scuola_id) return { operativo: false, corsi: [] };
  const scuola = await caricaScuola(richiedente.scuola_id);
  if (!scuola.pagamentiOperativi()) return { operativo: false, corsi: [] };

  const corsi = await Corso.findAll({
    where: {
      scuola_id: scuola.id,
      acquistabile: true,
      stato: 'pubblicato',
      prezzo_centesimi: { [Op.ne]: null },
      aula_destinazione_id: { [Op.ne]: null },
    },
    include: [{ model: Classe, as: 'aulaDestinazione', attributes: ['id', 'nome'] }],
    order: [['titolo', 'ASC']],
  });

  if (!corsi.length) return { operativo: true, corsi: [] };

  // Aule di destinazione a cui l'utente è già iscritto (per marcare "già iscritto").
  const aulaIds = corsi.map((c) => c.aula_destinazione_id).filter(Boolean);
  const iscrizioni = aulaIds.length
    ? await ClasseUtente.findAll({
        where: { utente_id: richiedente.id, classe_id: { [Op.in]: aulaIds } },
        attributes: ['classe_id'],
      })
    : [];
  const auleIscritto = new Set(iscrizioni.map((i) => String(i.classe_id)));

  // Corsi già acquistati (pagamento completato) dall'utente.
  const corsoIds = corsi.map((c) => c.id);
  const acquisti = await Pagamento.findAll({
    where: {
      utente_id: richiedente.id,
      corso_id: { [Op.in]: corsoIds },
      stato: 'completato',
    },
    attributes: ['corso_id'],
  });
  const corsiAcquistati = new Set(acquisti.map((p) => String(p.corso_id)));

  const lista = corsi.map((c) => {
    const j = c.toPublicJSON();
    return {
      id: j.id,
      titolo: j.titolo,
      descrizione: j.descrizione,
      descrizioneVendita: j.descrizioneVendita,
      copertinaUrl: j.copertinaUrl,
      copertinaFileId: j.copertinaFileId,
      materia: j.materia,
      livello: j.livello,
      prezzoCentesimi: j.prezzoCentesimi,
      prezzo: j.prezzo,
      valuta: j.valuta,
      prezzoFormattato: denaro.formatta(j.prezzoCentesimi, j.valuta),
      aulaDestinazione: c.aulaDestinazione
        ? { id: c.aulaDestinazione.id, nome: c.aulaDestinazione.nome }
        : null,
      giaIscritto: auleIscritto.has(String(c.aula_destinazione_id)),
      giaAcquistato: corsiAcquistati.has(String(c.id)),
    };
  });

  return { operativo: true, corsi: lista };
};

// ═════════════════════════════════════════════
// CHECKOUT (studente)
// ═════════════════════════════════════════════

/**
 * Avvia il checkout per un corso: valida le condizioni, crea l'ordine e la
 * sessione Stripe, restituisce l'URL a cui reindirizzare l'utente.
 */
const creaCheckout = async ({ richiedente, corsoId }) => {
  if (!richiedente.scuola_id) {
    throw new AppError('Il tuo account non è associato ad alcuna scuola.', 403, 'NO_SCUOLA');
  }

  const scuola = await caricaScuola(richiedente.scuola_id);
  if (!scuola.pagamentiOperativi()) {
    throw new AppError(
      'La tua scuola non ha attivato i pagamenti online.',
      409,
      'PAGAMENTI_NON_ATTIVI'
    );
  }

  const corso = await Corso.findByPk(corsoId, {
    include: [{ model: Classe, as: 'aulaDestinazione', attributes: ['id', 'nome', 'scuola_id'] }],
  });
  if (!corso || String(corso.scuola_id) !== String(scuola.id)) {
    throw new AppError('Corso non trovato.', 404, 'CORSO_NOT_FOUND');
  }
  if (!corso.acquistabile || corso.prezzo_centesimi == null) {
    throw new AppError('Questo corso non è acquistabile.', 409, 'CORSO_NON_ACQUISTABILE');
  }
  if (corso.stato !== 'pubblicato') {
    throw new AppError('Questo corso non è disponibile.', 409, 'CORSO_NON_DISPONIBILE');
  }
  if (!corso.aula_destinazione_id || !corso.aulaDestinazione) {
    throw new AppError(
      "Il corso non ha un'aula di destinazione configurata: contatta la scuola.",
      409,
      'AULA_DESTINAZIONE_MANCANTE'
    );
  }
  // Difesa in profondità: l'aula deve appartenere alla stessa scuola.
  if (String(corso.aulaDestinazione.scuola_id) !== String(scuola.id)) {
    throw new AppError("L'aula di destinazione non appartiene alla scuola.", 409, 'AULA_CROSS_SCUOLA');
  }

  // Già iscritto all'aula di destinazione? Niente pagamento.
  const giaMembro = await ClasseUtente.findOne({
    where: { classe_id: corso.aula_destinazione_id, utente_id: richiedente.id },
    attributes: ['id'],
  });
  if (giaMembro) {
    throw new AppError('Sei già iscritto a questo corso.', 409, 'GIA_ISCRITTO');
  }

  // Già acquistato (pagamento completato)? Niente doppio addebito.
  const giaAcquistato = await Pagamento.findOne({
    where: { utente_id: richiedente.id, corso_id: corso.id, stato: 'completato' },
    attributes: ['id'],
  });
  if (giaAcquistato) {
    throw new AppError('Hai già acquistato questo corso.', 409, 'GIA_ACQUISTATO');
  }

  const importo = Number(corso.prezzo_centesimi);
  const valuta = (corso.valuta || 'EUR').toUpperCase();
  const perc = scuola.commissione_piattaforma_percentuale;
  const commissione = denaro.commissionePiattaforma(importo, perc);

  // Id dell'ordine generato prima, così è riferibile nella sessione Stripe.
  const pagamentoId = uuidv4();
  const metadata = {
    pagamentoId,
    corsoId: String(corso.id),
    scuolaId: String(scuola.id),
    utenteId: String(richiedente.id),
    aulaDestinazioneId: String(corso.aula_destinazione_id),
  };

  const sessione = await stripeService.creaSessioneCheckout({
    accountId: scuola.stripe_account_id,
    importoCentesimi: importo,
    valuta,
    applicationFeeCentesimi: commissione,
    nomeProdotto: corso.titolo,
    descrizione: corso.descrizione_vendita || corso.descrizione,
    successUrl: urlSuccesso(),
    cancelUrl: urlAnnullato(),
    clientReferenceId: pagamentoId,
    emailCliente: richiedente.email,
    metadata,
  });

  await Pagamento.create({
    id: pagamentoId,
    scuola_id: scuola.id,
    corso_id: corso.id,
    utente_id: richiedente.id,
    aula_destinazione_id: corso.aula_destinazione_id,
    stripe_checkout_session_id: sessione.id,
    stato: 'in_attesa',
    importo_centesimi: importo,
    valuta,
    commissione_piattaforma_percentuale: perc == null ? null : Number(perc),
    commissione_piattaforma_centesimi: commissione,
    email_acquirente: richiedente.email || null,
    iscrizione_effettuata: false,
  });

  logger.info(
    `[PAGAMENTI] Checkout avviato: pagamento ${pagamentoId} (corso ${corso.id}, utente ${richiedente.id}, importo ${importo}${valuta}, fee ${commissione})`
  );

  return { url: sessione.url, pagamentoId };
};

// ═════════════════════════════════════════════
// WEBHOOK
// ═════════════════════════════════════════════

/**
 * Iscrive l'acquirente nell'aula di destinazione e segna l'ordine completato.
 * Idempotente: eseguibile più volte senza effetti duplicati (findOrCreate +
 * flag `iscrizione_effettuata`). Restituisce true se l'iscrizione è avvenuta ora.
 */
const completaPagamento = async (pagamento, paymentIntentId) => {
  let iscrittoOra = false;
  await sequelize.transaction(async (t) => {
    // Rilettura con lock per evitare race tra recapiti multipli del webhook.
    const p = await Pagamento.findByPk(pagamento.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!p) return;

    if (paymentIntentId && !p.stripe_payment_intent_id) {
      p.stripe_payment_intent_id = paymentIntentId;
    }

    if (p.stato !== 'completato') p.stato = 'completato';

    if (!p.iscrizione_effettuata && p.aula_destinazione_id) {
      // Verifica che l'aula esista ancora (potrebbe essere stata eliminata).
      const aula = await Classe.findByPk(p.aula_destinazione_id, { transaction: t });
      if (aula) {
        await ClasseUtente.findOrCreate({
          where: { classe_id: p.aula_destinazione_id, utente_id: p.utente_id },
          defaults: {
            classe_id: p.aula_destinazione_id,
            utente_id: p.utente_id,
            ruolo_nella_classe: 'studente',
            aggiunto_da: null, // iscrizione automatica di sistema
          },
          transaction: t,
        });
        p.iscrizione_effettuata = true;
        iscrittoOra = true;
      } else {
        logger.warn(
          `[PAGAMENTI] Aula ${p.aula_destinazione_id} inesistente per pagamento ${p.id}: iscrizione da gestire manualmente.`
        );
      }
    }

    await p.save({ transaction: t });
  });
  return iscrittoOra;
};

/** Notifiche best-effort dopo un pagamento completato (acquirente + staff). */
const notificaCompletamento = async (pagamento) => {
  try {
    const corso = pagamento.corso_id ? await Corso.findByPk(pagamento.corso_id) : null;
    const titoloCorso = corso ? corso.titolo : 'un corso';
    const link = pagamento.aula_destinazione_id
      ? `${FE()}/aule/${pagamento.aula_destinazione_id}`
      : `${FE()}/corsi`;

    // 1. Acquirente: conferma iscrizione.
    await notificheService.accodaNotifica({
      utenteId: pagamento.utente_id,
      tipo: 'iscrizione_pagamento',
      titolo: `Iscrizione confermata: ${titoloCorso}`,
      corpo: `Il pagamento è andato a buon fine e sei stato iscritto al corso "${titoloCorso}".`,
      link,
      scuolaId: pagamento.scuola_id,
      riferimentoTipo: 'pagamento',
      riferimentoId: pagamento.id,
      unicaPerRiferimento: true,
    });

    // 2. Staff: insegnanti dell'aula di destinazione (fallback: autore del corso).
    let destinatariStaff = [];
    if (pagamento.aula_destinazione_id) {
      const insegnanti = await ClasseUtente.findAll({
        where: { classe_id: pagamento.aula_destinazione_id, ruolo_nella_classe: 'insegnante' },
        attributes: ['utente_id'],
      });
      destinatariStaff = insegnanti.map((i) => i.utente_id);
    }
    if (!destinatariStaff.length && corso && corso.creato_da) {
      destinatariStaff = [corso.creato_da];
    }

    if (destinatariStaff.length) {
      await notificheService.accodaNotificaMulti({
        utenteIds: destinatariStaff,
        tipo: 'nuovo_pagamento',
        titolo: `Nuova iscrizione a pagamento: ${titoloCorso}`,
        corpo: `Uno studente ha completato l'iscrizione a pagamento al corso "${titoloCorso}".`,
        link: pagamento.aula_destinazione_id ? link : `${FE()}/scuola/pagamenti`,
        scuolaId: pagamento.scuola_id,
        riferimentoTipo: 'pagamento',
        riferimentoId: pagamento.id,
        unicaPerRiferimento: true,
      });
    }
  } catch (err) {
    logger.error(`[PAGAMENTI] Notifica completamento fallita per ${pagamento.id}: ${err.message}`);
  }
};

/**
 * Gestisce un evento webhook Stripe già verificato. Trova l'ordine dalla
 * sessione di checkout e ne aggiorna lo stato/effetti. Non lancia per gli eventi
 * ignorati: risponde sempre 200 così Stripe non ritenta all'infinito.
 */
const gestisciEvento = async (evento) => {
  const tipo = evento.type;

  // Estrae la sessione di checkout dall'oggetto evento (quando pertinente).
  const oggetto = evento.data && evento.data.object ? evento.data.object : {};

  const trovaPagamento = async (sessionId) => {
    if (!sessionId) return null;
    return Pagamento.findOne({ where: { stripe_checkout_session_id: sessionId } });
  };

  switch (tipo) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const pagamento = await trovaPagamento(oggetto.id);
      if (!pagamento) {
        logger.warn(`[PAGAMENTI] Webhook ${tipo}: nessun ordine per sessione ${oggetto.id}`);
        return;
      }
      // Solo se il pagamento risulta effettivamente incassato.
      if (oggetto.payment_status && oggetto.payment_status !== 'paid') {
        logger.info(`[PAGAMENTI] Sessione ${oggetto.id} non ancora pagata (${oggetto.payment_status}).`);
        return;
      }
      const eraCompletato = pagamento.stato === 'completato' && pagamento.iscrizione_effettuata;
      await completaPagamento(pagamento, oggetto.payment_intent || null);
      if (!eraCompletato) {
        await notificaCompletamento(await Pagamento.findByPk(pagamento.id));
      }
      return;
    }

    case 'checkout.session.expired': {
      const pagamento = await trovaPagamento(oggetto.id);
      if (pagamento && pagamento.stato === 'in_attesa') {
        pagamento.stato = 'annullato';
        await pagamento.save();
        logger.info(`[PAGAMENTI] Ordine ${pagamento.id} annullato (sessione scaduta).`);
      }
      return;
    }

    case 'checkout.session.async_payment_failed': {
      const pagamento = await trovaPagamento(oggetto.id);
      if (pagamento && pagamento.stato === 'in_attesa') {
        pagamento.stato = 'fallito';
        await pagamento.save();
        logger.info(`[PAGAMENTI] Ordine ${pagamento.id} fallito.`);
      }
      return;
    }

    default:
      // Evento non gestito: si ignora silenziosamente (200).
      logger.debug && logger.debug(`[PAGAMENTI] Evento webhook ignorato: ${tipo}`);
  }
};

// ═════════════════════════════════════════════
// ELENCHI
// ═════════════════════════════════════════════

/** Ordini dell'utente ("i miei acquisti"). */
const elencoMiei = async (richiedente) => {
  const pagamenti = await Pagamento.findAll({
    where: { utente_id: richiedente.id },
    include: [{ model: Corso, as: 'corso', attributes: ['id', 'titolo'] }],
    order: [['created_at', 'DESC']],
    limit: 200,
  });
  return pagamenti.map((p) => ({
    ...p.toPublicJSON(),
    corso: p.corso ? { id: p.corso.id, titolo: p.corso.titolo } : null,
    importoFormattato: denaro.formatta(p.importo_centesimi, p.valuta),
  }));
};

/** Incassi ricevuti dalla scuola (staff | admin). */
const elencoScuola = async (richiedente, { stato, scuolaId: scuolaIdRichiesta } = {}) => {
  const scuolaId = risolviScuolaId(richiedente, scuolaIdRichiesta);
  const where = { scuola_id: scuolaId };
  if (stato) where.stato = stato;

  const pagamenti = await Pagamento.findAll({
    where,
    include: [{ model: Corso, as: 'corso', attributes: ['id', 'titolo'] }],
    order: [['created_at', 'DESC']],
    limit: 500,
  });
  return pagamenti.map((p) => ({
    ...p.toPublicJSON(),
    corso: p.corso ? { id: p.corso.id, titolo: p.corso.titolo } : null,
    importoFormattato: denaro.formatta(p.importo_centesimi, p.valuta),
  }));
};

module.exports = {
  // configurazione
  configScuola,
  aggiornaConfigScuola,
  avviaOnboarding,
  statoOnboarding,
  // catalogo & checkout
  catalogo,
  creaCheckout,
  // webhook
  gestisciEvento,
  // elenchi
  elencoMiei,
  elencoScuola,
};
