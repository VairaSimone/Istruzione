'use strict';

const { DataTypes } = require('sequelize');

/**
 * Sistema dei COMPITI (assegnazioni).
 *
 * Nuove tabelle:
 *   - `compiti`               → definizione del compito (attività, scadenza,
 *                               tempo limite, punteggio, stato di pubblicazione);
 *   - `compito_assegnazioni`  → destinatario (aula OPPURE singolo studente);
 *   - `compito_consegne`      → consegna/valutazione per studente (creata al
 *                               completamento; feedback per la Fase 4).
 */
const TIPI_ATTIVITA = ['quiz_kana', 'quiz_kanji', 'tracciamento', 'vocabolario'];
const STATI_COMPITO = ['bozza', 'pubblicato', 'archiviato'];
const STATI_CONSEGNA = ['completato', 'valutato'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Compiti.
    await queryInterface.createTable('compiti', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      titolo: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      descrizione: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tipo_attivita: {
        type: DataTypes.ENUM(...TIPI_ATTIVITA),
        allowNull: false,
      },
      configurazione: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      data_scadenza: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      tempo_limite_minuti: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      punteggio_massimo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      stato: {
        type: DataTypes.ENUM(...STATI_COMPITO),
        allowNull: false,
        defaultValue: 'bozza',
      },
      creato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('compiti', ['creato_da'], { name: 'compiti_creato_da' });
    await queryInterface.addIndex('compiti', ['stato'], { name: 'compiti_stato' });
    await queryInterface.addIndex('compiti', ['tipo_attivita'], { name: 'compiti_tipo_attivita' });
    await queryInterface.addIndex('compiti', ['data_scadenza'], { name: 'compiti_data_scadenza' });

    // 2. Assegnazioni (aula o studente).
    await queryInterface.createTable('compito_assegnazioni', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      compito_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'compiti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classe_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'classi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      utente_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      assegnato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('compito_assegnazioni', ['compito_id', 'classe_id'], {
      name: 'compito_assegn_compito_classe',
      unique: true,
    });
    await queryInterface.addIndex('compito_assegnazioni', ['compito_id', 'utente_id'], {
      name: 'compito_assegn_compito_utente',
      unique: true,
    });
    await queryInterface.addIndex('compito_assegnazioni', ['compito_id'], { name: 'compito_assegn_compito' });
    await queryInterface.addIndex('compito_assegnazioni', ['classe_id'], { name: 'compito_assegn_classe' });
    await queryInterface.addIndex('compito_assegnazioni', ['utente_id'], { name: 'compito_assegn_utente' });

    // 3. Consegne.
    await queryInterface.createTable('compito_consegne', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      compito_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'compiti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      utente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stato: {
        type: DataTypes.ENUM(...STATI_CONSEGNA),
        allowNull: false,
        defaultValue: 'completato',
      },
      punteggio_ottenuto: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tempo_impiegato_secondi: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      oltre_tempo_limite: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      in_ritardo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      data_completamento: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      valutato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('compito_consegne', ['compito_id', 'utente_id'], {
      name: 'compito_consegne_compito_utente',
      unique: true,
    });
    await queryInterface.addIndex('compito_consegne', ['compito_id'], { name: 'compito_consegne_compito' });
    await queryInterface.addIndex('compito_consegne', ['utente_id'], { name: 'compito_consegne_utente' });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('compito_consegne');
    await queryInterface.dropTable('compito_assegnazioni');
    await queryInterface.dropTable('compiti');

    // Rimuove i tipi ENUM orfani creati da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_compiti_tipo_attivita";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_compiti_stato";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_compito_consegne_stato";');
    }
  },
};
