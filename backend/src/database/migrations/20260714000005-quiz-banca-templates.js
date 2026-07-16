'use strict';

const { DataTypes } = require('sequelize');

/**
 * Motore quiz `banca` — SRS generico per le BANCHE DATI di piattaforma.
 *
 * Nuova tabella `progressi_banca`, gemella di `progressi_kana`/`progressi_kanji`
 * ma UNICA per tutte le banche (webdev, inglese-verbi, chimica, geografia,
 * matematica-simboli, e future):
 *   - un record per coppia utente/voce, con punteggio 0-5 (default 3);
 *   - `banca_codice` (informativo) per statistiche/filtri per banca;
 *   - `voce_id` è la chiave della voce, GLOBALMENTE univoca tra le banche;
 *   - unique composito (utente_id, voce_id) → usato anche dall'upsert;
 *   - cancellazione a cascata con l'utente.
 *
 * Estensione additiva: non tocca kana/kanji/domande né altre tabelle. I quiz
 * "da template banca" non hanno righe in `domande_quiz`: le domande le genera il
 * motore a partire dai dizionari statici (`constants/bancaData`).
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    await queryInterface.createTable('progressi_banca', {
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
      banca_codice: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      voce_id: {
        type: DataTypes.STRING(128),
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

    await queryInterface.addIndex('progressi_banca', ['utente_id', 'voce_id'], {
      name: 'progressi_banca_utente_voce',
      unique: true,
    });
    await queryInterface.addIndex('progressi_banca', ['utente_id'], {
      name: 'progressi_banca_utente_id',
    });
    await queryInterface.addIndex('progressi_banca', ['utente_id', 'banca_codice'], {
      name: 'progressi_banca_utente_banca',
    });
    await queryInterface.addIndex('progressi_banca', ['utente_id', 'punteggio'], {
      name: 'progressi_banca_utente_punteggio',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('progressi_banca');
  },
};
