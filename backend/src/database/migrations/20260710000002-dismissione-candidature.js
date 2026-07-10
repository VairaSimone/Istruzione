'use strict';

const { DataTypes } = require('sequelize');

/**
 * DISMISSIONE DEL FLUSSO "CANDIDATURA INSEGNANTE".
 *
 * L'accesso alla piattaforma è ESCLUSIVAMENTE su invito: è la scuola che invita
 * un insegnante, non l'insegnante che si candida. Il flusso inverso (candidatura
 * → approvazione/rifiuto da parte di un admin) era già di fatto morto:
 *
 *   - `registraInsegnanteDaInvito` crea gli account direttamente in stato
 *     'attivo', quindi nessun percorso di codice produceva più utenti
 *     'in_attesa';
 *   - le route `/api/admin/teacher-requests` non erano nemmeno montate in
 *     `app.js` (e importavano un validator inesistente: sarebbero andate in
 *     crash al mount);
 *   - le pagine frontend di candidatura/approvazione non erano instradate.
 *
 * Con questa migrazione cade l'ultimo residuo a livello di schema: la colonna
 * `utenti.nota_candidatura`, che conteneva il messaggio di presentazione allegato
 * alla candidatura e che nessun codice legge o scrive più.
 *
 * ── Cosa NON viene toccato, e perché ──
 *
 * L'ENUM `utenti.stato` conserva i valori 'in_attesa' e 'rifiutato'. Non sono
 * più prodotti da alcun flusso, ma restano:
 *   - come GATE DIFENSIVO di login (cfr. `authService`: un account in uno di
 *     questi stati non può autenticarsi, né via password né via Google);
 *   - per non invalidare eventuali righe storiche già presenti in produzione.
 * Restringere l'ENUM richiederebbe di decidere cosa fare di quelle righe, e il
 * guadagno sarebbe nullo: uno stato in più non costa nulla e chiude il login.
 *
 * ── Reversibilità ──
 *
 * `down` ricrea la colonna con lo stesso tipo/nullabilità dell'originale. Il
 * CONTENUTO delle note NON è recuperabile: era testo libero e viene eliminato
 * con la colonna. È una perdita accettabile e voluta — la funzionalità che lo
 * produceva non esiste più — ma è bene che sia scritta qui a chiare lettere.
 */

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.removeColumn('utenti', 'nota_candidatura');
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.addColumn('utenti', 'nota_candidatura', {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  },
};
