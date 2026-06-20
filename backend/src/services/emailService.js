'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { i18next } = require('../config/i18n');

// Configurazione del trasportatore SMTP basato sulle variabili d'ambiente (.env)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true per la porta 465, false per le altre
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Invia l'email di verifica dopo la registrazione
 */
const sendVerificationEmail = async (email, token, lingua = 'it') => {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: `"Piattaforma Giapponese" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: t('email.verify.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.verify.title')}</h2>
        <p>${t('email.verify.body')}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #e60012; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${t('email.verify.button')}</a>
        </div>
        <p>${t('email.verify.fallback')}</p>
        <p><a href="${url}">${url}</a></p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${t('email.verify.footer')}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di verifica inviata con successo a: ${email} in lingua: ${lingua}`);
};

/**
 * Invia l'email per il ripristino della password
 */
const sendPasswordResetEmail = async (email, token, lingua = 'it') => {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: `"Piattaforma Giapponese" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: t('email.reset.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.reset.title')}</h2>
        <p>${t('email.reset.body')}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #333; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${t('email.reset.button')}</a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${t('email.reset.footer')}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di reset password inviata con successo a: ${email} in lingua: ${lingua}`);
};

/**
 * Invia l'email per la conferma del cambio email.
 * Il link punta alla pagina applicativa del FRONTEND (non più a una GET
 * del backend che modifica lo stato): la pagina effettua poi una richiesta
 * POST esplicita di conferma.
 */
const sendEmailChangeEmail = async (email, token, lingua = 'it') => {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email-change?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: `"Piattaforma Giapponese" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: t('email.change.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <p>${t('email.change.body')}</p>
        <p><a href="${url}">${url}</a></p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di cambio indirizzo inviata a: ${email} in lingua: ${lingua}`);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeEmail,
};