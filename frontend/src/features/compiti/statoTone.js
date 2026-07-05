/**
 * Mappa gli stati dei compiti sui toni del Badge (neutral | danger | gold |
 * matcha | seal), per un uso coerente tra card e pagine di dettaglio.
 */
export const STATO_COMPITO_TONE = {
  bozza: 'gold',
  pubblicato: 'matcha',
  archiviato: 'neutral',
};

export const STATO_STUDENTE_TONE = {
  assegnato: 'gold',
  in_scadenza: 'seal',
  scaduto: 'danger',
  completato: 'matcha',
};
