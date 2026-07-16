'use strict';

const { DataTypes } = require('sequelize');

/**
 * CONSENSI LEGALI E RICHIESTA DI CANCELLAZIONE (GDPR).
 *
 * Nuove colonne su `utenti`:
 *   - `accettazione_termini_at`   (DATE)      → istante di accettazione dei
 *                                               Termini/Privacy alla registrazione;
 *   - `versione_termini`          (STRING 20) → versione del documento accettato
 *                                               (prova del consenso, art. 7 GDPR);
 *   - `consenso_email_at`         (DATE)      → istante in cui l'utente ha
 *                                               acconsentito al recapito email;
 *   - `versione_consenso_email`   (STRING 20) → versione dell'informativa email;
 *   - `cancellazione_richiesta_at`(DATE)      → istante della richiesta di
 *                                               cancellazione dell'account. Dopo
 *                                               il periodo di grazia (cfr.
 *                                               constants/retention) lo scheduler
 *                                               elimina l'account in via definitiva.
 *
 * Tutte nullable: i record esistenti restano validi (nessun backfill). Un indice
 * su `cancellazione_richiesta_at` rende efficiente la scansione periodica di
 * retention (solo le righe con richiesta pendente).
 */

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.addColumn('utenti', 'accettazione_termini_at', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('utenti', 'versione_termini', {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('utenti', 'consenso_email_at', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('utenti', 'versione_consenso_email', {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('utenti', 'cancellazione_richiesta_at', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addIndex('utenti', ['cancellazione_richiesta_at'], {
      name: 'utenti_cancellazione_richiesta',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.removeIndex('utenti', 'utenti_cancellazione_richiesta');
    await queryInterface.removeColumn('utenti', 'cancellazione_richiesta_at');
    await queryInterface.removeColumn('utenti', 'versione_consenso_email');
    await queryInterface.removeColumn('utenti', 'consenso_email_at');
    await queryInterface.removeColumn('utenti', 'versione_termini');
    await queryInterface.removeColumn('utenti', 'accettazione_termini_at');
  },
};
