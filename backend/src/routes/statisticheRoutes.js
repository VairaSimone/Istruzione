'use strict';

const express = require('express');
const router = express.Router();

const statisticheController = require('../controllers/statisticheController');

const { authenticateJWT } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const validate = require('../middleware/validate');
const {
  validateHeatmap,
  validateCaratteriProblematici,
  validateAllenamentoIntensivo,
} = require('../validators/statisticheValidators');

/**
 * Route delle STATISTICHE — montate sotto `/api/statistiche`.
 * Accessibili a qualsiasi utente autenticato e attivo: la difesa sullo stato
 * dell'account è già in `authenticateJWT`.
 *
 *   GET  /api/statistiche/heatmap                  → attività per giorno (griglia GitHub)
 *   GET  /api/statistiche/streak                   → stato della streak di studio
 *   GET  /api/statistiche/caratteri-problematici   → caratteri con più errori
 *   POST /api/statistiche/allenamento-intensivo    → pool mirato sui deboli (sola lettura)
 *
 * Tutti gli endpoint sono di SOLA LETTURA (nessuna mutazione di stato) ⇒ niente
 * CSRF. L'allenamento intensivo usa POST solo per accogliere i filtri nel body.
 */

router.use(authenticateJWT);
// Gate di sezione: statistiche/heatmap disattivabili per scuola.
router.use(richiediFunzionalita('statistiche'));

router.get('/heatmap', validateHeatmap, validate, statisticheController.heatmap);

router.get('/streak', statisticheController.streak);

router.get(
  '/caratteri-problematici',
  validateCaratteriProblematici,
  validate,
  statisticheController.caratteriProblematici
);

router.post(
  '/allenamento-intensivo',
  validateAllenamentoIntensivo,
  validate,
  statisticheController.allenamentoIntensivo
);

module.exports = router;
