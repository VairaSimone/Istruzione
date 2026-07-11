import { z } from 'zod';
import { CODICI_EVENTO, TIPI_EVENTO } from '../constants/tipiEvento';

/**
 * Schemi Zod per gli EVENTI del calendario, localizzati. Rispecchiano
 * `backend/src/validators/calendarioValidators.js`.
 *
 * Nota: la coerenza dell'intervallo (`dataFine >= dataInizio`) e — per gli
 * eventi di tipo `videochiamata` — la presenza del link sono validate qui con
 * un `superRefine`, così l'insegnante vede l'errore sul campo giusto invece di
 * un 422 generico. Il backend applica comunque le proprie regole.
 */

const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v));

const isUrlValido = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const buildEventoSchema = (t) =>
  z
    .object({
      titolo: z
        .string()
        .trim()
        .min(2, t('calendario.validation.titoloLength'))
        .max(160, t('calendario.validation.titoloLength')),
      tipo: z.enum(CODICI_EVENTO, { message: t('calendario.validation.tipo') }),
      dataInizio: z.string().trim().min(1, t('calendario.validation.inizioRequired')),
      dataFine: optionalTrimmed(),
      tuttoIlGiorno: z.boolean().optional().default(false),
      luogo: optionalTrimmed(),
      linkVideochiamata: optionalTrimmed(),
      descrizione: optionalTrimmed(),
      colore: optionalTrimmed(),
    })
    .superRefine((valori, ctx) => {
      // Intervallo coerente.
      if (valori.dataFine && valori.dataInizio) {
        if (new Date(valori.dataFine).getTime() < new Date(valori.dataInizio).getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataFine'],
            message: t('calendario.validation.intervallo'),
          });
        }
      }
      // Link: se presente deve essere un URL http/https valido.
      if (valori.linkVideochiamata && !isUrlValido(valori.linkVideochiamata)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['linkVideochiamata'],
          message: t('calendario.validation.linkNonValido'),
        });
      }
      // Per una videochiamata il link è atteso (coerenza d'uso, non vincolo DB).
      if (valori.tipo === TIPI_EVENTO.VIDEOCHIAMATA && !valori.linkVideochiamata) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['linkVideochiamata'],
          message: t('calendario.validation.linkRichiesto'),
        });
      }
    });
