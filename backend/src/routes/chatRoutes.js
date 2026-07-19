'use strict';

const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chatController');

const { authenticateJWT } = require('../middleware/auth');
const { richiediFunzionalita } = require('../middleware/funzionalita');
const { csrfProtection } = require('../middleware/csrf');
const { uploadVideo, uploadImmagine, uploadDocumento } = require('../middleware/upload');
const { verificaQuotaStorage } = require('../middleware/quotaStorage');
const validate = require('../middleware/validate');
const AppError = require('../utils/AppError');

const {
  validateClasseIdParam,
  validateMessaggioIdParam,
  validateFileIdParam,
  validateInviaMessaggio,
  validateInviaMessaggioAllegato,
  validateElencoMessaggi,
} = require('../validators/chatValidators');

/**
 * Route della CHAT D'AULA — montate sotto `/api/chat`.
 *
 * Ogni aula ha un feed di gruppo condiviso da tutti i suoi membri (studenti e
 * insegnanti). L'accesso a una chat richiede di essere membro dell'aula: il
 * controllo NON è per ruolo globale ma per membership, ed è centralizzato nel
 * service. Qui montiamo solo autenticazione, gate di sezione e validazione.
 *
 *   GET    /api/chat/aule                                → le mie aule con chat (+ non letti)
 *   GET    /api/chat/notifiche                           → conteggio non letti (tutte le aule)
 *   GET    /api/chat/:classeId/messaggi                  → feed (cursore ?primaDi, ?limit)
 *   POST   /api/chat/:classeId/messaggi                  → invia messaggio (testo)
 *   POST   /api/chat/:classeId/messaggi/allegato/:tipo   → invia messaggio con allegato
 *   POST   /api/chat/:classeId/letto                     → segna la chat come letta
 *   GET    /api/chat/:classeId/file/:fileId              → scarica/visualizza l'allegato
 *   DELETE /api/chat/:classeId/messaggi/:messaggioId     → elimina (autore | insegnante | admin)
 *
 * Le route letterali (`/aule`, `/notifiche`) sono dichiarate PRIMA di quelle con
 * `:classeId`. Le mutazioni sono protette da CSRF.
 */

router.use(authenticateJWT);
// Gate di sezione: la chat d'aula è attivabile per scuola (off di default).
router.use(richiediFunzionalita('chatAula'));

// ── Uploader per tipo di allegato ──
// Multer va scelto in base al `:tipo` della route. Un dispatcher instrada verso
// l'uploader corretto (con i suoi limiti di dimensione e la verifica dei magic
// bytes) e respinge i tipi non gestiti prima ancora di toccare il disco.
const UPLOADER_PER_TIPO = {
  immagine: uploadImmagine,
  documento: uploadDocumento,
  video: uploadVideo,
};
const uploadAllegato = (req, res, next) => {
  const uploader = UPLOADER_PER_TIPO[req.params.tipo];
  if (!uploader) {
    return next(new AppError('Tipo di allegato non valido.', 400, 'INVALID_ATTACHMENT_TYPE'));
  }
  return uploader(req, res, next);
};

// ── Letterali (prima dei parametrici) ──
router.get('/aule', chatController.elencoAule);
router.get('/notifiche', chatController.notifiche);

// ── Feed ──
router.get(
  '/:classeId/messaggi',
  validateElencoMessaggi,
  validate,
  chatController.elencoMessaggi
);

router.post(
  '/:classeId/messaggi',
  csrfProtection,
  validateInviaMessaggio,
  validate,
  chatController.inviaMessaggio
);

router.post(
  '/:classeId/messaggi/allegato/:tipo',
  csrfProtection,
  uploadAllegato,
  verificaQuotaStorage,
  validateInviaMessaggioAllegato,
  validate,
  chatController.inviaMessaggioConAllegato
);

router.post(
  '/:classeId/letto',
  csrfProtection,
  validateClasseIdParam,
  validate,
  chatController.segnaLetto
);

router.get(
  '/:classeId/file/:fileId',
  [...validateClasseIdParam, ...validateFileIdParam],
  validate,
  chatController.serviFile
);

router.delete(
  '/:classeId/messaggi/:messaggioId',
  csrfProtection,
  [...validateClasseIdParam, ...validateMessaggioIdParam],
  validate,
  chatController.eliminaMessaggio
);

module.exports = router;
