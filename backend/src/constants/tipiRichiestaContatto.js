'use strict';

/**
 * REGISTRO DEI TIPI e degli STATI di una RICHIESTA DI CONTATTO.
 *
 * Coerente con gli altri registri della piattaforma (`tipiEvento`,
 * `tipiAttivita`, `tipiNotifica`): fonte di verità unica da cui derivano la
 * validazione dei campi `tipo` e `stato` (colonne STRING, NON ENUM) e il
 * catalogo esposto al frontend. Aggiungere un tipo/stato non richiede alcuna
 * migrazione ALTER TABLE.
 *
 * Le richieste arrivano dalla HOMEPAGE PUBBLICA di una scuola (form di contatto)
 * e servono a: chiedere informazioni, avviare un'iscrizione, o inviare una
 * comunicazione generica. Nella piattaforma, INVITE-ONLY, la richiesta di
 * «iscrizione» NON crea un account: è un lead che lo staff lavora inviando poi
 * un invito. Nessuna registrazione pubblica viene mai aperta da qui.
 */

/**
 * @typedef {Object} DescrittoreTipoContatto
 * @property {string} codice       valore persistito (stabile)
 * @property {string} nome         etichetta leggibile (fallback IT)
 * @property {string} descrizione  cosa rappresenta
 */

/** @type {DescrittoreTipoContatto[]} */
const TIPI_RICHIESTA = [
  {
    codice: 'informazioni',
    nome: 'Richiesta di informazioni',
    descrizione: 'Il visitatore chiede informazioni sui corsi o sulla scuola.',
  },
  {
    codice: 'iscrizione',
    nome: 'Richiesta di iscrizione',
    descrizione: "Il visitatore desidera iscriversi: lo staff seguirà con un invito.",
  },
  {
    codice: 'contatto',
    nome: 'Contatto generico',
    descrizione: 'Comunicazione libera indirizzata alla scuola.',
  },
];

const MAPPA_TIPI = new Map(TIPI_RICHIESTA.map((t) => [t.codice, t]));
const CODICI_TIPO = TIPI_RICHIESTA.map((t) => t.codice);
const TIPO_DEFAULT = 'informazioni';

/**
 * @typedef {Object} DescrittoreStatoContatto
 * @property {string} codice
 * @property {string} nome
 * @property {string} descrizione
 */

/** @type {DescrittoreStatoContatto[]} */
const STATI_RICHIESTA = [
  { codice: 'nuova', nome: 'Nuova', descrizione: 'Richiesta appena ricevuta, da prendere in carico.' },
  { codice: 'in_gestione', nome: 'In gestione', descrizione: 'Un membro dello staff la sta seguendo.' },
  { codice: 'chiusa', nome: 'Chiusa', descrizione: 'Richiesta evasa.' },
  { codice: 'spam', nome: 'Spam', descrizione: 'Richiesta indesiderata o non pertinente.' },
];

const MAPPA_STATI = new Map(STATI_RICHIESTA.map((s) => [s.codice, s]));
const CODICI_STATO = STATI_RICHIESTA.map((s) => s.codice);
const STATO_DEFAULT = 'nuova';

const tipoEsiste = (codice) => MAPPA_TIPI.has(codice);
const statoEsiste = (codice) => MAPPA_STATI.has(codice);

/** Catalogo per i selettori del frontend. */
const catalogoTipi = () =>
  TIPI_RICHIESTA.map((t) => ({ codice: t.codice, nome: t.nome, descrizione: t.descrizione }));

const catalogoStati = () =>
  STATI_RICHIESTA.map((s) => ({ codice: s.codice, nome: s.nome, descrizione: s.descrizione }));

module.exports = {
  TIPI_RICHIESTA,
  CODICI_TIPO,
  TIPO_DEFAULT,
  STATI_RICHIESTA,
  CODICI_STATO,
  STATO_DEFAULT,
  tipoEsiste,
  statoEsiste,
  catalogoTipi,
  catalogoStati,
};
