'use strict';

const { DataTypes } = require('sequelize');

/**
 * Gamification — Badge/Obiettivi + contatori XP non-quiz.
 *
 * Modifiche alla tabella `utenti` (contatori per i badge):
 *   - `quiz_completati`  INTEGER NOT NULL DEFAULT 0 → quiz submit riusciti;
 *   - `tratti_validati`  INTEGER NOT NULL DEFAULT 0 → tratti validati su canvas;
 *   - `righe_sbloccate`  INTEGER NOT NULL DEFAULT 0 → contatore MONOTÒNO delle
 *     righe base di kana portate al punteggio SRS massimo (XP una-tantum).
 *
 * Nuova tabella `badge_utente` (badge sbloccati):
 *   - una riga per coppia (utente, badge), con `created_at` = data di sblocco;
 *   - unique composito (utente_id, badge_code) → idempotenza dello sblocco;
 *   - cancellazione a cascata con l'utente.
 *
 * Solo i codici stabili dei badge sono persistiti: nome/descrizione localizzati
 * vivono nel frontend.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Contatori di gamification sulla tabella utenti.
    await queryInterface.addColumn('utenti', 'quiz_completati', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('utenti', 'tratti_validati', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('utenti', 'righe_sbloccate', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // 2. Tabella dei badge sbloccati.
    await queryInterface.createTable('badge_utente', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      utente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      badge_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('badge_utente', ['utente_id', 'badge_code'], {
      name: 'badge_utente_utente_codice',
      unique: true,
    });
    await queryInterface.addIndex('badge_utente', ['utente_id'], {
      name: 'badge_utente_utente_id',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('badge_utente');

    await queryInterface.removeColumn('utenti', 'righe_sbloccate');
    await queryInterface.removeColumn('utenti', 'tratti_validati');
    await queryInterface.removeColumn('utenti', 'quiz_completati');
  },
};
