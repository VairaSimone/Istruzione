/**
 * Registro dei TIPI DI EVENTO del calendario (lato frontend).
 *
 * Rispecchia `backend/src/constants/tipiEvento.js`. La verità resta il backend
 * (che valida il `tipo` come STRING contro il proprio registro): qui teniamo le
 * costanti per riferirci ai codici senza stringhe magiche, più le mappe
 * puramente presentazionali (tono del Badge, colore di default, piattaforme di
 * videochiamata). Le etichette leggibili sono risolte via i18n
 * (`calendario.tipi.*`, `calendario.piattaforme.*`).
 */

export const TIPI_EVENTO = Object.freeze({
  LEZIONE: 'lezione',
  VIDEOCHIAMATA: 'videochiamata',
  RIUNIONE: 'riunione',
  VERIFICA: 'verifica',
  EVENTO: 'evento',
  ALTRO: 'altro',
});

/** Codici in ordine di presentazione (selettori). */
export const CODICI_EVENTO = Object.freeze([
  TIPI_EVENTO.LEZIONE,
  TIPI_EVENTO.VIDEOCHIAMATA,
  TIPI_EVENTO.RIUNIONE,
  TIPI_EVENTO.VERIFICA,
  TIPI_EVENTO.EVENTO,
  TIPI_EVENTO.ALTRO,
]);

export const TIPO_EVENTO_DEFAULT = TIPI_EVENTO.LEZIONE;

/**
 * Tono del Badge per ciascun tipo di evento (neutral | danger | gold | matcha |
 * seal), coerente con la mappa dei compiti (`features/compiti/statoTone.js`).
 */
export const TIPO_EVENTO_TONE = Object.freeze({
  [TIPI_EVENTO.LEZIONE]: 'matcha',
  [TIPI_EVENTO.VIDEOCHIAMATA]: 'seal',
  [TIPI_EVENTO.RIUNIONE]: 'gold',
  [TIPI_EVENTO.VERIFICA]: 'danger',
  [TIPI_EVENTO.EVENTO]: 'matcha',
  [TIPI_EVENTO.ALTRO]: 'neutral',
});

/**
 * Colore di default (#RRGGBB) di ciascun tipo, usato per le pastiglie del
 * calendario quando l'evento non ne definisce uno proprio. Allineato ai default
 * del backend.
 */
export const COLORI_EVENTO = Object.freeze({
  [TIPI_EVENTO.LEZIONE]: '#4F46E5',
  [TIPI_EVENTO.VIDEOCHIAMATA]: '#0EA5E9',
  [TIPI_EVENTO.RIUNIONE]: '#F59E0B',
  [TIPI_EVENTO.VERIFICA]: '#DC2626',
  [TIPI_EVENTO.EVENTO]: '#16A34A',
  [TIPI_EVENTO.ALTRO]: '#6B7280',
});

/** Colore delle scadenze dei compiti nel calendario (voce derivata, non evento). */
export const COLORE_SCADENZA_COMPITO = '#B91C1C';

/**
 * Colore effettivo di una voce del feed: colore esplicito dell'evento, oppure
 * default del tipo; le scadenze dei compiti hanno un colore dedicato.
 */
export const coloreVoce = (voce) => {
  if (!voce) return COLORI_EVENTO[TIPI_EVENTO.ALTRO];
  if (voce.tipoVoce === 'compito') return COLORE_SCADENZA_COMPITO;
  return voce.colore || COLORI_EVENTO[voce.tipo] || COLORI_EVENTO[TIPI_EVENTO.ALTRO];
};

/** Piattaforme di videochiamata riconosciute (per icona/etichetta). */
export const PIATTAFORME_VIDEOCHIAMATA = Object.freeze([
  'zoom',
  'meet',
  'teams',
  'webex',
  'jitsi',
  'altro',
]);
