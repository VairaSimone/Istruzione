'use strict';

const { DataTypes } = require('sequelize');

/**
 * REGISTRO PRESENZE — appelli e voci.
 *
 * Nuove tabelle:
 *   - `registri_presenza` → intestazione dell'appello di un'aula in un giorno
 *                           (data, argomento, note). Unico per (aula, data);
 *   - `voci_presenza`     → presenza del singolo studente in un appello, con
 *                           stato e nota (speculare a `compito_consegne`).
 *
 * Nessuna colonna ENUM: `stato` è STRING validata a livello applicativo contro
 * `constants/statiPresenza.js`. Aggiungere uno stato non richiederà quindi
 * alcuna ALTER TABLE.
 *
 * Il LIMITE DI ASSENZE e l'abilitazione della sezione NON hanno colonne: vivono
 * nel blob JSON `scuole.impostazioni` (`presenze.limiteAssenze`) e nel registro
 * delle funzionalità (`presenze`), quindi non richiedono migrazioni.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Intestazione dell'appello.
    await queryInterface.createTable('registri_presenza', {
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
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      data: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      argomento: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex('registri_presenza', ['classe_id', 'data'], {
      name: 'registri_pres_classe_data',
      unique: true,
    });
    await queryInterface.addIndex('registri_presenza', ['scuola_id'], { name: 'registri_pres_scuola' });
    await queryInterface.addIndex('registri_presenza', ['creato_da'], { name: 'registri_pres_creato_da' });

    // 2. Voci per-studente.
    await queryInterface.createTable('voci_presenza', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      registro_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'registri_presenza', key: 'id' },
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
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'presente',
      },
      nota: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
      registrato_da: {
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

    await queryInterface.addIndex('voci_presenza', ['registro_id', 'utente_id'], {
      name: 'voci_pres_registro_utente',
      unique: true,
    });
    await queryInterface.addIndex('voci_presenza', ['registro_id'], { name: 'voci_pres_registro' });
    await queryInterface.addIndex('voci_presenza', ['utente_id', 'stato'], { name: 'voci_pres_utente_stato' });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('voci_presenza');
    await queryInterface.dropTable('registri_presenza');
    // Nessun tipo ENUM da rimuovere: la colonna `stato` è STRING.
  },
};
