import { z } from 'zod';
import { TIPI_ATTIVITA_COMPITO, STATI_COMPITO } from '../constants/domain';

/**
 * Schemi Zod per i COMPITI, localizzati. Rispecchiano
 * `backend/src/validators/compitiValidators.js`.
 */

const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v));

// Numero opzionale da <input> (stringa) → number|undefined.
const optionalInt = (t, { min, max, msg }) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === '' || v === undefined || v === null ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= min && v <= max),
      { message: t(msg) }
    );

export const buildCompitoSchema = (t) =>
  z.object({
    titolo: z
      .string()
      .trim()
      .min(2, t('compiti.validation.titoloLength'))
      .max(160, t('compiti.validation.titoloLength')),
    descrizione: optionalTrimmed(),
    tipoAttivita: z.enum(TIPI_ATTIVITA_COMPITO, { message: t('compiti.validation.tipo') }),
    dataScadenza: z
      .string()
      .trim()
      .min(1, t('compiti.validation.scadenzaRequired')),
    tempoLimiteMinuti: optionalInt(t, { min: 1, max: 1440, msg: 'compiti.validation.tempoLimite' }),
    punteggioMassimo: optionalInt(t, { min: 1, max: 1000, msg: 'compiti.validation.punteggioMassimo' }),
    stato: z.enum(STATI_COMPITO, { message: t('compiti.validation.stato') }),
    // Parametri attività (facoltativi, dipendono dal tipo).
    alfabeto: optionalTrimmed(),
    livelloJLPT: optionalTrimmed(),
    numeroDomande: optionalInt(t, { min: 1, max: 200, msg: 'compiti.validation.numeroDomande' }),
  });

export const buildValutaSchema = (t) =>
  z.object({
    punteggioOttenuto: optionalInt(t, { min: 0, max: 1000, msg: 'compiti.validation.punteggio' }),
    feedback: optionalTrimmed(),
  });

export const buildConsegnaSchema = (t) =>
  z.object({
    punteggioOttenuto: optionalInt(t, { min: 0, max: 1000, msg: 'compiti.validation.punteggio' }),
    tempoImpiegatoSecondi: optionalInt(t, {
      min: 0,
      max: 86400,
      msg: 'compiti.validation.tempoImpiegato',
    }),
  });
