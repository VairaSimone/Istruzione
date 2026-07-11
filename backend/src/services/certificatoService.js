'use strict';

const crypto = require('crypto');
const fsp = require('fs/promises');
const { Op } = require('sequelize');

const sequelize = require('../config/database');
const Certificato = require('../models/Certificato');
const Utente = require('../models/Utente');
const Corso = require('../models/Corso');
const Scuola = require('../models/Scuola');
const ClasseUtente = require('../models/ClasseUtente');
const FileCaricato = require('../models/FileCaricato');

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { escapeLike } = require('../utils/escapeLike');
const { assicuraStessaScuola, isAdmin } = require('../utils/tenant');
const fileService = require('./fileService');
const impostazioniService = require('./impostazioniService');
const notificheService = require('./notificheService');
const { generaCertificatoPdf, immagineIncorporabile } = require('../utils/certificatoPdf');

/**
 * certificatoService — logica di dominio delle CERTIFICAZIONI di fine corso.
 *
 *   rilascio · elenco · dettaglio · revoca · PDF on-demand · verifica pubblica
 *
 * Regole di accesso:
 *   - RILASCIO/REVOCA: insegnante|admin. L'insegnante può certificare SOLO
 *     studenti con cui condivide almeno un'aula (come insegnante); l'admin è
 *     trasversale.
 *   - LETTURA/PDF: lo studente vede/scarica SOLO i propri certificati; lo staff
 *     vede quelli della PROPRIA scuola; l'admin tutti.
 *   - VERIFICA PUBBLICA: chiunque, senza autenticazione, tramite il `codice`.
 *
 * Il PDF non è salvato su disco: è rigenerato on-demand dallo SNAPSHOT congelato
 * al rilascio (`contenuto`), così resta identico nel tempo.
 */

const ATTRIBUTI_STUDENTE = ['id', 'nome', 'cognome', 'email', 'scuola_id', 'ruolo'];
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

// Alfabeto del codice di verifica: niente caratteri ambigui (0/O, 1/I/L).
const ALFABETO_CODICE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Numero massimo di segnaposto risolti (difesa banale contro input aberranti).
const SEGNAPOSTO = ['studente', 'corso', 'scuola', 'data', 'esito', 'firmatario'];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Genera un blocco di `n` caratteri casuali dall'alfabeto del codice. */
const bloccoCasuale = (n) => {
  const byte = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i += 1) out += ALFABETO_CODICE[byte[i] % ALFABETO_CODICE.length];
  return out;
};

/** Codice pubblico univoco nel formato CERT-XXXX-XXXX-XXXX. */
const generaCodice = async (transaction) => {
  for (let tentativi = 0; tentativi < 8; tentativi += 1) {
    const codice = `CERT-${bloccoCasuale(4)}-${bloccoCasuale(4)}-${bloccoCasuale(4)}`;
    const esistente = await Certificato.findOne({ where: { codice }, attributes: ['id'], transaction });
    if (!esistente) return codice;
  }
  // Estremamente improbabile: 31^12 combinazioni.
  throw new AppError('Impossibile generare un codice univoco. Riprova.', 500, 'CODICE_GEN_FAILED');
};

/** Nome completo dello studente ("Nome Cognome"). */
const nomeCompleto = (utente) => `${utente.nome || ''} ${utente.cognome || ''}`.trim();

/** Formatta una data (YYYY-MM-DD o Date) in gg/mm/aaaa. */
const formattaData = (valore) => {
  if (!valore) return null;
  const d = valore instanceof Date ? valore : new Date(`${valore}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(valore);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${gg}/${mm}/${d.getFullYear()}`;
};

/** Sostituisce i segnaposto {{chiave}} nel testo con i valori forniti. */
const sostituisciSegnaposto = (testo, valori) => {
  if (!testo) return '';
  return String(testo).replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (intero, chiave) => {
    const k = String(chiave).toLowerCase();
    if (!SEGNAPOSTO.includes(k)) return intero;
    const v = valori[k];
    return v === undefined || v === null ? '' : String(v);
  });
};

