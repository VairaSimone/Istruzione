import { z } from 'zod';
import { CLASSI, ETA_MIN, ETA_MAX } from '../constants/domain';

/**
 * Tutti gli schemi qui sotto rispecchiano FEDELMENTE le regole reali
 * implementate in `backend/src/validators/authValidators.js` e nel modello
 * `Utente.js`. Non sono "inventati" sulla base della sola documentazione:
 * la regex password, i range numerici e i pattern sui nomi sono stati
 * copiati 1:1 dal codice sorgente per garantire che la validazione
 * client-side anticipi esattamente ciò che il server accetterà o rifiuterà,
 * evitando submit che il backend rifiuterebbe comunque (422) o falsi negativi
 * lato client più permissivi del server.
 */

// Stessa regex usata in authValidators.js -> passwordRegex
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// Stessa regex usata per nome/cognome (supporta accenti, apostrofi, trattini)
const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'-]+$/;

const passwordSchema = z
  .string()
  .trim()
  .min(1, 'La password è obbligatoria')
  .regex(
    PASSWORD_REGEX,
    'La password deve contenere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale'
  );

export const registerSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, 'Il nome è obbligatorio')
      .min(2, 'Il nome deve avere tra 2 e 100 caratteri')
      .max(100, 'Il nome deve avere tra 2 e 100 caratteri')
      .regex(NAME_REGEX, 'Il nome contiene caratteri non validi'),

    cognome: z
      .string()
      .trim()
      .min(1, 'Il cognome è obbligatorio')
      .min(2, 'Il cognome deve avere tra 2 e 100 caratteri')
      .max(100, 'Il cognome deve avere tra 2 e 100 caratteri')
      .regex(NAME_REGEX, 'Il cognome contiene caratteri non validi'),

    eta: z.coerce
      .number({ message: "L'età è obbligatoria" })
      .int("L'età deve essere un numero intero tra 14 e 99")
      .min(ETA_MIN, `L'età minima è ${ETA_MIN} anni`)
      .max(ETA_MAX, `L'età massima è ${ETA_MAX} anni`),

    email: z
      .string()
      .trim()
      .min(1, "L'email è obbligatoria")
      .email('Formato email non valido')
      .max(255, "L'email non può superare i 255 caratteri"),

    password: passwordSchema,

    confermaPassword: z.string().trim().min(1, 'Conferma la password'),

    classe: z.enum(CLASSI, {
      message: `La classe deve essere una di: ${CLASSI.join(', ')}`,
    }),
  })
  .refine((data) => data.password === data.confermaPassword, {
    message: 'Le password non coincidono',
    path: ['confermaPassword'],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'email è obbligatoria")
    .email('Formato email non valido'),
  password: z.string().trim().min(1, 'La password è obbligatoria'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'email è obbligatoria")
    .email('Formato email non valido'),
});

export const resetPasswordSchema = z
  .object({
    nuovaPassword: passwordSchema,
    confermaPassword: z.string().trim().min(1, 'Conferma la password'),
  })
  .refine((data) => data.nuovaPassword === data.confermaPassword, {
    message: 'Le password non coincidono',
    path: ['confermaPassword'],
  });

export const changeEmailSchema = z.object({
  nuovaEmail: z
    .string()
    .trim()
    .min(1, "L'email è obbligatoria")
    .email('Formato email non valido')
    .max(255, "L'email non può superare i 255 caratteri"),
});

export const updateRoleSchema = z.object({
  ruolo: z.enum(['studente', 'insegnante'], {
    message: 'Ruolo non valido',
  }),
});
