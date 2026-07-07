import { z } from 'zod';
import { LIVELLI_JLPT, STATI_CORSO } from '../constants/domain';

/**
 * Schemi Zod per i CORSI (videolezioni on-demand), localizzati (funzioni che
 * ricevono `t`). Rispecchiano `backend/src/validators/corsiValidators.js`:
 * stessi limiti di lunghezza, stessi enum e URL http(s) con protocollo
 * obbligatorio (il progetto memorizza SOLO riferimenti esterni, non file).
 */

// Regex URL http/https con protocollo obbligatorio (coerente con OPZIONI_URL
// del validator Express: { protocols: ['http','https'], require_protocol: true }).
const HTTP_URL_REGEX = /^https?:\/\/.+/i;
const URL_MAX = 2048;

// Stringa opzionale: vuota → undefined (campi facoltativi dei form).
const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v));

// Intero opzionale da <input> (stringa) → number|undefined, con range.
const optionalInt = (t, { min, max, msg }) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === '' || v === undefined || v === null ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= min && v <= max), {
      message: t(msg),
    });

// URL http(s) opzionale.
const optionalHttpUrl = (t) =>
  optionalTrimmed().pipe(
    z
      .string()
      .max(URL_MAX, t('corsi.validation.urlMax'))
      .regex(HTTP_URL_REGEX, t('corsi.validation.url'))
      .optional()
  );

// Override tri-stato della policy di download del capitolo:
//   'eredita' → null lato backend; 'si'/'no' → forza true/false.
// Si usano valori sentinella (non stringa vuota) per non collidere con il
// placeholder disabilitato che il componente <Select> inietta di default.
const scaricabileOverride = () => z.enum(['eredita', 'si', 'no']).optional();

export const buildCorsoSchema = (t, { requireScuola = false } = {}) =>
  z.object({
    titolo: z
      .string()
      .trim()
      .min(2, t('corsi.validation.titoloLength'))
      .max(160, t('corsi.validation.titoloLength')),
    descrizione: optionalTrimmed().pipe(
      z.string().max(10000, t('corsi.validation.descrizioneMax')).optional()
    ),
    copertinaUrl: optionalHttpUrl(t),
    livelloJLPT: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .pipe(z.enum(LIVELLI_JLPT, { message: t('corsi.validation.livello') }).optional()),
    stato: z.enum(STATI_CORSO, { message: t('corsi.validation.stato') }),
    videoScaricabile: z.boolean().optional(),
    // Scuola del corso: obbligatoria solo quando compila un admin (in creazione).
    // Per l'insegnante è la propria scuola, gestita dal backend.
    scuolaId: requireScuola
      ? z
          .string()
          .trim()
          .min(1, t('validation.scuolaRequired'))
          .uuid(t('validation.scuolaInvalid'))
      : z
          .string()
          .trim()
          .uuid(t('validation.scuolaInvalid'))
          .optional()
          .or(z.literal('')),
  });

export const buildCapitoloSchema = (t) =>
  z.object({
    titolo: z
      .string()
      .trim()
      .min(2, t('corsi.validation.capitoloTitoloLength'))
      .max(160, t('corsi.validation.capitoloTitoloLength')),
    descrizione: optionalTrimmed().pipe(
      z.string().max(10000, t('corsi.validation.descrizioneMax')).optional()
    ),
    videoUrl: optionalHttpUrl(t),
    videoDurataSecondi: optionalInt(t, {
      min: 0,
      max: 86400,
      msg: 'corsi.validation.durata',
    }),
    scaricabile: scaricabileOverride(),
    ordine: optionalInt(t, { min: 0, max: 100000, msg: 'corsi.validation.ordine' }),
  });

export const buildDocumentoSchema = (t) =>
  z.object({
    titolo: z
      .string()
      .trim()
      .min(1, t('corsi.validation.documentoTitoloLength'))
      .max(200, t('corsi.validation.documentoTitoloLength')),
    url: z
      .string()
      .trim()
      .min(1, t('corsi.validation.urlRequired'))
      .max(URL_MAX, t('corsi.validation.urlMax'))
      .regex(HTTP_URL_REGEX, t('corsi.validation.url')),
  });
