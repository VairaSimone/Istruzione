import { z } from 'zod';
import {
  STATI_QUIZ,
  TIPI_DOMANDA,
  QUIZ_TITOLO_MIN,
  QUIZ_TITOLO_MAX,
  QUIZ_MATERIA_MAX,
  QUIZ_DESCRIZIONE_MAX,
  DIMENSIONE_ROUND_MIN,
  DIMENSIONE_ROUND_MAX,
  DOMANDA_TESTO_MAX,
  DOMANDA_RISPOSTA_MAX,
  OPZIONE_TESTO_MAX,
  OPZIONI_MIN,
  OPZIONI_MAX,
} from '../constants/quizGestione';

/**
 * Schemi Zod dei QUIZ DELLE SCUOLE, localizzati (funzioni che ricevono `t`).
 * Rispecchiano `backend/src/validators/quizGestioneValidators.js` e la
 * validazione semantica di `quizGestioneService`: stessi enum, stessi limiti,
 * stesse regole («esattamente una opzione corretta», «vero/falso ha 2 opzioni»,
 * «la risposta breve non ha opzioni»).
 *
 * La verità resta il backend: questi schemi servono solo a evitare un round
 * trip inutile e a mostrare l'errore accanto al campo giusto.
 */

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

const optionalHttpUrl = (t) =>
  optionalTrimmed().pipe(
    z
      .string()
      .max(URL_MAX, t('corsi.validation.urlMax'))
      .regex(HTTP_URL_REGEX, t('corsi.validation.url'))
      .optional()
  );

/**
 * Valore sentinella del selettore di template: indica un quiz personalizzato
 * (nessun template). Non si usa la stringa vuota perché il componente <Select>
 * inietta di default una option disabilitata con `value=""`.
 */
export const TEMPLATE_NESSUNO = 'personalizzato';

/**
 * Metadati di un quiz (creazione e modifica).
 *
 * `templateCodice` è presente solo in creazione: il backend lo tratta come
 * immutabile e risponde `QUIZ_TEMPLATE_IMMUTABILE` a chi tenta di cambiarlo.
 * `codiciTemplate` arriva dal catalogo `GET /quiz/templates`, così il selettore
 * resta allineato al registro del backend senza duplicarne l'elenco.
 */
