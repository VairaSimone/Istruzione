'use strict';

const express = require('express');
const router = express.Router();

const corsiController = require('../controllers/corsiController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const { csrfProtection } = require('../middleware/csrf');
const { uploadVideo, uploadImmagine, uploadDocumento } = require('../middleware/upload');
const validate = require('../middleware/validate');

const {
  validateCorsoIdParam,
  validateCapitoloParams,
  validateDocumentoParams,
  validateDisponibilitaParams,
  validateFileIdParam,
  validateCreaCorso,
  validateAggiornaCorso,
  validateCreaCapitolo,
  validateAggiornaCapitolo,
  validateCreaDocumento,
  validateUploadCopertina,
  validateUploadVideo,
  validateUploadDocumento,
  validateRendiDisponibile,
  validateElencoCorsi,
  validateElencoCorsiStudente,
} = require('../validators/corsiValidators');

/**
 * Route delle VIDEOLEZIONI ON-DEMAND (corsi) — montate sotto `/api/corsi`.
 *
 * Due gruppi con autorizzazioni diverse:
 *   - STUDENTE (`/studente/...`): riservate al ruolo studente; vede solo i corsi
 *     pubblicati resi disponibili a un'aula di cui è membro, e li guarda quando
 *     vuole.
 *   - STAFF (`/`, `/:id`, ...): riservate a insegnante|admin; l'insegnante cura
 *     i corsi della propria scuola e li rende disponibili solo alle proprie aule.
 *
 * Le route `/studente` sono dichiarate PRIMA di `/:id` così Express non fa
 * combaciare "studente" con il parametro `:id`.
 *
 *   ── Studente ──
 *   GET  /api/corsi/studente            → elenco corsi disponibili (pubblicati)
 *   GET  /api/corsi/studente/:id        → dettaglio corso (capitoli, video, documenti)
 *
 *   ── Staff (insegnante | admin) ──
 *   POST   /api/corsi                                                  → crea corso
 *   GET    /api/corsi                                                  → elenco corsi della scuola
 *   GET    /api/corsi/:id                                              → dettaglio + capitoli + aule
 *   PATCH  /api/corsi/:id                                              → modifica corso
 *   DELETE /api/corsi/:id                                              → elimina corso
 *   POST   /api/corsi/:id/capitoli                                     → aggiungi capitolo
 *   PATCH  /api/corsi/:id/capitoli/:capitoloId                         → modifica capitolo
 *   DELETE /api/corsi/:id/capitoli/:capitoloId                         → elimina capitolo
 *   POST   /api/corsi/:id/capitoli/:capitoloId/documenti              → aggiungi documento
 *   DELETE /api/corsi/:id/capitoli/:capitoloId/documenti/:documentoId → elimina documento
 *   POST   /api/corsi/:id/disponibilita                               → rendi disponibile a un'aula
 *   DELETE /api/corsi/:id/disponibilita/:classeId                     → revoca disponibilità
 *
 * Le mutazioni sono protette da CSRF (double-submit cookie). Le letture no.
 */

router.use(authenticateJWT);
// Gate di sezione: se la scuola ha disattivato i corsi, l'intero modulo è 403.
// Nascondere la voce di menu lato frontend non basta: il controllo è qui.
router.use(richiediFunzionalita('corsi'));

// ═════════════════════════════════════════════
// STUDENTE
// ═════════════════════════════════════════════
router.get(
  '/studente',
  authorizeRoles('studente'),
  validateElencoCorsiStudente,
  validate,
  corsiController.elencoCorsiStudente
);

router.get(
  '/studente/:id',
  authorizeRoles('studente'),
  validateCorsoIdParam,
  validate,
  corsiController.dettaglioCorsoStudente
);

// ═════════════════════════════════════════════
// SERVIZIO FILE PROTETTO (studente | staff)
// ═════════════════════════════════════════════
// Dichiarata PRIMA di `/:id` per non farla combaciare con il parametro corso.
// Nessun authorizeRoles: l'accesso (studente iscritto o staff della scuola) è
// deciso in corsiService.risolviAccessoFile. Solo autenticazione a monte.
router.get(
  '/files/:fileId',
  validateFileIdParam,
  validate,
  corsiController.serviFile
);

// ═════════════════════════════════════════════
// STAFF (insegnante | admin)
// ═════════════════════════════════════════════

// ── Letture ──
router.get(
  '/',
  authorizeRoles('insegnante', 'admin'),
  validateElencoCorsi,
  validate,
  corsiController.elencoCorsi
);

router.get(
  '/:id',
  authorizeRoles('insegnante', 'admin'),
  validateCorsoIdParam,
  validate,
  corsiController.dettaglioCorso
);

// ── CRUD corso ──
router.post(
  '/',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCreaCorso,
  validate,
  corsiController.creaCorso
);

router.patch(
  '/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiornaCorso,
  validate,
  corsiController.aggiornaCorso
);

router.delete(
  '/:id',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCorsoIdParam,
  validate,
  corsiController.eliminaCorso
);

// ── Copertina del corso (upload file dal PC) ──
router.post(
  '/:id/copertina',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  uploadImmagine,
  validateUploadCopertina,
  validate,
  corsiController.impostaCopertina
);

router.delete(
  '/:id/copertina',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCorsoIdParam,
  validate,
  corsiController.rimuoviCopertina
);

// ── Capitoli ──
router.post(
  '/:id/capitoli',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCreaCapitolo,
  validate,
  corsiController.aggiungiCapitolo
);

router.patch(
  '/:id/capitoli/:capitoloId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateAggiornaCapitolo,
  validate,
  corsiController.aggiornaCapitolo
);

router.delete(
  '/:id/capitoli/:capitoloId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCapitoloParams,
  validate,
  corsiController.eliminaCapitolo
);

// ── Video del capitolo (upload file dal PC) ──
router.post(
  '/:id/capitoli/:capitoloId/video',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  uploadVideo,
  validateUploadVideo,
  validate,
  corsiController.impostaVideoCapitolo
);

router.delete(
  '/:id/capitoli/:capitoloId/video',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCapitoloParams,
  validate,
  corsiController.rimuoviVideoCapitolo
);

// ── Documenti del capitolo ──
router.post(
  '/:id/capitoli/:capitoloId/documenti',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateCreaDocumento,
  validate,
  corsiController.aggiungiDocumento
);

// ── Documento del capitolo via file (allegato dal PC) ──
router.post(
  '/:id/capitoli/:capitoloId/documenti/upload',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  uploadDocumento,
  validateUploadDocumento,
  validate,
  corsiController.aggiungiDocumentoFile
);

router.delete(
  '/:id/capitoli/:capitoloId/documenti/:documentoId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateDocumentoParams,
  validate,
  corsiController.eliminaDocumento
);

// ── Disponibilità presso le aule ──
router.post(
  '/:id/disponibilita',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateRendiDisponibile,
  validate,
  corsiController.rendiDisponibile
);

router.delete(
  '/:id/disponibilita/:classeId',
  authorizeRoles('insegnante', 'admin'),
  csrfProtection,
  validateDisponibilitaParams,
  validate,
  corsiController.revocaDisponibilita
);

module.exports = router;
