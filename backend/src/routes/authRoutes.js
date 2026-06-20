'use strict';

const express = require('express');
const router = express.Router();

// Controller
const authController = require('../controllers/authController');

// Middleware
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const {
  loginLimiter,
  forgotPasswordLimiter,
  registerLimiter,
  refreshLimiter,
} = require('../middleware/rateLimiter');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');

// Validatori
const {
  validateRegistrazione,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangeEmail,
  validateRefreshToken,
  validateVerifyEmail,
  validateConfirmEmailChange,
} = require('../validators/authValidators');

// Route pubbliche (non richiedono autenticazione)
router.post('/register', registerLimiter, validateRegistrazione, validate, authController.register);
router.post('/login', loginLimiter, validateLogin, validate, authController.login);
router.post('/refresh-token', refreshLimiter, validateRefreshToken, validate, authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, validate, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, validate, authController.resetPassword);
router.post('/verify-email', validateVerifyEmail, validate, authController.verifyEmail);
router.post('/confirm-email-change', validateConfirmEmailChange, validate, authController.confirmEmailChange);

// Route protette (richiedono access token valido + protezione CSRF per le mutazioni)
router.post('/logout', authenticateJWT, csrfProtection, authController.logout);
router.get('/me', authenticateJWT, authController.me);
router.delete('/me', authenticateJWT, csrfProtection, authController.deleteMe);
router.post('/request-email-change', authenticateJWT, csrfProtection, validateChangeEmail, validate, authController.requestEmailChange);
router.patch('/me/lingua', authenticateJWT, csrfProtection, authController.updateLanguage);
router.get('/gestione/utenti', authenticateJWT, authorizeRoles('insegnante'), authController.getAllUsers);
router.patch('/gestione/utenti/:id/ruolo', authenticateJWT, csrfProtection, authorizeRoles('insegnante'), authController.updateUserRole);
router.delete('/gestione/utenti/:id', authenticateJWT, csrfProtection, authorizeRoles('insegnante'), authController.deleteUserByTeacher);

module.exports = router;