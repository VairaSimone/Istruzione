import { z } from 'zod';

/**
 * Schemi di validazione Zod per le SCUOLE, localizzati (funzioni che ricevono
 * `t`). Rispecchiano le regole di `backend/src/validators/scuolaValidators.js`.
 *
 * Le impostazioni sono un oggetto JSON libero: nel form vengono editate come
 * testo JSON e qui validate come JSON valido rappresentante un oggetto (non
 * array, non primitivo). Il testo vuoto equivale a "nessuna modifica"/oggetto
 * vuoto ed è consentito.
 */

const DIMENSIONE_MAX_IMPOSTAZIONI = 20000; // coerente col backend (~20KB)

/**
 * Campo testuale che deve contenere un oggetto JSON valido (o essere vuoto).
 * Dopo il parse espone l'oggetto in `impostazioni` (o undefined se vuoto).
 */
const impostazioniTextSchema = (t) =>
  z
    .string()
    .trim()
    .max(DIMENSIONE_MAX_IMPOSTAZIONI, t('scuole.validation.impostazioniMax'))
    .optional()
    .transform((v) => (v === undefined || v === '' ? '' : v))
    .superRefine((value, ctx) => {
      if (value === '') return;
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('scuole.validation.impostazioniJson') });
        return;
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('scuole.validation.impostazioniObject') });
      }
    });

const nomeSchema = (t) =>
  z
    .string()
    .trim()
    .min(2, t('scuole.validation.nomeLength'))
    .max(160, t('scuole.validation.nomeLength'));

/** Creazione/modifica scuola: nome + impostazioni (testo JSON). */
export const buildScuolaSchema = (t) =>
  z.object({
    nome: nomeSchema(t),
    impostazioniText: impostazioniTextSchema(t),
  });

/**
 * Converte il testo del campo impostazioni nell'oggetto da inviare al backend.
 * Ritorna `undefined` se vuoto (nessuna modifica), altrimenti l'oggetto parsato.
 */
export const parseImpostazioni = (impostazioniText) => {
  if (!impostazioniText || impostazioniText.trim() === '') return undefined;
  return JSON.parse(impostazioniText);
};
