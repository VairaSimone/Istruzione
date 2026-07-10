import { z } from 'zod';
import { STATI_COMPITO } from '../constants/domain';
import { CODICI_ATTIVITA, TIPI_ATTIVITA } from '../constants/tipiAttivita';

/**
 * Schemi Zod per i COMPITI, localizzati. Rispecchiano
 * `backend/src/validators/compitiValidators.js`.
 *
 * Il TIPO DI ATTIVITÀ non è più un ENUM legato al giapponese
 * (`quiz_kana | quiz_kanji | tracciamento | vocabolario`) ma un codice del
 * registro `constants/tipiAttivita.js`. I parametri dell'attività vivono nel
 * campo JSON `configurazione`, la cui forma dipende dal tipo:
 *
 *   quiz              → `quizId`  (obbligatorio, imposto dal backend)
 *   corso             → `corsoId` (obbligatorio, imposto dal backend)
 *   altri             → configurazione libera
 *
 * Il riferimento obbligatorio è validato QUI con un `superRefine`, così
 * l'insegnante vede l'errore sul campo giusto invece di un 422 generico.
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
  z
    .object({
      titolo: z
        .string()
        .trim()
        .min(2, t('compiti.validation.titoloLength'))
        .max(160, t('compiti.validation.titoloLength')),
      descrizione: optionalTrimmed(),
      tipoAttivita: z.enum(CODICI_ATTIVITA, { message: t('compiti.validation.tipo') }),
      dataScadenza: z
        .string()
        .trim()
        .min(1, t('compiti.validation.scadenzaRequired')),
      tempoLimiteMinuti: optionalInt(t, {
        min: 1,
        max: 1440,
        msg: 'compiti.validation.tempoLimite',
      }),
      punteggioMassimo: optionalInt(t, {
        min: 1,
        max: 1000,
        msg: 'compiti.validation.punteggioMassimo',
      }),
      stato: z.enum(STATI_COMPITO, { message: t('compiti.validation.stato') }),

      // ── Parametri dell'attività (confluiscono in `configurazione`) ──
      quizId: optionalTrimmed(),
      corsoId: optionalTrimmed(),
      numeroDomande: optionalInt(t, {
        min: 1,
        max: 200,
        msg: 'compiti.validation.numeroDomande',
      }),
      istruzioni: optionalTrimmed(),
    })
    .superRefine((valori, ctx) => {
      if (valori.tipoAttivita === TIPI_ATTIVITA.QUIZ && !valori.quizId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quizId'],
          message: t('compiti.validation.quizRichiesto'),
        });
      }
      if (valori.tipoAttivita === TIPI_ATTIVITA.CORSO && !valori.corsoId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['corsoId'],
          message: t('compiti.validation.corsoRichiesto'),
        });
      }
    });

/**
 * Costruisce l'oggetto `configurazione` dai campi condizionali del form.
 * Ritorna `null` (e non `{}`) quando non c'è nulla da salvare: il backend
 * distingue le due cose.
 */
export const buildConfigurazione = (valori) => {
  const cfg = {};

  if (valori.tipoAttivita === TIPI_ATTIVITA.QUIZ) {
    if (valori.quizId) cfg.quizId = valori.quizId;
    if (valori.numeroDomande) cfg.numeroDomande = valori.numeroDomande;
  }
  if (valori.tipoAttivita === TIPI_ATTIVITA.CORSO && valori.corsoId) {
    cfg.corsoId = valori.corsoId;
  }
  if (valori.istruzioni) cfg.istruzioni = valori.istruzioni;

  return Object.keys(cfg).length ? cfg : null;
};

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
