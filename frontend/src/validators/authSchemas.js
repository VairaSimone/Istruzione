import { z } from 'zod';
import { CLASSE_MAX, ETA_MIN, ETA_MAX } from '../constants/domain';

/**
 * Schemi di validazione Zod localizzati.
 *
 * Poiché i messaggi devono essere tradotti nella lingua corrente, ogni schema
 * è esposto come FUNZIONE che riceve la funzione di traduzione `t` di
 * react-i18next. Nei componenti va costruito con `useMemo`:
 *
 *   const schema = useMemo(() => buildLoginSchema(t), [t]);
 *
 * In questo modo, al cambio lingua, gli schemi (e quindi i messaggi di errore)
 * vengono rigenerati automaticamente.
 *
 * Le regole rispecchiano 1:1 i validator server-side (authValidators.js).
 */

// Stessa regex usata in authValidators.js -> passwordRegex
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// Stessa regex usata per nome/cognome (supporta accenti, apostrofi, trattini)
const NAME_REGEX = /^[\p{L}\p{M}\s'-]+$/u;

const buildPasswordSchema = (t) =>
  z
    .string()
    .trim()
    .min(1, t('validation.passwordRequired'))
    .regex(PASSWORD_REGEX, t('validation.passwordComplexity'));

const buildEmailSchema = (t) =>
  z
    .string()
    .trim()
    .min(1, t('validation.emailRequired'))
    .email(t('validation.emailInvalid'))
    .max(255, t('validation.emailMax'));

const buildNomeSchema = (t, kind = 'nome') =>
  z
    .string()
    .trim()
    .min(1, t(`validation.${kind}Required`))
    .min(2, t(`validation.${kind}Length`))
    .max(100, t(`validation.${kind}Length`))
    .regex(NAME_REGEX, t(`validation.${kind}Invalid`));

const buildEtaSchema = (t) =>
  z.coerce
    .number({ message: t('validation.etaRequired') })
    .int(t('validation.etaInt'))
    .min(ETA_MIN, t('validation.etaMin', { min: ETA_MIN }))
    .max(ETA_MAX, t('validation.etaMax', { max: ETA_MAX }));

/**
 * Completamento registrazione STUDENTE su invito.
 * Email e classe NON sono nel form: derivano dall'invito (sola lettura).
 */
export const buildRegisterStudentSchema = (t) =>
  z
    .object({
      nome: buildNomeSchema(t, 'nome'),
      cognome: buildNomeSchema(t, 'cognome'),
      eta: buildEtaSchema(t),
      password: buildPasswordSchema(t),
      confermaPassword: z.string().trim().min(1, t('validation.confirmRequired')),
    })
    .refine((data) => data.password === data.confermaPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confermaPassword'],
    });

/**
 * Completamento registrazione INSEGNANTE su invito admin.
 * Nessuna classe, nessuna età.
 */
export const buildRegisterTeacherSchema = (t) =>
  z
    .object({
      nome: buildNomeSchema(t, 'nome'),
      cognome: buildNomeSchema(t, 'cognome'),
      password: buildPasswordSchema(t),
      confermaPassword: z.string().trim().min(1, t('validation.confirmRequired')),
    })
    .refine((data) => data.password === data.confermaPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confermaPassword'],
    });

/**
 * Campo scuola per gli inviti/aule lato ADMIN. Obbligatorio quando l'utente è
 * admin (deve scegliere la scuola di destinazione); assente/ignorato per gli
 * insegnanti (il backend usa la loro scuola).
 */
const buildScuolaIdSchema = (t, required) => {
  const base = z.string().trim().uuid(t('validation.scuolaInvalid'));
  return required
    ? z.string().trim().min(1, t('validation.scuolaRequired')).uuid(t('validation.scuolaInvalid'))
    : base.optional().or(z.literal(''));
};

/**
 * Creazione invito STUDENTE (email + classe [+ scuola per admin]).
 * `requireScuola` = true quando il form è compilato da un admin.
 */
export const buildStudentInviteSchema = (t, { requireScuola = false } = {}) =>
  z.object({
    email: buildEmailSchema(t),
    // La classe è TESTO LIBERO: il vocabolario ammesso è un'impostazione della
    // scuola di destinazione (`didattica.classiDisponibili`), non una costante
    // di codice. Se la scuola l'ha definito, il <select> mostra solo quelle voci
    // e il backend rifiuta comunque i valori estranei.
    classe: z
      .string()
      .trim()
      .min(1, t('validation.classeRequired'))
      .max(CLASSE_MAX, t('validation.classeMax')),
    scuolaId: buildScuolaIdSchema(t, requireScuola),
  });

/** Creazione invito INSEGNANTE (email + scuola). Solo admin: scuola obbligatoria. */
export const buildTeacherInviteSchema = (t) =>
  z.object({
    email: buildEmailSchema(t),
    scuolaId: buildScuolaIdSchema(t, true),
  });

export const buildLoginSchema = (t) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .email(t('validation.emailInvalid')),
    password: z.string().trim().min(1, t('validation.passwordRequired')),
  });

export const buildForgotPasswordSchema = (t) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .email(t('validation.emailInvalid')),
  });

export const buildResetPasswordSchema = (t) =>
  z
    .object({
      nuovaPassword: buildPasswordSchema(t),
      confermaPassword: z.string().trim().min(1, t('validation.confirmRequired')),
    })
    .refine((data) => data.nuovaPassword === data.confermaPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confermaPassword'],
    });

export const buildChangeEmailSchema = (t) =>
  z.object({
    nuovaEmail: buildEmailSchema(t),
  });

export const buildUpdateRoleSchema = (t) =>
  z.object({
    ruolo: z.enum(['studente', 'insegnante'], {
      message: t('validation.roleInvalid'),
    }),
  });
