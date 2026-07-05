import { z } from 'zod';

/** Schemi Zod per la MESSAGGISTICA, localizzati. */

const MAX_CORPO = 5000;

export const buildMessaggioSchema = (t) =>
  z.object({
    oggetto: z
      .string()
      .trim()
      .max(160, t('messaggi.validation.oggettoMax'))
      .optional()
      .transform((v) => (v === '' ? undefined : v)),
    corpo: z
      .string()
      .trim()
      .min(1, t('messaggi.validation.corpoRequired'))
      .max(MAX_CORPO, t('messaggi.validation.corpoMax')),
    consentiRisposte: z.boolean().optional(),
  });

export const buildRispostaSchema = (t) =>
  z.object({
    corpo: z
      .string()
      .trim()
      .min(1, t('messaggi.validation.corpoRequired'))
      .max(MAX_CORPO, t('messaggi.validation.corpoMax')),
  });
