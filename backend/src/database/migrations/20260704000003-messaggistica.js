'use strict';

const { DataTypes } = require('sequelize');

/**
 * Sistema di MESSAGGISTICA e FEEDBACK.
 *
 * Nuove tabelle:
 *   - `messaggi`               → messaggi, incoraggiamenti, feedback su compiti,
 *                                note private, con threading (auto-referenza);
 *   - `messaggio_destinatari`  → recapito + stato di lettura per destinatario
 *                                (fan-out per i messaggi d'aula; conteggio
 *                                notifiche = COUNT dei non letti).
 */
const TIPI_MESSAGGIO = ['messaggio', 'incoraggiamento', 'feedback', 'nota_privata'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Messaggi.
    await queryInterface.createTable('messaggi', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      mittente_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tipo: {
        type: DataTypes.ENUM(...TIPI_MESSAGGIO),
        allowNull: false,
        defaultValue: 'messaggio',
      },
      oggetto: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      corpo: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      classe_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'classi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      compito_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'compiti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nota_su_utente_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Auto-referenza aggiunta dopo la creazione della tabella (vincolo sotto).
      messaggio_padre_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      consenti_risposte: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    // Vincolo di auto-referenza per il threading (SET NULL sulle risposte se il
    // padre viene eliminato).
    await queryInterface.addConstraint('messaggi', {
      fields: ['messaggio_padre_id'],
      type: 'foreign key',
      name: 'messaggi_padre_fk',
      references: { table: 'messaggi', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('messaggi', ['mittente_id'], { name: 'messaggi_mittente' });
    await queryInterface.addIndex('messaggi', ['classe_id'], { name: 'messaggi_classe' });
    await queryInterface.addIndex('messaggi', ['compito_id'], { name: 'messaggi_compito' });
    await queryInterface.addIndex('messaggi', ['messaggio_padre_id'], { name: 'messaggi_padre' });
    await queryInterface.addIndex('messaggi', ['tipo'], { name: 'messaggi_tipo' });

    // 2. Destinatari.
    await queryInterface.createTable('messaggio_destinatari', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      messaggio_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'messaggi', key: 'id' },
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
      letto: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      letto_il: {
        type: DataTypes.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('messaggio_destinatari', ['messaggio_id', 'utente_id'], {
      name: 'messaggio_dest_messaggio_utente',
      unique: true,
    });
    await queryInterface.addIndex('messaggio_destinatari', ['utente_id', 'letto'], {
      name: 'messaggio_dest_utente_letto',
    });
    await queryInterface.addIndex('messaggio_destinatari', ['messaggio_id'], {
      name: 'messaggio_dest_messaggio',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('messaggio_destinatari');
    await queryInterface.removeConstraint('messaggi', 'messaggi_padre_fk').catch(() => {});
    await queryInterface.dropTable('messaggi');

    // Rimuove i tipi ENUM orfani creati da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_messaggi_tipo";');
    }
  },
};
