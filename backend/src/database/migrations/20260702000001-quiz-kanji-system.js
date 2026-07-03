'use strict';

const { DataTypes } = require('sequelize');

/**
 * Sistema Quiz Kanji — SRS per singolo kanji.
 *
 * Nuova tabella `progressi_kanji`, gemella di `progressi_kana`:
 *   - un record per coppia utente/kanji, con punteggio 0-5 (default 3);
 *   - `livello_jlpt` (ENUM N5..N1) per filtraggio/selezione per livello;
 *   - contatori di errore (`tentativi`, `errori`, `errori_tratti`) come per i kana;
 *   - unique composito (utente_id, kanji) → usato anche dall'upsert;
 *   - cancellazione a cascata con l'utente.
 *
 * Non modifica nulla del sistema Kana: è una tabella aggiuntiva (estensione,
 * non sostituzione).
 */
const LIVELLI_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    await queryInterface.createTable('progressi_kanji', {
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
      kanji: {
        type: DataTypes.STRING(8),
        allowNull: false,
      },
      livello_jlpt: {
        type: DataTypes.ENUM(...LIVELLI_JLPT),
        allowNull: false,
      },
      punteggio: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      tentativi: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errori: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errori_tratti: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('progressi_kanji', ['utente_id', 'kanji'], {
      name: 'progressi_kanji_utente_kanji',
      unique: true,
    });
    await queryInterface.addIndex('progressi_kanji', ['utente_id'], {
      name: 'progressi_kanji_utente_id',
    });
    await queryInterface.addIndex('progressi_kanji', ['utente_id', 'punteggio'], {
      name: 'progressi_kanji_utente_punteggio',
    });
    await queryInterface.addIndex('progressi_kanji', ['utente_id', 'errori'], {
      name: 'progressi_kanji_utente_errori',
    });
    await queryInterface.addIndex('progressi_kanji', ['utente_id', 'livello_jlpt'], {
      name: 'progressi_kanji_utente_livello',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('progressi_kanji');

    // Rimuove il tipo ENUM orfano creato da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_progressi_kanji_livello_jlpt";');
    }
  },
};
