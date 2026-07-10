import { z } from 'zod';
import { LIVELLO_MAX } from '../constants/domain';

/**
 * Schemi di validazione Zod per le AULE, localizzati (funzioni che ricevono
 * `t`). Rispecchiano le regole di `backend/src/validators/auleValidators.js`.
 *
 * Il LIVELLO non è più un ENUM (`N5…N1`): è testo libero, perché la piattaforma
 * è generica e ogni scuola nomina i propri livelli («A1», «Base», «Terzo
 * anno»). Qui si valida solo la FORMA; l'appartenenza al vocabolario
 * eventualmente definito dalla scuola è verificata dal backend, che è l'unico a
 * conoscerne il contenuto.
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

export const buildAulaSchema = (t, { requireScuola = false } = {}) =>
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
    livello: optionalString().pipe(
      z.string().max(LIVELLO_MAX, t('aule.validation.livelloMax')).optional()
    ),
    colore: optionalString().pipe(
      z.string().regex(COLORE_REGEX, t('aule.validation.colore')).optional()
    ),
    // Scuola dell'aula: obbligatoria solo quando il form è compilato da un admin
    // (in creazione). Per l'insegnante è la propria scuola, gestita dal backend.
    scuolaId: requireScuola
      ? z.string().trim().min(1, t('validation.scuolaRequired')).uuid(t('validation.scuolaInvalid'))
      : z.string().trim().uuid(t('validation.scuolaInvalid')).optional().or(z.literal('')),
  });

export const buildAddByEmailSchema = (t) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .email(t('validation.emailInvalid')),
  });