/** L'insegnante condivide almeno un'aula (come insegnante) con lo studente. */
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
    attributes: ['id'],
    transaction,
  });
  return !!m;
};

const caricaCertificato = async (certificatoId, opzioni = {}) => {
  const certificato = await Certificato.findByPk(certificatoId, opzioni);
  if (!certificato) {
    throw new AppError('Certificato non trovato.', 404, 'CERTIFICATO_NOT_FOUND');
  }
  return certificato;
};

/**
 * Accesso in LETTURA: lo studente solo ai propri; lo staff a quelli della
 * propria scuola; l'admin a tutti.
 */
const assicuraAccessoLettura = (certificato, richiedente) => {
  if (isAdmin(richiedente)) return;
  if (richiedente.ruolo === 'studente') {
    if (String(certificato.utente_id) !== String(richiedente.id)) {
      throw new AppError('Non hai accesso a questo certificato.', 403, 'FORBIDDEN');
    }
    return;
  }
  // Insegnante: confine di tenant.
  assicuraStessaScuola(
    richiedente,
    certificato.scuola_id,
    'Questo certificato non appartiene alla tua scuola.'
  );
};

/**
 * Risolve un file immagine (logo/firma) referenziato per id nello snapshot in
 * `{ buffer, mime }`, verificando il TENANT e la compatibilità con il PDF.
 * Best-effort: qualunque problema restituisce null (il PDF si genera comunque).
 */
const risolviImmagine = async (fileId, scuolaId) => {
  if (!fileId) return null;
  try {
    const file = await FileCaricato.findByPk(fileId);
    if (!file || file.tipo !== 'immagine') return null;
    // Confine di tenant: la risorsa deve appartenere alla stessa scuola del
    // certificato (o entrambe globali, caso admin).
    if (String(file.scuola_id || '') !== String(scuolaId || '')) return null;
    if (!immagineIncorporabile(file.mime_type)) return null;
    const assoluto = fileService.percorsoAssoluto(file);
    const buffer = await fsp.readFile(assoluto);
    return { buffer, mime: file.mime_type };
  } catch (err) {
    logger.warn(`[CERTIFICATO] Risorsa immagine ${fileId} non caricata: ${err.message}`);
    return null;
  }
};

// ─────────────────────────────────────────────
// RILASCIO
// ─────────────────────────────────────────────
/**
 * Rilascia un certificato di fine corso a uno studente.
 *
 * @param {Object} args
 * @param {Object} args.dati        { utenteId, corsoId?, nomeCorso?, esito?, dataCompletamento?, titolo? }
 * @param {Object} args.richiedente insegnante|admin
 * @returns {Promise<Certificato>}
 */
