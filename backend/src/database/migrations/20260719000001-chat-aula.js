'use strict';

const { DataTypes } = require('sequelize');

/**
 * CHAT DI GRUPPO D'AULA.
 *
 * Nuove tabelle:
 *   - `messaggi_chat`  → feed condiviso di un'aula (tutti i membri, studenti e
 *                        insegnanti, scrivono e leggono lo stesso flusso), con
 *                        allegato opzionale (FK a `file_caricati`) ed
 *                        eliminazione soft;
 *   - `chat_letture`   → marcatore di lettura per (membro × aula):
 *                        `ultimo_letto_il` determina i non letti senza tenere
 *                        una riga di lettura per messaggio.
 *
 * Distinta dalla messaggistica esistente (`messaggi` / `messaggio_destinatari`,
 * casella di posta docente→studente): qui il modello è un gruppo, non un inbox.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Feed dei messaggi della chat d'aula.
    await queryInterface.createTable('messaggi_chat', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      classe_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'classi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      mittente_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      corpo: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      file_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'file_caricati', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      eliminato: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      eliminato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      eliminato_il: {
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

    await queryInterface.addIndex('messaggi_chat', ['classe_id', 'created_at'], {
      name: 'chat_msg_classe_created',
    });
    await queryInterface.addIndex('messaggi_chat', ['mittente_id'], { name: 'chat_msg_mittente' });
    await queryInterface.addIndex('messaggi_chat', ['scuola_id'], { name: 'chat_msg_scuola_id' });
    await queryInterface.addIndex('messaggi_chat', ['file_id'], { name: 'chat_msg_file' });

    // 2. Marcatori di lettura per membro.
    await queryInterface.createTable('chat_letture', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      classe_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'classi', key: 'id' },
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
      ultimo_letto_il: {
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

    await queryInterface.addIndex('chat_letture', ['classe_id', 'utente_id'], {
      name: 'chat_letture_classe_utente',
      unique: true,
    });
    await queryInterface.addIndex('chat_letture', ['utente_id'], { name: 'chat_letture_utente' });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('chat_letture');
    await queryInterface.dropTable('messaggi_chat');
  },
};
