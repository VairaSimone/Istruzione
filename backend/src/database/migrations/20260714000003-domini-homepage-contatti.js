'use strict';

const { DataTypes } = require('sequelize');

/**
 * DOMINI PERSONALIZZATI + HOMEPAGE PUBBLICA + RICHIESTE DI CONTATTO.
 *
 * Consente a ogni scuola di essere raggiunta da un proprio dominio, su cui la
 * stessa piattaforma mostra una homepage pubblica (personalizzabile dalla
 * scuola) con un form di contatto/informazioni/iscrizione.
 *
 * Nuove tabelle:
 *   - `domini_scuola`      → domini (host) che risolvono il tenant PRIMA del
 *                            login. Colonna `dominio` UNIQUE; `verificato` fa da
 *                            gate di sicurezza (fail-closed).
 *   - `richieste_contatto` → lead inviati dal form della homepage pubblica da
 *                            visitatori NON autenticati, legati alla scuola.
 *
 * La HOMEPAGE non richiede migrazione: è una nuova sezione del blob JSON
 * `scuole.impostazioni` (cfr. constants/impostazioniScuola.js). Coerente con il
 * resto delle impostazioni, aggiungerla non tocca lo schema del DB.
 *
 * Nessuna colonna ENUM: `tipo` e `stato` di `richieste_contatto` sono STRING
 * validate a livello applicativo contro `constants/tipiRichiestaContatto.js`.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 1. Domini personalizzati ──
    await queryInterface.createTable('domini_scuola', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      dominio: {
        type: DataTypes.STRING(253),
        allowNull: false,
      },
      verificato: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      principale: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      note: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      verificato_il: {
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

    await queryInterface.addIndex('domini_scuola', ['dominio'], {
      name: 'domini_scuola_dominio',
      unique: true,
    });
    await queryInterface.addIndex('domini_scuola', ['scuola_id'], { name: 'domini_scuola_scuola_id' });
    await queryInterface.addIndex('domini_scuola', ['dominio', 'verificato'], {
      name: 'domini_scuola_dominio_verificato',
    });

    // ── 2. Richieste di contatto (lead della homepage pubblica) ──
    await queryInterface.createTable('richieste_contatto', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'informazioni',
      },
      stato: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'nuova',
      },
      nome: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      telefono: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      messaggio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      gestita_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      note_interne: {
        type: DataTypes.TEXT,
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

    await queryInterface.addIndex('richieste_contatto', ['scuola_id'], {
      name: 'richieste_contatto_scuola_id',
    });
    await queryInterface.addIndex('richieste_contatto', ['stato'], {
      name: 'richieste_contatto_stato',
    });
    await queryInterface.addIndex('richieste_contatto', ['scuola_id', 'stato', 'created_at'], {
      name: 'richieste_contatto_scuola_stato_data',
    });
    await queryInterface.addIndex('richieste_contatto', ['gestita_da'], {
      name: 'richieste_contatto_gestita_da',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('richieste_contatto');
    await queryInterface.dropTable('domini_scuola');
    // La sezione `homepage` del blob JSON non richiede rollback: chiavi
    // sconosciute vengono ignorate in lettura dallo schema delle impostazioni.
  },
};