const emettiCertificato = async ({ dati, richiedente }) => {
  const { utenteId, corsoId, nomeCorso, esito, dataCompletamento, titolo } = dati || {};

  if (!utenteId) {
    throw new AppError('Indicare lo studente destinatario (utenteId).', 422, 'STUDENTE_RICHIESTO');
  }

  return sequelize.transaction(async (t) => {
    // 1. Studente.
    const studente = await Utente.findByPk(utenteId, { attributes: ATTRIBUTI_STUDENTE, transaction: t });
    if (!studente || studente.ruolo !== 'studente') {
      throw new AppError('Studente non trovato.', 404, 'USER_NOT_FOUND');
    }
    assicuraStessaScuola(richiedente, studente.scuola_id, 'Questo studente non appartiene alla tua scuola.');
    if (!(await condivideClasseConStudente(utenteId, richiedente, t))) {
      throw new AppError(
        'Puoi rilasciare certificati solo a studenti delle tue aule.',
        403,
        'FORBIDDEN'
      );
    }

    // 2. Corso (facoltativo) → nome del percorso.
    let corso = null;
    if (corsoId) {
      corso = await Corso.findByPk(corsoId, { transaction: t });
      if (!corso) throw new AppError('Corso non trovato.', 404, 'CORSO_NOT_FOUND');
      assicuraStessaScuola(richiedente, corso.scuola_id, 'Questo corso non appartiene alla tua scuola.');
    }
    const nomePercorso =
      (typeof nomeCorso === 'string' && nomeCorso.trim()) || (corso ? corso.titolo : null);
    if (!nomePercorso) {
      throw new AppError(
        'Indicare il corso completato (corsoId) oppure il nome del percorso (nomeCorso).',
        422,
        'PERCORSO_RICHIESTO'
      );
    }

    // 3. Tenant del certificato: la scuola dello studente.
    const scuolaId = studente.scuola_id || null;

    // 4. Modello risolto della scuola (default applicati) + nome scuola.
    const impostazioni = await impostazioniService.perScuola(scuolaId);
    const modello = impostazioni.certificato || {};
    const nomeScuola = (impostazioni.identita && impostazioni.identita.nomeVisualizzato) || null;

    // 5. Valori stampati.
    const nomeStudente = nomeCompleto(studente);
    const dataComp = (dataCompletamento && String(dataCompletamento).slice(0, 10)) ||
      new Date().toISOString().slice(0, 10);
    const esitoPulito = (typeof esito === 'string' && esito.trim()) || null;
    const titoloFinale = (typeof titolo === 'string' && titolo.trim()) || modello.titolo;
    const firmatario = modello.firmatarioNome || null;

    const corpoRisolto = sostituisciSegnaposto(modello.testoCorpo, {
      studente: nomeStudente,
      corso: nomePercorso,
      scuola: nomeScuola || '',
      data: formattaData(dataComp),
      esito: esitoPulito || '',
      firmatario: firmatario || '',
    });

    // 6. Snapshot congelato: modello + valori + corpo già risolto.
    const contenuto = {
      versione: 1,
      modello: {
        titolo: titoloFinale,
        sottotitolo: modello.sottotitolo || null,
        testoCorpo: modello.testoCorpo || null,
        firmatarioNome: modello.firmatarioNome || null,
        firmatarioTitolo: modello.firmatarioTitolo || null,
        piePagina: modello.piePagina || null,
        logoFileId: modello.logoFileId || null,
        firmaFileId: modello.firmaFileId || null,
        coloreTitolo: modello.coloreTitolo,
        coloreTesto: modello.coloreTesto,
        coloreBordo: modello.coloreBordo,
        coloreSfondo: modello.coloreSfondo,
        orientamento: modello.orientamento,
        mostraCodiceVerifica: modello.mostraCodiceVerifica,
      },
      valori: {
        nomeStudente,
        nomeCorso: nomePercorso,
        nomeScuola,
        esito: esitoPulito,
        dataCompletamento: dataComp,
        firmatario,
      },
      corpoRisolto,
    };

    // 7. Codice univoco + creazione.
    const codice = await generaCodice(t);

    const certificato = await Certificato.create(
      {
        codice,
        utente_id: studente.id,
        corso_id: corso ? corso.id : null,
        rilasciato_da: richiedente.id,
        scuola_id: scuolaId,
        titolo: titoloFinale,
        nome_studente: nomeStudente,
        nome_corso: nomePercorso,
        esito: esitoPulito,
        data_completamento: dataComp,
        contenuto,
        stato: 'valido',
      },
      { transaction: t }
    );

    // 8. Notifica allo studente (best-effort, non blocca il rilascio).
    await notificheService.accodaNotifica({
      utenteId: studente.id,
      tipo: 'certificato_rilasciato',
      titolo: titoloFinale,
      corpo: `Hai ricevuto un certificato per "${nomePercorso}".`,
      scuolaId,
      riferimentoTipo: 'certificato',
      riferimentoId: certificato.id,
      unicaPerRiferimento: true,
      transaction: t,
    });

    logger.info(
      `[CERTIFICATO] Rilasciato ${certificato.id} (${codice}) a ${studente.id} da ${richiedente.id}`
    );

    return certificato;
  });
};

