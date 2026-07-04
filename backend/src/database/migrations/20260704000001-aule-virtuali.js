'use strict';

const { DataTypes } = require('sequelize');

/**
 * Aule virtuali (gestione classi).
 *
 * Nuove tabelle:
 *   - `classi`        → l'aula virtuale (nome, descrizione, anno, livello,
 *                       colore/icona, creatore, archiviazione soft);
 *   - `classe_utenti` → ponte molti-a-molti aula↔utente con ruolo nell'aula
 *                       (insegnante/studente) e vincolo di unicità.
 *
 * Modifica a `inviti`:
 *   - aggiunge `classe_id` (nullable, FK → classi, ON DELETE SET NULL): quando
 *     valorizzato, al completamento dell'invito lo studente viene iscritto
 *     automaticamente all'aula indicata.
 */
const LIVELLI_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'];
const RUOLI_CLASSE = ['insegnante', 'studente'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // 1. Tabella aule.
    await queryInterface.createTable('classi', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      nome: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      descrizione: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      anno_scolastico: {
        type: DataTypes.STRING(9),
        allowNull: true,
      },
      livello_jlpt: {
        type: DataTypes.ENUM(...LIVELLI_JLPT),
        allowNull: true,
      },
      colore: {
        type: DataTypes.STRING(7),
        allowNull: true,
      },
      icona: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      creata_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      archiviata: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex('classi', ['creata_da'], { name: 'classi_creata_da' });
    await queryInterface.addIndex('classi', ['livello_jlpt'], { name: 'classi_livello_jlpt' });
    await queryInterface.addIndex('classi', ['anno_scolastico'], { name: 'classi_anno_scolastico' });
    await queryInterface.addIndex('classi', ['archiviata'], { name: 'classi_archiviata' });

    // 2. Tabella ponte membership.
    await queryInterface.createTable('classe_utenti', {
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
      ruolo_nella_classe: {
        type: DataTypes.ENUM(...RUOLI_CLASSE),
        allowNull: false,
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

    await queryInterface.addIndex('classe_utenti', ['classe_id', 'utente_id'], {
      name: 'classe_utenti_classe_utente',
      unique: true,
    });
    await queryInterface.addIndex('classe_utenti', ['classe_id', 'ruolo_nella_classe'], {
      name: 'classe_utenti_classe_ruolo',
    });
    await queryInterface.addIndex('classe_utenti', ['utente_id'], {
      name: 'classe_utenti_utente',
    });

    // 3. Collega gli inviti all'aula (iscrizione automatica al completamento).
    await queryInterface.addColumn('inviti', 'classe_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'classi', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('inviti', ['classe_id'], { name: 'inviti_classe_id' });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.removeIndex('inviti', 'inviti_classe_id');
    await queryInterface.removeColumn('inviti', 'classe_id');

    await queryInterface.dropTable('classe_utenti');
    await queryInterface.dropTable('classi');

    // Rimuove i tipi ENUM orfani creati da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_classi_livello_jlpt";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_classe_utenti_ruolo_nella_classe";');
    }
  },
};
