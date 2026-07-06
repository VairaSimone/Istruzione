'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { passport, isGoogleConfigured } = require('../config/passport');

const { authenticateJWT } = require('../middleware/auth');
const {
  loginLimiter,
  forgotPasswordLimiter,
  registerLimiter,
  refreshLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimiter');
const { csrfProtection } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const AppError = require('../utils/AppError');

const {
  validateRegisterStudent,
  validateRegisterTeacher,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validateVerifyEmail,
  validateResendVerification,
} = require('../validators/authValidators');

// ─────────────────────────────────────────────
// Route di AUTENTICAZIONE
// NESSUNA registrazione libera né candidatura: gli account si creano SOLO su
// invito. Gli studenti completano la registrazione tramite invito di un
// insegnante (o admin); gli insegnanti tramite invito diretto di un admin, che
// ne sceglie anche la scuola. L'admin si crea via seed.
// ─────────────────────────────────────────────

// Registrazione su invito (pubbliche ma "gated" dal token di invito)
router.post('/register-student', registerLimiter, validateRegisterStudent, validate, authController.registerStudent);
router.post('/register-teacher', registerLimiter, validateRegisterTeacher, validate, authController.registerTeacher);

// Pubbliche
router.post('/login', loginLimiter, validateLogin, validate, authController.login);
router.post('/refresh-token', refreshLimiter, validateRefreshToken, validate, authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, validate, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, validate, authController.resetPassword);
router.post('/verify-email', validateVerifyEmail, validate, authController.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, validateResendVerification, validate, authController.resendVerification);

// Protette
router.post('/logout', authenticateJWT, csrfProtection, authController.logout);
router.get('/me', authenticateJWT, authController.me);

// ─────────────────────────────────────────────
// GOOGLE OAUTH 2.0
// Disponibili solo se la strategia è configurata (env presenti).
// ─────────────────────────────────────────────
const requireGoogleConfigured = (req, res, next) => {
  if (!isGoogleConfigured) {
    return next(new AppError('Login con Google non disponibile.', 503, 'GOOGLE_OAUTH_DISABLED'));
  }
  next();
};

router.get(
  '/google',
  requireGoogleConfigured,
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  requireGoogleConfigured,
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/failure',
  }),
  authController.googleCallback
);

router.get('/google/failure', authController.googleFailure);

module.exports = router;
