'use strict';

const express = require('express');
const router = express.Router();

const calendarioController = require('../controllers/calendarioController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateEventoIdParam,
  validateDestinatarioParams,
  validateCreaEvento,
  validateAggiornaEvento,
  validateAggiungiDestinatario,
  validateElencoEventi,
  validateFeedCalendario,
} = require('../validators/calendarioValidators');

/**
 * Route del CALENDARIO — montate sotto `/api/calendario`.
 *
 * Due gruppi:
 *   - FEED (`GET /`): accessibile a studenti e insegnanti. Restituisce la vista
 *     unificata del calendario nella finestra richiesta, unendo gli eventi
 *     persistiti alle scadenze dei compiti destinati all'utente.
 *   - GESTIONE EVENTI (`/eventi...`): riservata a insegnante|admin. Ogni
 *     insegnante gestisce solo i propri eventi e li destina solo alle proprie
 *     aule o a studenti delle proprie aule.
 *
 * La rotta letterale `/eventi` è distinta da `/`, quindi non c'è ambiguità di
 * matching. `/eventi/:id` è dichiarata dopo `/eventi` (elenco/creazione).
 *
 *   ── Feed (studente + docente) ──
 *   GET  /api/calendario                        → feed unificato
 *        (?da, ?a = finestra ISO 8601; ?tipoVoce=evento|compito)
 *
 *   ── Gestione eventi (docente/admin) ──
 *   POST   /api/calendario/eventi                               → crea evento
 *   GET    /api/calendario/eventi                               → elenco eventi creati
 *   GET    /api/calendario/eventi/:id                           → dettaglio + destinatari
 *   PATCH  /api/calendario/eventi/:id                           → modifica
 *   DELETE /api/calendario/eventi/:id                           → elimina
 *   POST   /api/calendario/eventi/:id/destinatari               → destina a classe|studente
 *   DELETE /api/calendario/eventi/:id/destinatari/:destinatarioId → rimuovi destinatario
 */

router.use(authenticateJWT);
router.use(richiediFunzionalita('calendario'));

// ── FEED (tutti i ruoli autenticati) ──
router.get('/', validateFeedCalendario, validate, calendarioController.feed);

// ── GESTIONE EVENTI (docente/admin) ──
router.post(
  '/eventi',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCreaEvento,
  validate,
  calendarioController.creaEvento
);

router.get(
  '/eventi',
  authorizeRoles('insegnante', 'admin'),
  validateElencoEventi,
  validate,
  calendarioController.elencoEventi
);

router.get(
  '/eventi/:id',
  authorizeRoles('insegnante', 'admin'),
  validateEventoIdParam,
  validate,
  calendarioController.dettaglioEvento
);

router.patch(
  '/eventi/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiornaEvento,
  validate,
  calendarioController.aggiornaEvento
);

router.delete(
  '/eventi/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateEventoIdParam,
  validate,
  calendarioController.eliminaEvento
);

router.post(
  '/eventi/:id/destinatari',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiungiDestinatario,
  validate,
  calendarioController.aggiungiDestinatario
);

router.delete(
  '/eventi/:id/destinatari/:destinatarioId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateDestinatarioParams,
  validate,
  calendarioController.rimuoviDestinatario
);

module.exports = router;