export const buildQuizSchema = (
  t,
  { requireScuola = false, codiciTemplate = [] } = {}
) =>
  z.object({
    titolo: z
      .string()
      .trim()
      .min(QUIZ_TITOLO_MIN, t('quizGestione.validation.titoloLength'))
      .max(QUIZ_TITOLO_MAX, t('quizGestione.validation.titoloLength')),

    descrizione: optionalTrimmed().pipe(
      z.string().max(QUIZ_DESCRIZIONE_MAX, t('corsi.validation.descrizioneMax')).optional()
    ),

    materia: optionalTrimmed().pipe(
      z.string().max(QUIZ_MATERIA_MAX, t('quizGestione.validation.materiaMax')).optional()
    ),

    templateCodice: optionalTrimmed().pipe(
      z
        .union([
          z.literal(TEMPLATE_NESSUNO),
          z.enum(
            codiciTemplate.length > 0 ? codiciTemplate : [TEMPLATE_NESSUNO],
            { message: t('quizGestione.validation.template') }
          ),
        ])
        .optional()
    ),

    stato: z.enum(STATI_QUIZ, { message: t('corsi.validation.stato') }),

    dimensioneRound: optionalInt(t, {
      min: DIMENSIONE_ROUND_MIN,
      max: DIMENSIONE_ROUND_MAX,
      msg: 'quizGestione.validation.dimensioneRound',
    }),

    mescolaDomande: z.boolean().optional(),

    // Scuola del quiz: obbligatoria solo per l'admin in creazione.
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

/**
 * Domanda di un quiz personalizzato.
 *
 * Il form gestisce sempre un vettore di opzioni; le regole che dipendono dal
 * tipo si applicano in `superRefine`, perché richiedono di vedere l'insieme:
 *   - risposta_breve → nessuna opzione, `rispostaCorretta` obbligatoria;
 *   - vero_falso     → esattamente 2 opzioni, una sola corretta;
 *   - scelta_multipla→ da 2 a 6 opzioni, una sola corretta.
 */
export const buildDomandaSchema = (t) =>
  z
    .object({
      tipo: z.enum(TIPI_DOMANDA, { message: t('quizGestione.validation.tipoDomanda') }),

      testo: z
        .string()
        .trim()
        .min(1, t('quizGestione.validation.testoRequired'))
        .max(DOMANDA_TESTO_MAX, t('quizGestione.validation.testoMax')),

      spiegazione: optionalTrimmed().pipe(
        z.string().max(DOMANDA_TESTO_MAX, t('quizGestione.validation.testoMax')).optional()
      ),

      mediaUrl: optionalHttpUrl(t),

      // — risposta_breve —
      rispostaCorretta: optionalTrimmed().pipe(
        z
          .string()
          .max(DOMANDA_RISPOSTA_MAX, t('quizGestione.validation.rispostaMax'))
          .optional()
      ),

      /**
       * Le alternative si scrivono su una riga sola, separate da `;`: un
       * <input> per alternativa complicherebbe il form senza guadagno. La
       * trasformazione in array (con de-duplica) avviene qui.
       */
      risposteAlternative: optionalTrimmed().pipe(z.string().optional()),

      caseSensitive: z.boolean().optional(),

      // — scelta_multipla | vero_falso —
      opzioni: z
        .array(
          z.object({
            testo: z
              .string()
              .trim()
              .min(1, t('quizGestione.validation.opzioneTestoRequired'))
              .max(OPZIONE_TESTO_MAX, t('quizGestione.validation.opzioneTestoMax')),
            corretta: z.boolean().optional(),
          })
        )
        .optional(),

      ordine: optionalInt(t, { min: 0, max: 100000, msg: 'corsi.validation.ordine' }),
    })
    .superRefine((valori, ctx) => {
      const opzioni = valori.opzioni ?? [];

      if (valori.tipo === 'risposta_breve') {
        if (!valori.rispostaCorretta) {
          ctx.addIssue({
            code: 'custom',
            path: ['rispostaCorretta'],
            message: t('quizGestione.validation.rispostaRequired'),
          });
        }
        return;
      }

      const minimo = valori.tipo === 'vero_falso' ? 2 : OPZIONI_MIN;
      const massimo = valori.tipo === 'vero_falso' ? 2 : OPZIONI_MAX;

      if (opzioni.length < minimo || opzioni.length > massimo) {
        ctx.addIssue({
          code: 'custom',
          path: ['opzioni'],
          message:
            valori.tipo === 'vero_falso'
              ? t('quizGestione.validation.opzioniVeroFalso')
              : t('quizGestione.validation.opzioniNumero', {
                  min: OPZIONI_MIN,
                  max: OPZIONI_MAX,
                }),
        });
        return;
      }

      if (opzioni.filter((o) => o.corretta === true).length !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['opzioni'],
          message: t('quizGestione.validation.opzioneUnicaCorretta'),
        });
      }
    });

/**
 * Converte i valori del form nel payload atteso dal backend.
 * Le chiavi non pertinenti al tipo vengono OMESSE (non messe a null): il
 * backend rifiuta ad esempio le opzioni su una domanda a risposta breve.
 */
export const domandaFormToPayload = (valori) => {
  const base = {
    tipo: valori.tipo,
    testo: valori.testo,
    spiegazione: valori.spiegazione ?? null,
    mediaUrl: valori.mediaUrl ?? null,
    ...(valori.ordine !== undefined ? { ordine: valori.ordine } : {}),
  };

  if (valori.tipo === 'risposta_breve') {
    const alternative = (valori.risposteAlternative ?? '')
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean);

    return {
      ...base,
      rispostaCorretta: valori.rispostaCorretta,
      risposteAlternative: [...new Set(alternative)],
      caseSensitive: Boolean(valori.caseSensitive),
    };
  }

  return {
    ...base,
    opzioni: (valori.opzioni ?? []).map((o, indice) => ({
      testo: o.testo,
      corretta: o.corretta === true,
      ordine: indice,
    })),
  };
};

/** Trasforma una domanda ricevuta dal backend nei valori iniziali del form. */
export const domandaToFormValues = (domanda) => ({
  tipo: domanda?.tipo ?? 'scelta_multipla',
  testo: domanda?.testo ?? '',
  spiegazione: domanda?.spiegazione ?? '',
  mediaUrl: domanda?.mediaUrl ?? '',
  rispostaCorretta: domanda?.rispostaCorretta ?? '',
  risposteAlternative: (domanda?.risposteAlternative ?? []).join('; '),
  caseSensitive: domanda?.caseSensitive ?? false,
  opzioni:
    domanda?.opzioni?.length > 0
      ? domanda.opzioni.map((o) => ({ testo: o.testo, corretta: o.corretta }))
      : [
          { testo: '', corretta: true },
          { testo: '', corretta: false },
        ],
  ordine: domanda?.ordine ?? '',
});
