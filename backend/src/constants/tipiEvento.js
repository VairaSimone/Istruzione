'use strict';

/**
 * REGISTRO DEI TIPI DI EVENTO DEL CALENDARIO.
 *
 * Come per gli altri registri della piattaforma (`tipiAttivita`, `tipiNotifica`,
 * `funzionalita`) è la FONTE DI VERITÀ unica: da qui derivano la validazione
 * del campo `tipo` (colonna STRING, NON un ENUM di database) e il catalogo
 * esposto al frontend per popolare i selettori.
 *
 * La scelta di una colonna STRING validata contro il registro — coerente con la
 * generalizzazione della piattaforma — permette di aggiungere un nuovo tipo di
 * evento senza alcuna migrazione ALTER TABLE: basta aggiungere una voce qui.
 *
 * ─────────────────────────────────────────────
 * COME AGGIUNGERE UN TIPO DI EVENTO
 * ─────────────────────────────────────────────
 *   1. aggiungere un descrittore al vettore `TIPI_EVENTO`;
 *   2. fine. Nessuna migrazione, nessun ENUM da alterare.
 */

/**
 * @typedef {Object} DescrittoreTipoEvento
 * @property {string} codice      valore persistito (stabile)
 * @property {string} nome        etichetta leggibile (fallback IT)
 * @property {string} descrizione cosa rappresenta
 * @property {string} [colore]    colore di default suggerito per la UI (#RRGGBB)
 */

/** @type {DescrittoreTipoEvento[]} */
const TIPI_EVENTO = [
  {
    codice: 'lezione',
    nome: 'Lezione',
    descrizione: 'Lezione in aula o a distanza.',
    colore: '#4F46E5',
  },
  {
    codice: 'videochiamata',
    nome: 'Videochiamata',
    descrizione: 'Incontro online tramite link (Zoom, Meet, Teams…).',
    colore: '#0EA5E9',
  },
  {
    codice: 'riunione',
    nome: 'Riunione',
    descrizione: 'Riunione tra insegnanti, con i genitori o con gli studenti.',
    colore: '#F59E0B',
  },
  {
    codice: 'verifica',
    nome: 'Verifica',
    descrizione: 'Prova, test o esame in calendario.',
    colore: '#DC2626',
  },
  {
    codice: 'evento',
    nome: 'Evento',
    descrizione: 'Evento generico della scuola (gita, open day, festività…).',
    colore: '#16A34A',
  },
  {
    codice: 'altro',
    nome: 'Altro',
    descrizione: 'Qualsiasi altra voce di calendario.',
    colore: '#6B7280',
  },
];

/** Mappa codice → descrittore, per lookup O(1). */
const MAPPA_TIPI_EVENTO = new Map(TIPI_EVENTO.map((t) => [t.codice, t]));

/** Elenco dei codici validi. */
const CODICI_EVENTO = TIPI_EVENTO.map((t) => t.codice);

/** Tipo di default quando il client non lo specifica. */
const TIPO_EVENTO_DEFAULT = 'lezione';

/** True se il codice esiste nel registro. */
const esiste = (codice) => MAPPA_TIPI_EVENTO.has(codice);

/** Descrittore o `null`. */
const trova = (codice) => MAPPA_TIPI_EVENTO.get(codice) || null;

/** Catalogo esponibile al frontend (per i selettori del tipo evento). */
const catalogoPubblico = () =>
  TIPI_EVENTO.map((t) => ({
    codice: t.codice,
    nome: t.nome,
    descrizione: t.descrizione,
    colore: t.colore || null,
  }));

// ─────────────────────────────────────────────
// PIATTAFORME DI VIDEOCHIAMATA
// Il link è testo libero (STRING): non vincoliamo l'utente a un fornitore. La
// piattaforma viene RILEVATA dall'host del link, così il frontend può mostrare
// l'icona giusta senza chiedere un campo aggiuntivo. Se non riconosciuta resta
// 'altro'.
// ─────────────────────────────────────────────
const PIATTAFORME_VIDEOCHIAMATA = ['zoom', 'meet', 'teams', 'webex', 'jitsi', 'altro'];

/**
 * Rileva la piattaforma di videochiamata a partire dal link.
 *
 * @param {?string} link
 * @returns {?string} una tra `PIATTAFORME_VIDEOCHIAMATA`, oppure null se il
 *   link è assente/non parsabile.
 */
const rilevaPiattaforma = (link) => {
  if (!link || typeof link !== 'string') return null;

  let host;
  try {
    host = new URL(link.trim()).hostname.toLowerCase();
  } catch {
    return 'altro';
  }

  if (host.includes('zoom.')) return 'zoom';
  if (host.includes('meet.google.') || host === 'meet.google.com') return 'meet';
  if (host.includes('teams.microsoft.') || host.includes('teams.live.')) return 'teams';
  if (host.includes('webex.')) return 'webex';
  if (host.includes('jit.si') || host.includes('meet.jit.si')) return 'jitsi';
  return 'altro';
};

module.exports = {
  TIPI_EVENTO,
  CODICI_EVENTO,
  TIPO_EVENTO_DEFAULT,
  PIATTAFORME_VIDEOCHIAMATA,
  esiste,
  trova,
  catalogoPubblico,
  rilevaPiattaforma,
};
