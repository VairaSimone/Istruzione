'use strict';

/**
 * REGISTRO DEGLI STATI DI PRESENZA.
 *
 * Come gli altri registri della piattaforma (`tipiEvento`, `tipiAttivita`,
 * `funzionalita`) è la FONTE DI VERITÀ unica: da qui derivano la validazione del
 * campo `stato` di una voce di presenza (colonna STRING, NON un ENUM di
 * database) e il catalogo esposto al frontend per popolare i selettori.
 *
 * La scelta di una colonna STRING validata contro il registro permette di
 * aggiungere un nuovo stato (es. "connessione remota") senza alcuna migrazione
 * ALTER TABLE: basta aggiungere una voce qui.
 *
 * `contaComeAssenza` marca gli stati che concorrono al LIMITE DI ASSENZE
 * configurato dalla scuola (`impostazioni.presenze.limiteAssenze`). Le assenze
 * GIUSTIFICATE hanno un flag separato perché la scuola decide, tramite
 * `impostazioni.presenze.conteggioGiustificate`, se includerle o meno nel
 * conteggio: il registro le marca come assenze «giustificate», il servizio
 * applica la politica del tenant.
 *
 * ─────────────────────────────────────────────
 * COME AGGIUNGERE UNO STATO
 * ─────────────────────────────────────────────
 *   1. aggiungere un descrittore al vettore `STATI_PRESENZA`;
 *   2. fine. Nessuna migrazione, nessun ENUM da alterare.
 */

/**
 * @typedef {Object} DescrittoreStatoPresenza
 * @property {string}  codice           valore persistito (stabile)
 * @property {string}  nome             etichetta leggibile (fallback IT)
 * @property {string}  descrizione      cosa rappresenta
 * @property {boolean} contaComeAssenza concorre al limite di assenze
 * @property {boolean} [giustificata]   assenza giustificata (politica a parte)
 * @property {string}  [colore]         colore suggerito per la UI (#RRGGBB)
 */

/** @type {DescrittoreStatoPresenza[]} */
const STATI_PRESENZA = [
  {
    codice: 'presente',
    nome: 'Presente',
    descrizione: "Lo studente è presente alla lezione.",
    contaComeAssenza: false,
    colore: '#16A34A',
  },
  {
    codice: 'assente',
    nome: 'Assente',
    descrizione: 'Assenza non giustificata.',
    contaComeAssenza: true,
    giustificata: false,
    colore: '#DC2626',
  },
  {
    codice: 'assente_giustificato',
    nome: 'Assente giustificato',
    descrizione:
      'Assenza giustificata. Concorre al limite solo se la scuola lo prevede.',
    contaComeAssenza: true,
    giustificata: true,
    colore: '#F59E0B',
  },
  {
    codice: 'ritardo',
    nome: 'In ritardo',
    descrizione: "Ingresso in ritardo: presenza parziale, non un'assenza.",
    contaComeAssenza: false,
    colore: '#0EA5E9',
  },
  {
    codice: 'uscita_anticipata',
    nome: 'Uscita anticipata',
    descrizione: "Uscita prima del termine: presenza parziale, non un'assenza.",
    contaComeAssenza: false,
    colore: '#8B5CF6',
  },
];

/** Mappa codice → descrittore, per lookup O(1). */
const MAPPA_STATI = new Map(STATI_PRESENZA.map((s) => [s.codice, s]));

/** Elenco dei codici validi. */
const CODICI_PRESENZA = STATI_PRESENZA.map((s) => s.codice);

/** Stato di default quando si apre un registro (tutti presenti finché non segnati). */
const STATO_PRESENZA_DEFAULT = 'presente';

/** True se il codice esiste nel registro. */
const esiste = (codice) => MAPPA_STATI.has(codice);

/** Descrittore o `null`. */
const trova = (codice) => MAPPA_STATI.get(codice) || null;

/**
 * True se lo stato conta come assenza AI FINI DEL LIMITE, data la politica della
 * scuola sulle assenze giustificate.
 *
 * @param {string} codice
 * @param {boolean} [conteggioGiustificate] se true, anche le assenze
 *   giustificate concorrono al limite (default: false, non concorrono)
 */
const contaPerLimite = (codice, conteggioGiustificate = false) => {
  const d = MAPPA_STATI.get(codice);
  if (!d || !d.contaComeAssenza) return false;
  if (d.giustificata && !conteggioGiustificate) return false;
  return true;
};

/** Catalogo esponibile al frontend (per i selettori dello stato). */
const catalogoPubblico = () =>
  STATI_PRESENZA.map((s) => ({
    codice: s.codice,
    nome: s.nome,
    descrizione: s.descrizione,
    contaComeAssenza: Boolean(s.contaComeAssenza),
    giustificata: Boolean(s.giustificata),
    colore: s.colore || null,
  }));

module.exports = {
  STATI_PRESENZA,
  CODICI_PRESENZA,
  STATO_PRESENZA_DEFAULT,
  esiste,
  trova,
  contaPerLimite,
  catalogoPubblico,
};
