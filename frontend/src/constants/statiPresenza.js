/**
 * Registro degli STATI DI PRESENZA (lato frontend).
 *
 * Rispecchia `backend/src/constants/statiPresenza.js`. La verità resta il
 * backend (che valida lo `stato` come STRING contro il proprio registro): qui
 * teniamo le costanti per riferirci ai codici senza stringhe magiche più la
 * mappa presentazionale del tono del Badge. Le etichette leggibili sono risolte
 * via i18n (`presenze.stati.*`).
 */

export const STATI_PRESENZA = Object.freeze({
  PRESENTE: 'presente',
  ASSENTE: 'assente',
  ASSENTE_GIUSTIFICATO: 'assente_giustificato',
  RITARDO: 'ritardo',
  USCITA_ANTICIPATA: 'uscita_anticipata',
});

/** Codici in ordine di presentazione (selettori / cicli di stato). */
export const CODICI_PRESENZA = Object.freeze([
  STATI_PRESENZA.PRESENTE,
  STATI_PRESENZA.ASSENTE,
  STATI_PRESENZA.ASSENTE_GIUSTIFICATO,
  STATI_PRESENZA.RITARDO,
  STATI_PRESENZA.USCITA_ANTICIPATA,
]);

export const STATO_PRESENZA_DEFAULT = STATI_PRESENZA.PRESENTE;

/**
 * Tono del Badge per ciascuno stato (neutral | danger | gold | matcha | seal),
 * coerente con la palette usata da compiti/calendario.
 */
export const STATO_PRESENZA_TONE = Object.freeze({
  [STATI_PRESENZA.PRESENTE]: 'matcha',
  [STATI_PRESENZA.ASSENTE]: 'danger',
  [STATI_PRESENZA.ASSENTE_GIUSTIFICATO]: 'gold',
  [STATI_PRESENZA.RITARDO]: 'seal',
  [STATI_PRESENZA.USCITA_ANTICIPATA]: 'neutral',
});

/** Ciclo dello stato al tap sulla pastiglia (presente → assente → giust. → ritardo → uscita → presente). */
export const prossimoStato = (stato) => {
  const i = CODICI_PRESENZA.indexOf(stato);
  if (i === -1) return STATI_PRESENZA.PRESENTE;
  return CODICI_PRESENZA[(i + 1) % CODICI_PRESENZA.length];
};
