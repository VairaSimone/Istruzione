import { z } from 'zod';

/**
 * Schemi di validazione Zod per le SCUOLE, localizzati (funzioni che ricevono
 * `t`). Rispecchiano `backend/src/validators/scuolaValidators.js`.
 *
 * Le impostazioni non sono più un blob JSON arbitrario: seguono lo schema
 * dichiarativo del backend. Questo form — riservato all'ADMIN, che crea le
 * scuole — resta volutamente essenziale (nome, slug, stato) e lascia il JSON
 * come sportello di servizio per le impostazioni avanzate. La configurazione
 * quotidiana si fa nella pagina «Impostazioni scuola», con un form generato
 * dallo schema, non scrivendo JSON a mano.
 */

const DIMENSIONE_MAX_IMPOSTAZIONI = 40000; // coerente col backend (~40KB)

// Slug: minuscole, cifre e trattini singoli, senza trattini ai bordi.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('scuole.validation.impostazioniJson'),
        });
        return;
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('scuole.validation.impostazioniObject'),
        });
      }
    });

const nomeSchema = (t) =>
  z
    .string()
    .trim()
    .min(2, t('scuole.validation.nomeLength'))
    .max(160, t('scuole.validation.nomeLength'));

/**
 * Slug facoltativo: se lasciato vuoto il backend lo deriva dal nome,
 * aggiungendo un suffisso in caso di collisione.
 */
const slugSchema = (t) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .pipe(
      z
        .string()
        .min(2, t('scuole.validation.slugLength'))
        .max(80, t('scuole.validation.slugLength'))
        .regex(SLUG_REGEX, t('scuole.validation.slugFormato'))
        .optional()
    );

/** Creazione/modifica scuola. */
export const buildScuolaSchema = (t) =>
  z.object({
    nome: nomeSchema(t),
    slug: slugSchema(t),
    attiva: z.boolean().optional(),
    predefinita: z.boolean().optional(),
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

/**
 * Genera uno slug leggibile a partire dal nome, per l'anteprima nel form.
 * Il backend applica la stessa trasformazione (`Scuola.slugifica`): mostrarla
 * in anticipo evita all'admin la sorpresa di uno slug che non si aspettava.
 */
export const slugificaAnteprima = (nome) => {
  if (typeof nome !== 'string') return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
};