// ─────────────────────────────────────────────
// ELENCO
// ─────────────────────────────────────────────
const elencoCertificati = async ({ richiedente, filtri = {} }) => {
  const { utenteId, corsoId, stato, q, scuolaId, page, limit } = filtri;

  const where = {};

  // Scope per ruolo.
  if (richiedente.ruolo === 'studente') {
    where.utente_id = richiedente.id;
  } else if (!isAdmin(richiedente)) {
    where.scuola_id = richiedente.scuola_id;
  } else if (scuolaId) {
    where.scuola_id = scuolaId;
  }

  // Filtri facoltativi (lo studente non filtra per altro studente).
  if (utenteId && richiedente.ruolo !== 'studente') where.utente_id = utenteId;
  if (corsoId) where.corso_id = corsoId;
  if (stato && Certificato.STATI_CERTIFICATO.includes(stato)) where.stato = stato;
  if (q && String(q).trim()) {
    const like = `%${escapeLike(String(q).trim())}%`;
    where[Op.or] = [
      { nome_studente: { [Op.like]: like } },
      { nome_corso: { [Op.like]: like } },
      { codice: { [Op.like]: like } },
    ];
  }

  const limite = Math.min(Math.max(parseInt(limit, 10) || LIMIT_DEFAULT, 1), LIMIT_MAX);
  const pagina = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pagina - 1) * limite;

  const { rows, count } = await Certificato.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: limite,
    offset,
  });

  return {
    certificati: rows.map((c) => c.toPublicJSON()),
    paginazione: {
      page: pagina,
      limit: limite,
      total: count,
      totalPages: Math.max(Math.ceil(count / limite), 1),
    },
  };
};

// ─────────────────────────────────────────────
// DETTAGLIO
// ─────────────────────────────────────────────
const dettaglioCertificato = async ({ certificatoId, richiedente }) => {
  const certificato = await caricaCertificato(certificatoId);
  assicuraAccessoLettura(certificato, richiedente);
  return certificato;
};

// ─────────────────────────────────────────────
// REVOCA
// ─────────────────────────────────────────────
const revocaCertificato = async ({ certificatoId, motivo, richiedente }) => {
  const certificato = await caricaCertificato(certificatoId);
  // Solo staff della stessa scuola (o admin): l'accesso studente è escluso a monte
  // dalla route (authorizeRoles), ma ribadiamo il confine di tenant qui.
  assicuraStessaScuola(
    richiedente,
    certificato.scuola_id,
    'Questo certificato non appartiene alla tua scuola.'
  );

  if (certificato.stato === 'revocato') {
    throw new AppError('Il certificato è già stato revocato.', 409, 'GIA_REVOCATO');
  }

  certificato.stato = 'revocato';
  certificato.motivo_revoca = (typeof motivo === 'string' && motivo.trim()) || null;
  certificato.revocato_da = richiedente.id;
  certificato.revocato_il = new Date();
  await certificato.save();

  logger.info(`[CERTIFICATO] Revocato ${certificato.id} da ${richiedente.id}`);
  return certificato;
};

// ─────────────────────────────────────────────
// VERIFICA PUBBLICA
// ─────────────────────────────────────────────
/**
 * Verifica pubblica di un certificato tramite codice. Nessuna autenticazione:
 * restituisce solo dati non sensibili. Un codice inesistente dà 404 generico.
 */
const verificaPubblica = async ({ codice }) => {
  const pulito = String(codice || '').trim().toUpperCase();
  if (!pulito) {
    throw new AppError('Codice di verifica mancante.', 400, 'CODICE_MANCANTE');
  }

  const certificato = await Certificato.findOne({ where: { codice: pulito } });
  if (!certificato) {
    throw new AppError('Nessun certificato corrisponde a questo codice.', 404, 'CERTIFICATO_NOT_FOUND');
  }

  // Nome scuola dallo snapshot (nessuna query extra al tenant).
  const nomeScuola =
    (certificato.contenuto && certificato.contenuto.valori && certificato.contenuto.valori.nomeScuola) ||
    null;

  return certificato.toVerificaJSON({ nomeScuola });
};

// ─────────────────────────────────────────────
// PDF ON-DEMAND
// ─────────────────────────────────────────────
/** Slug ASCII per il nome file di download. */
const slugNomeFile = (s) =>
  String(s || 'certificato')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'certificato';

