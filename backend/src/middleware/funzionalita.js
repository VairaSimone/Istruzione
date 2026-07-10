'use strict';

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const impostazioniService = require('../services/impostazioniService');
const { esiste, trova } = require('../constants/funzionalita');

/**
 * GATE DELLE FUNZIONALITÀ.
 *
 * Ogni scuola decide quali sezioni della piattaforma rendere disponibili. Il
 * frontend nasconde le voci di menu delle sezioni disattivate, ma nascondere
 * non è proteggere: senza un controllo lato server, una chiamata diretta
 * all'API raggiungerebbe comunque la sezione. Questo middleware chiude il buco.
 *
 * Uso, in testa alle route di una sezione:
 *
 *     router.use(authenticateJWT);
 *     router.use(richiediFunzionalita('quiz'));
 *
 * Comportamento:
 *   - ADMIN → passa sempre. È trasversale alle scuole e deve poter amministrare
 *     ogni sezione, anche di una scuola che l'ha disattivata per i propri utenti.
 *   - Utente SENZA scuola (non admin) → 403: nessun tenant, nessuna funzionalità.
 *   - Scuola inesistente o sospesa → 403 (fail-closed).
 *   - Funzionalità disattivata → 403 `FEATURE_DISABLED`, con la chiave nel
 *     codice d'errore così il frontend può reagire in modo specifico.
 *
 * Deve essere montato DOPO `authenticateJWT` (ha bisogno di `req.user`).
 */

/**
 * @param {string} chiave chiave del registro `constants/funzionalita.js`
 * @returns {import('express').RequestHandler}
 */
const richiediFunzionalita = (chiave) => {
  // Fail-fast all'avvio: un refuso nel nome della funzionalità non deve
  // trasformarsi in un gate silenziosamente permissivo (o in un 403 perenne).
  if (!esiste(chiave)) {
    throw new Error(
      `richiediFunzionalita: funzionalità sconosciuta "${chiave}". ` +
        'Aggiungila a src/constants/funzionalita.js.'
    );
  }

  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Non sei autenticato.', 401, 'INVALID_TOKEN'));
    }

    // L'admin è trasversale: nessun vincolo di tenant, nessun gate.
    if (req.user.ruolo === 'admin') return next();

    if (!req.user.scuola_id) {
      return next(
        new AppError('Il tuo account non è associato ad alcuna scuola.', 403, 'NO_SCUOLA')
      );
    }

    // `funzionalita()` lancia già 403 per scuola inesistente o sospesa.
    const mappa = await impostazioniService.funzionalita(req.user.scuola_id);

    if (!mappa[chiave]) {
      const descrittore = trova(chiave);
      return next(
        new AppError(
          `La sezione "${descrittore.nome}" non è attiva per la tua scuola.`,
          403,
          'FEATURE_DISABLED'
        )
      );
    }

    // Reso disponibile ai controller a valle: evita una seconda lettura quando
    // serve sapere quali altre sezioni sono attive (es. dashboard aggregata).
    req.funzionalita = mappa;
    next();
  });
};

/**
 * Variante non bloccante: carica `req.funzionalita` e `req.impostazioniScuola`
 * senza rifiutare la richiesta. Utile per gli endpoint aggregati (dashboard)
 * che devono comporre la risposta in base alle sezioni attive.
 */
const caricaImpostazioniScuola = catchAsync(async (req, res, next) => {
  if (!req.user) return next();
  req.funzionalita = await impostazioniService.funzionalita(req.user.scuola_id || null);
  req.impostazioniScuola = await impostazioniService.perScuola(req.user.scuola_id || null);
  next();
});

module.exports = { richiediFunzionalita, caricaImpostazioniScuola };
