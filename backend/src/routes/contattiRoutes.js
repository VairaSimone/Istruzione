'use strict';

const express = require('express');
const router = express.Router();

const contattiController = require('../controllers/contattiController');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { contactLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const {
  validateInviaRichiesta,
  validateRichiestaIdParam,
  validateElencoRichieste,
  validateAggiornaRichiesta,
} = require('../validators/contattiValidators');

/**
 * Route delle RICHIESTE DI CONTATTO — montate sotto `/api/contatti`.
 *
 *   ── Pubblica (nessuna autenticazione) ──
 *   POST   /api/contatti            → invio dal form della homepage. La scuola è
 *                                     risolta dal dominio o da `?scuola=`. Rate
 *                                     limit dedicato + honeypot anti-bot.
 *
 *   ── Staff della scuola / admin (autenticate) ──
 *   GET    /api/contatti            → elenco lead della propria scuola
 *   GET    /api/contatti/:id        → dettaglio
 *   PATCH  /api/contatti/:id        → stato / presa in carico / note
 *   DELETE /api/contatti/:id        → rimozione
 *
 * L'invio pubblico NON usa CSRF (non c'è sessione da proteggere): la difesa è
 * data dal rate limiter, dall'honeypot e dalla validazione. Le mutazioni dello
 * staff sono invece protette da CSRF come il resto della piattaforma.
 */

// ── Pubblica ──
router.post('/', contactLimiter, validateInviaRichiesta, validate, contattiController.inviaRichiesta);

// ── Staff / admin ──
router.use(authenticateJWT);
router.use(authorizeRoles('insegnante', 'admin'));

router.get('/', validateElencoRichieste, validate, contattiController.elencoRichieste);

router.get('/:id', validateRichiestaIdParam, validate, contattiController.dettaglioRichiesta);

router.patch(
  '/:id',
  csrfProtection,
  validateAggiornaRichiesta,
  validate,
  contattiController.aggiornaRichiesta
);

router.delete(
  '/:id',
  csrfProtection,
  validateRichiestaIdParam,
  validate,
  contattiController.rimuoviRichiesta
);

module.exports = router;
