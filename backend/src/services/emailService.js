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

/**
 * Costruisce un URL assoluto dal `link` di una notifica: se è già assoluto lo
 * restituisce invariato, altrimenti lo antepone a FRONTEND_URL.
 */
const urlAssoluto = (link) => {
  if (!link) return piattaforma.FRONTEND_URL;
  if (/^https?:\/\//i.test(link)) return link;
  const base = piattaforma.FRONTEND_URL.replace(/\/+$/, '');
  const path = String(link).replace(/^\/+/, '');
  return `${base}/${path}`;
};

/** Escape minimale per i valori interpolati nell'HTML dell'email. */
const escapeHtml = (testo) =>
  String(testo ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Invia il DIGEST periodico delle notifiche a un utente: un'unica email che
 * riepiloga, raggruppati per tipo, tutti gli eventi in attesa (nuovi messaggi,
 * nuovi compiti, scadenze, feedback). Le sezioni e le righe sono già pronte,
 * composte da `notificheService`; qui avviene solo la resa in HTML.
 *
 * @param {string} email
 * @param {Object} dati
 * @param {string|null} dati.nomeScuola  nome del tenant (mittente/branding)
 * @param {Array}  dati.sezioni          [{ i18nSezione, totale, eccedenza, righe }]
 * @param {number} dati.totale           numero complessivo di notifiche
 * @param {string} dati.lingua
 */
const sendDigestEmail = async (email, { nomeScuola, sezioni, totale, lingua = 'it' }) => {
  const t = i18next.getFixedT(lingua);

  // Corpo: una "card" per sezione, con l'elenco delle righe.
  const sezioniHtml = (sezioni || [])
    .map((sez) => {
      const titoloSezione = t(`email.digest.tipi.${sez.i18nSezione}`, { count: sez.totale });
      const righeHtml = sez.righe
        .map((r) => {
          const titolo = escapeHtml(r.titolo);
          const corpo = r.corpo
            ? `<div style="font-size:13px; color:#666; margin-top:2px;">${escapeHtml(r.corpo)}</div>`
            : '';
          const link = r.link
            ? `<a href="${urlAssoluto(r.link)}" style="color:#4F46E5; text-decoration:none;">${titolo}</a>`
            : titolo;
          return `
            <li style="margin:0 0 10px 0; padding:0; list-style:none;">
              <div style="font-size:14px; color:#222; font-weight:600;">${link}</div>
              ${corpo}
            </li>`;
        })
        .join('');

      const eccedenzaHtml =
        sez.eccedenza > 0
          ? `<div style="font-size:13px; color:#888; margin-top:6px;">${t('email.digest.eAltri', { count: sez.eccedenza })}</div>`
          : '';

      return `
        <div style="margin:0 0 24px 0;">
          <h3 style="font-size:16px; color:#111; margin:0 0 12px 0;">${escapeHtml(titoloSezione)}</h3>
          <ul style="margin:0; padding:0;">${righeHtml}</ul>
          ${eccedenzaHtml}
        </div>`;
    })
    .join('');

  const url = urlAssoluto('/');

  const mailOptions = {
    from: piattaforma.mittente(nomeScuola),
    to: email,
    subject: t('email.digest.subject', { count: totale }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #333;">${escapeHtml(t('email.digest.title'))}</h2>
        <p style="color:#555;">${escapeHtml(t('email.digest.intro', { count: totale }))}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        ${sezioniHtml}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px;">${escapeHtml(t('email.digest.button'))}</a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">${escapeHtml(t('email.digest.footer'))}</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.info(`Email di digest notifiche inviata a: ${email} (${totale} notifiche, lingua: ${lingua})`);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeEmail,
  sendStudentInviteEmail,
  sendTeacherInviteEmail,
  sendDigestEmail,
};