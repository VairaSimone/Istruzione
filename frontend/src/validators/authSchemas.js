import { z } from 'zod';
import { CLASSI, ETA_MIN, ETA_MAX } from '../constants/domain';

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
const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'-]+$/;

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

export const buildRegisterSchema = (t) =>
  z
    .object({
      nome: z
        .string()
        .trim()
        .min(1, t('validation.nomeRequired'))
        .min(2, t('validation.nomeLength'))
        .max(100, t('validation.nomeLength'))
        .regex(NAME_REGEX, t('validation.nomeInvalid')),

      cognome: z
        .string()
        .trim()
        .min(1, t('validation.cognomeRequired'))
        .min(2, t('validation.cognomeLength'))
        .max(100, t('validation.cognomeLength'))
        .regex(NAME_REGEX, t('validation.cognomeInvalid')),

      eta: z.coerce
        .number({ message: t('validation.etaRequired') })
        .int(t('validation.etaInt'))
        .min(ETA_MIN, t('validation.etaMin', { min: ETA_MIN }))
        .max(ETA_MAX, t('validation.etaMax', { max: ETA_MAX })),

      email: buildEmailSchema(t),

      password: buildPasswordSchema(t),

      confermaPassword: z.string().trim().min(1, t('validation.confirmRequired')),

      classe: z.enum(CLASSI, {
        message: t('validation.classeInvalid', { values: CLASSI.join(', ') }),
      }),
    })
    .refine((data) => data.password === data.confermaPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confermaPassword'],
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
