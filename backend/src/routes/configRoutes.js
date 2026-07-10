'use strict';

const express = require('express');
const router = express.Router();

const configController = require('../controllers/configController');
const { query } = require('express-validator');
const validate = require('../middleware/validate');

/**
 * Route di CONFIGURAZIONE — montate sotto `/api/config`.
 *
 * PUBBLICHE (nessuna autenticazione): il frontend le interroga al bootstrap,
 * prima ancora della pagina di login, per applicare nome, logo, favicon, colori
 * e tema della scuola e per sapere quali sezioni mostrare.
 *
 *   GET /api/config          → branding + funzionalità della scuola risolta
 *   GET /api/config/scuole   → elenco scuole attive (selettore di tenant)
 *   GET /api/config/schema   → schema dei settaggi (form dinamico lato admin)
 *
 * Le SCRITTURE delle impostazioni NON stanno qui: vivono sotto `/api/scuole`,
 * autenticate e protette da CSRF. La separazione tra "configurazione letta dal
 * client" e "amministrazione della scuola" è voluta.
 */

const validateTenant = [
  query('scuola')
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage("L'identificativo della scuola non è valido"),
];

router.get('/', validateTenant, validate, configController.configurazione);
router.get('/scuole', configController.elencoScuolePubblico);
router.get('/schema', configController.schemaImpostazioni);

module.exports = router;
