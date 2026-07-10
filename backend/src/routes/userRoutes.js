'use strict';

const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');

const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

const {
  validateChangeEmail,
  validateConfirmEmailChange,
} = require('../validators/authValidators');

/**
 * Route di GESTIONE UTENTI / ACCOUNT.
 *
 * Montate sotto lo stesso prefisso `/api/auth` delle route di
 * autenticazione: gli URL pubblici restano invariati (compatibilità con il
 * frontend esistente), ma la logica è separata in UserController/UserService.
 */

// Conferma cambio email — pubblica (token nel link email)
router.post('/confirm-email-change', validateConfirmEmailChange, validate, userController.confirmEmailChange);

// Account dell'utente autenticato
router.post('/request-email-change', authenticateJWT, csrfProtection, validateChangeEmail, validate, userController.requestEmailChange);
router.patch('/me/lingua', authenticateJWT, csrfProtection, userController.updateLanguage);

// Preferenze di notifica email (digest)
router.get('/me/notifiche', authenticateJWT, userController.getNotificationPreferences);
router.patch('/me/notifiche', authenticateJWT, csrfProtection, userController.updateNotificationPreferences);

router.delete('/me', authenticateJWT, csrfProtection, userController.deleteMe);

// Operazioni amministrative (insegnanti e admin)
router.get('/gestione/utenti', authenticateJWT, authorizeRoles('insegnante', 'admin'), userController.getAllUsers);
router.patch('/gestione/utenti/:id/ruolo', authenticateJWT, csrfProtection, authorizeRoles('insegnante', 'admin'), userController.updateUserRole);
router.delete('/gestione/utenti/:id', authenticateJWT, csrfProtection, authorizeRoles('insegnante', 'admin'), userController.deleteUserByTeacher);

module.exports = router;
