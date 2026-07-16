'use strict';

const { DataTypes } = require('sequelize');

/**
 * `pagamenti.stripe_checkout_session_id` diventa NULLABLE.
 *
 * ─────────────────────────────────────────────
 * IL PROBLEMA
 * ─────────────────────────────────────────────
 * Il checkout scriveva in quest'ordine:
 *
 *     1. crea la SESSIONE su Stripe   ← link di pagamento già valido
 *     2. crea l'ORDINE su MySQL
 *
 * Tra 1 e 2 esiste una finestra in cui la sessione è PAGABILE e l'ordine non
 * esiste. Se il passo 2 fallisce (deadlock, connessione persa, unique
 * violato…), lo studente può comunque pagare: i soldi arrivano sul conto della
 * scuola, il webhook cerca l'ordine dalla sessione, non lo trova e logga
 *
 *     [PAGAMENTI] Webhook checkout.session.completed: nessun ordine per sessione cs_...
 *
 * Risultato: incasso avvenuto, studente NON iscritto, nessun record contabile.
 * Un errore invisibile finché non se ne lamenta lo studente.
 *
 * ─────────────────────────────────────────────
 * IL PERCHÉ DI QUESTA MIGRAZIONE
 * ─────────────────────────────────────────────
 * L'ordine va invertito: prima l'ORDINE `in_attesa`, poi la sessione, poi il
 * collegamento. Ma l'ordine nasce quando la sessione non esiste ancora, e la
 * colonna era NOT NULL: senza questa modifica l'inversione è impossibile.
 *
 * L'INDICE UNIVOCO RESTA. In MySQL (come nello standard SQL) un vincolo UNIQUE
 * ammette più righe NULL: l'idempotenza del webhook — che è tutta appesa
 * all'univocità di `stripe_checkout_session_id` — continua a valere identica
 * per le sessioni reali. Cambia solo che un ordine può esistere per un istante
 * senza sessione, che è esattamente ciò che serve.
 *
 * Il `down` ripristina il NOT NULL: prima elimina gli eventuali ordini senza
 * sessione (sono per definizione checkout mai arrivati su Stripe, quindi non
 * hanno alcun valore contabile), altrimenti il `changeColumn` fallirebbe.
 */

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.changeColumn('pagamenti', 'stripe_checkout_session_id', {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async ({ context: queryInterface }) => {
    // Ordini mai giunti alla creazione della sessione: nessun incasso possibile.
    await queryInterface.sequelize.query(
      "DELETE FROM pagamenti WHERE stripe_checkout_session_id IS NULL"
    );

    await queryInterface.changeColumn('pagamenti', 'stripe_checkout_session_id', {
      type: DataTypes.STRING(255),
      allowNull: false,
    });
  },
};