/**
 * Genera (on-demand) il PDF del certificato dallo snapshot congelato.
 * @returns {Promise<{ buffer: Buffer, filename: string, certificato: Certificato }>}
 */
const generaPdf = async ({ certificatoId, richiedente }) => {
  const certificato = await caricaCertificato(certificatoId);
  assicuraAccessoLettura(certificato, richiedente);

  const snapshot = certificato.contenuto || {};
  const modello = snapshot.modello || {};
  const valori = snapshot.valori || {};

  const [logo, firma] = await Promise.all([
    risolviImmagine(modello.logoFileId, certificato.scuola_id),
    risolviImmagine(modello.firmaFileId, certificato.scuola_id),
  ]);

  // Un certificato revocato resta scaricabile, ma lo dichiara nel piè di pagina.
  const piePagina =
    certificato.stato === 'revocato'
      ? `CERTIFICATO REVOCATO${modello.piePagina ? ` · ${modello.piePagina}` : ''}`
      : modello.piePagina || null;

  const buffer = await generaCertificatoPdf({
    modello,
    titolo: certificato.titolo,
    sottotitolo: modello.sottotitolo,
    nomeStudente: certificato.nome_studente,
    corpo: snapshot.corpoRisolto || '',
    esito: certificato.esito,
    firmatarioNome: modello.firmatarioNome,
    firmatarioTitolo: modello.firmatarioTitolo,
    dataTesto: formattaData(certificato.data_completamento),
    piePagina,
    codice: modello.mostraCodiceVerifica === false ? null : certificato.codice,
    logo,
    firma,
  });

  const filename = `Certificato-${slugNomeFile(valori.nomeStudente || certificato.nome_studente)}-${certificato.codice}.pdf`;
  return { buffer, filename, certificato };
};

// ─────────────────────────────────────────────
// RISORSE (logo/firma): upload e distribuzione
// ─────────────────────────────────────────────
/**
 * Persiste un'immagine (logo o firma) caricata dallo staff, da referenziare poi
 * nelle impostazioni del certificato (`logoFileId`/`firmaFileId`). Accetta solo
 * PNG/JPEG, gli unici formati incorporabili nel PDF.
 *
 * @returns {Promise<Object>} il file pubblico (con id)
 */
const caricaRisorsa = async ({ file, richiedente }) => {
  if (!file) {
    throw new AppError('Nessun file caricato.', 400, 'NO_FILE');
  }
  if (!immagineIncorporabile(file.mimetype)) {
    // Il binario è già a terra: puliamolo (best-effort) e rifiutiamo.
    try {
      await fsp.unlink(file.path);
    } catch (_e) {
      /* best-effort */
    }
    throw new AppError(
      'Formato non supportato per il certificato: usa PNG o JPEG.',
      415,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  const salvato = await fileService.persistiFile({ tipo: 'immagine', file, richiedente });
  logger.info(`[CERTIFICATO] Caricata risorsa immagine ${salvato.id} da ${richiedente.id}`);
  return salvato.toPublicJSON();
};

/**
 * Distribuisce una risorsa immagine del certificato (anteprima logo/firma) allo
 * staff della stessa scuola. Nessun accesso agli studenti.
 */
const serviRisorsa = async ({ req, res, fileId, richiedente }) => {
  const file = await FileCaricato.findByPk(fileId);
  if (!file || file.tipo !== 'immagine') {
    throw new AppError('Risorsa non trovata.', 404, 'FILE_NOT_FOUND');
  }
  assicuraStessaScuola(richiedente, file.scuola_id, 'Questa risorsa non appartiene alla tua scuola.');
  return fileService.inviaFile(req, res, file, { disposition: 'inline' });
};

module.exports = {
  emettiCertificato,
  elencoCertificati,
  dettaglioCertificato,
  revocaCertificato,
  verificaPubblica,
  generaPdf,
  caricaRisorsa,
  serviRisorsa,
  // Esportati per test/riuso.
  sostituisciSegnaposto,
  generaCodice,
  formattaData,
};
