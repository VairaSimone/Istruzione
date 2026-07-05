import { z } from 'zod';
import { LIVELLI_JLPT } from '../constants/domain';

/**
 * Schemi di validazione Zod per le AULE, localizzati (funzioni che ricevono
 * `t`). Rispecchiano le regole di `backend/src/validators/auleValidators.js`.
 */

const ANNO_REGEX = /^\d{4}\/\d{4}$/;
const COLORE_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Trasforma stringa vuota → undefined (campi opzionali dei form).
const optionalString = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v));

export const buildAulaSchema = (t) =>
  z.object({
    nome: z
      .string()
      .trim()
      .min(2, t('aule.validation.nomeLength'))
      .max(120, t('aule.validation.nomeLength')),
    descrizione: optionalString().pipe(
      z.string().max(5000, t('aule.validation.descrizioneMax')).optional()
    ),
    annoScolastico: optionalString().pipe(
      z.string().regex(ANNO_REGEX, t('aule.validation.annoFormato')).optional()
    ),
    livelloJLPT: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .pipe(z.enum(LIVELLI_JLPT, { message: t('aule.validation.livello') }).optional()),
    colore: optionalString().pipe(
      z.string().regex(COLORE_REGEX, t('aule.validation.colore')).optional()
    ),
  });

export const buildAddByEmailSchema = (t) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .email(t('validation.emailInvalid')),
  });
