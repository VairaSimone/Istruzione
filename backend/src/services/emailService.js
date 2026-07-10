'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { i18next } = require('../config/i18n');
const piattaforma = require('../config/piattaforma');

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
  const url = `${piattaforma.FRONTEND_URL}/verify-email?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
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
  const url = `${piattaforma.FRONTEND_URL}/reset-password?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
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
  const url = `${piattaforma.FRONTEND_URL}/verify-email-change?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
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

/**
 * Invia l'invito a uno studente: link al form di completamento profilo.
 * La classe è già assegnata dall'insegnante e viene solo mostrata a titolo
 * informativo (l'utente non può modificarla).
 */
const sendStudentInviteEmail = async (email, token, classe, lingua = 'it') => {
  const url = `${piattaforma.FRONTEND_URL}/register?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
    to: email,
    subject: t('email.studentInvite.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.studentInvite.title')}</h2>
        <p>${t('email.studentInvite.body')}</p>
        <p><strong>${t('email.studentInvite.classLabel')}:</strong> ${classe || '-'}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #e60012; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${t('email.studentInvite.button')}</a>
        </div>
        <p>${t('email.studentInvite.fallback')}</p>
        <p><a href="${url}">${url}</a></p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${t('email.studentInvite.footer')}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di invito studente inviata a: ${email} in lingua: ${lingua}`);
};

/**
 * Invia l'invito a un insegnante (onboarding diretto dell'admin): link al
 * form di completamento profilo. Nessuna classe.
 */
const sendTeacherInviteEmail = async (email, token, lingua = 'it') => {
  const url = `${piattaforma.FRONTEND_URL}/register?token=${token}`;

  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
    to: email,
    subject: t('email.teacherInvite.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.teacherInvite.title')}</h2>
        <p>${t('email.teacherInvite.body')}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #e60012; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${t('email.teacherInvite.button')}</a>
        </div>
        <p>${t('email.teacherInvite.fallback')}</p>
        <p><a href="${url}">${url}</a></p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${t('email.teacherInvite.footer')}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di invito insegnante inviata a: ${email} in lingua: ${lingua}`);
};

/** Notifica all'insegnante l'approvazione della sua candidatura. */
const sendInsegnanteApprovatoEmail = async (email, lingua = 'it') => {
  const url = `${piattaforma.FRONTEND_URL}/login`;
  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
    to: email,
    subject: t('email.teacherApproved.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.teacherApproved.title')}</h2>
        <p>${t('email.teacherApproved.body')}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${t('email.teacherApproved.button')}</a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${t('email.teacherApproved.footer')}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di approvazione insegnante inviata a: ${email} in lingua: ${lingua}`);
};

/** Notifica all'insegnante il rifiuto della sua candidatura. */
const sendInsegnanteRifiutatoEmail = async (email, lingua = 'it') => {
  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
    to: email,
    subject: t('email.teacherRejected.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.teacherRejected.title')}</h2>
        <p>${t('email.teacherRejected.body')}</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${t('email.teacherRejected.footer')}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di rifiuto insegnante inviata a: ${email} in lingua: ${lingua}`);
};

/** Notifica agli admin l'arrivo di una nuova candidatura insegnante. */
const sendNuovaCandidaturaAdminEmail = async (emailAdmin, candidato, lingua = 'it') => {
  const url = `${piattaforma.FRONTEND_URL}/admin/candidature`;
  const t = i18next.getFixedT(lingua);

  const mailOptions = {
    from: piattaforma.mittente(),
    to: emailAdmin,
    subject: t('email.adminNewRequest.subject'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${t('email.adminNewRequest.title')}</h2>
        <p>${t('email.adminNewRequest.body')}</p>
        <ul>
          <li><strong>${t('email.adminNewRequest.nameLabel')}:</strong> ${candidato.nome} ${candidato.cognome}</li>
          <li><strong>Email:</strong> ${candidato.email}</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #333; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${t('email.adminNewRequest.button')}</a>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email notifica candidatura inviata all'admin: ${emailAdmin}`);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeEmail,
  sendStudentInviteEmail,
  sendTeacherInviteEmail,
  sendInsegnanteApprovatoEmail,
  sendInsegnanteRifiutatoEmail,
  sendNuovaCandidaturaAdminEmail,
};