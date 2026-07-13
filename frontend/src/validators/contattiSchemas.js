import { z } from 'zod';

/**
 * Schemi di validazione Zod per le RICHIESTE DI CONTATTO e i DOMINI,
 * localizzati (funzioni che ricevono `t`). Rispecchiano
 * `backend/src/validators/contattiValidators.js` e `dominiValidators.js`:
 * la validazione client è per la UX, quella autorevole resta lato server.
 */

/** Tipi di richiesta noti (allineati a constants/tipiRichiestaContatto del backend). */
export const TIPI_RICHIESTA = ['informazioni', 'iscrizione', 'contatto'];

/** Stati di lavorazione di un lead (allineati al backend). */
export const STATI_RICHIESTA = ['nuova', 'in_gestione', 'chiusa', 'spam'];

/**
 * Form pubblico della homepage.
 *
 * `tipiAmmessi` limita il selettore a ciò che la scuola ha abilitato
 * (`homepage.form.tipiRichiesta`). `website` è l'HONEYPOT: resta nascosto e deve
 * restare vuoto; un valore non blocca il client (lo scarta il backend), ma qui
 * lo teniamo fuori dai dati validati.
 */
export const buildContattoSchema = (t, tipiAmmessi = TIPI_RICHIESTA) => {
  const tipi = tipiAmmessi.length ? tipiAmmessi : TIPI_RICHIESTA;
  return z.object({
    tipo: z.enum(tipi).catch(tipi[0]),
    nome: z
      .string()
      .trim()
      .min(2, t('contatti.form.validation.nome'))
      .max(160, t('contatti.form.validation.nome')),
    email: z
      .string()
      .trim()
      .min(1, t('contatti.form.validation.emailObbligatoria'))
      .email(t('contatti.form.validation.email'))
      .max(255, t('contatti.form.validation.email')),
    telefono: z
      .string()
      .trim()
      .max(40, t('contatti.form.validation.telefono'))
      .optional()
      .or(z.literal('')),
    messaggio: z
      .string()
      .trim()
      .max(4000, t('contatti.form.validation.messaggio'))
      .optional()
      .or(z.literal('')),
    // Honeypot: non mostrato agli utenti. Nessun vincolo bloccante.
    website: z.string().max(200).optional().or(z.literal('')),
  });
};

// Dominio: host valido (almeno due etichette). Coerente con utils/dominio del backend.
const DOMINIO_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** Normalizza un host incollato (schema/porta/percorso rimossi, minuscolo). */
export const normalizzaDominioInput = (grezzo) => {
  if (typeof grezzo !== 'string') return '';
  let host = grezzo.trim().toLowerCase();
  if (host === '') return '';
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname;
    } catch {
      return host;
    }
  } else {
    host = host.split('/')[0].split('?')[0].split('@').pop();
  }
  return host.split(':')[0].replace(/\.+$/, '');
};

/** Form di aggiunta dominio. */
export const buildDominioSchema = (t) =>
  z.object({
    dominio: z
      .string()
      .trim()
      .min(3, t('domini.validation.dominio'))
      .max(253, t('domini.validation.dominio'))
      .transform(normalizzaDominioInput)
      .refine((v) => DOMINIO_REGEX.test(v), t('domini.validation.dominio')),
    note: z.string().trim().max(255, t('domini.validation.note')).optional().or(z.literal('')),
  });
