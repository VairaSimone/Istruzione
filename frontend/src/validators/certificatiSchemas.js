import { z } from 'zod';

/**
 * Schemi Zod per le CERTIFICAZIONI, localizzati. Rispecchiano
 * `backend/src/validators/certificatoValidators.js`.
 *
 * Il rilascio richiede lo studente e ALMENO uno tra il corso e il nome del
 * percorso a testo libero: la regola è verificata con un `superRefine`, così
 * l'insegnante vede l'errore sul campo giusto invece di un 422 generico. Il
 * backend applica comunque le proprie regole.
 */

const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v));

// Data "solo giorno" (YYYY-MM-DD), come emessa da <input type="date">.
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const buildEmettiCertificatoSchema = (t) =>
  z
    .object({
      utenteId: z.string().trim().min(1, t('certificati.validation.studenteRequired')),
      corsoId: optionalTrimmed(),
      nomeCorso: optionalTrimmed().refine(
        (v) => v === undefined || v.length <= 200,
        t('certificati.validation.nomeCorsoLength')
      ),
      esito: optionalTrimmed().refine(
        (v) => v === undefined || v.length <= 120,
        t('certificati.validation.esitoLength')
      ),
      titolo: optionalTrimmed().refine(
        (v) => v === undefined || v.length <= 200,
        t('certificati.validation.titoloLength')
      ),
      dataCompletamento: optionalTrimmed().refine(
        (v) => v === undefined || DATA_REGEX.test(v),
        t('certificati.validation.dataNonValida')
      ),
    })
    .superRefine((valori, ctx) => {
      // Serve un percorso: corso selezionato OPPURE nome libero.
      if (!valori.corsoId && !valori.nomeCorso) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nomeCorso'],
          message: t('certificati.validation.percorsoRequired'),
        });
      }
    });

export const buildRevocaCertificatoSchema = (t) =>
  z.object({
    motivo: optionalTrimmed().refine(
      (v) => v === undefined || v.length <= 255,
      t('certificati.validation.motivoLength')
    ),
  });
