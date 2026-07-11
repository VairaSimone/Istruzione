'use strict';

const { DataTypes } = require('sequelize');

/**
 * CALENDARIO — eventi e destinatari.
 *
 * Nuove tabelle:
 *   - `eventi_calendario`  → voce di calendario (lezione, riunione, verifica,
 *                            videochiamata con link Zoom/Meet/Teams…), con
 *                            intervallo temporale e recapito multi-destinatario;
 *   - `evento_destinatari` → destinatario dell'evento (aula OPPURE singolo
 *                            studente), speculare a `compito_assegnazioni`.
 *
 * Le scadenze dei compiti NON sono duplicate: il feed del calendario le deriva
 * a runtime dai compiti pubblicati (cfr. `calendarioService`).
 *
 * Nessuna colonna ENUM: `tipo` e `piattaforma_videochiamata` sono STRING
 * validate a livello applicativo contro `constants/tipiEvento.js`. Aggiungere un
 * tipo di evento non richiederà quindi alcuna ALTER TABLE.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Eventi di calendario.
    await queryInterface.createTable('eventi_calendario', {
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
      tipo: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'lezione',
      },
      data_inizio: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      data_fine: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tutto_il_giorno: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      luogo: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      link_videochiamata: {
        type: DataTypes.STRING(2048),
        allowNull: true,
      },
      piattaforma_videochiamata: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      colore: {
        type: DataTypes.STRING(7),
        allowNull: true,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('eventi_calendario', ['creato_da'], { name: 'eventi_cal_creato_da' });
    await queryInterface.addIndex('eventi_calendario', ['scuola_id'], { name: 'eventi_cal_scuola_id' });
    await queryInterface.addIndex('eventi_calendario', ['tipo'], { name: 'eventi_cal_tipo' });
    await queryInterface.addIndex('eventi_calendario', ['data_inizio'], { name: 'eventi_cal_data_inizio' });

    // 2. Destinatari (aula o studente).
    await queryInterface.createTable('evento_destinatari', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      evento_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'eventi_calendario', key: 'id' },
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
      aggiunto_da: {
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

    await queryInterface.addIndex('evento_destinatari', ['evento_id', 'classe_id'], {
      name: 'evento_dest_evento_classe',
      unique: true,
    });
    await queryInterface.addIndex('evento_destinatari', ['evento_id', 'utente_id'], {
      name: 'evento_dest_evento_utente',
      unique: true,
    });
    await queryInterface.addIndex('evento_destinatari', ['evento_id'], { name: 'evento_dest_evento' });
    await queryInterface.addIndex('evento_destinatari', ['classe_id'], { name: 'evento_dest_classe' });
    await queryInterface.addIndex('evento_destinatari', ['utente_id'], { name: 'evento_dest_utente' });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('evento_destinatari');
    await queryInterface.dropTable('eventi_calendario');
    // Nessun tipo ENUM da rimuovere: le colonne discriminanti sono STRING.
  },
};
