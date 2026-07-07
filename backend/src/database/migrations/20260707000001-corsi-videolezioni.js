'use strict';

const { DataTypes } = require('sequelize');

/**
 * Videolezioni on-demand (corsi della scuola).
 *
 * Nuove tabelle:
 *   - `corsi`               → il corso (titolo, descrizione, copertina, livello,
 *                             stato di pubblicazione, policy di download video),
 *                             legato alla scuola (tenant) e all'autore;
 *   - `capitoli`            → i capitoli del corso, ognuno con un video
 *                             (facoltativo, via URL), descrizione, override
 *                             download e ordinamento;
 *   - `documenti_capitolo`  → i documenti allegati a un capitolo (via URL);
 *   - `corso_aule`          → ponte molti-a-molti corso↔aula: rende un corso
 *                             disponibile a un'aula (con vincolo di unicità).
 *
 * ISOLAMENTO TRA SCUOLE: `corsi.scuola_id` (FK → scuole, ON DELETE CASCADE)
 * timbra il tenant del corso; il collegamento a un'aula (corso_aule) è ammesso
 * dall'applicazione solo tra corso e aula della STESSA scuola, così un corso non
 * è mai raggiungibile da studenti di altre scuole.
 *
 * NOTA: il progetto non memorizza file binari: video, copertine e documenti sono
 * riferimenti (URL) a risorse ospitate esternamente (streaming/CDN), coerente
 * con la gestione degli allegati dei compiti.
 */
const LIVELLI_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'];
const STATI_CORSO = ['bozza', 'pubblicato', 'archiviato'];
const URL_MAX = 2048;

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 1. Tabella corsi ──
    await queryInterface.createTable('corsi', {
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
      copertina_url: {
        type: DataTypes.STRING(URL_MAX),
        allowNull: true,
      },
      livello_jlpt: {
        type: DataTypes.ENUM(...LIVELLI_JLPT),
        allowNull: true,
      },
      stato: {
        type: DataTypes.ENUM(...STATI_CORSO),
        allowNull: false,
        defaultValue: 'bozza',
      },
      video_scaricabile: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
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

    await queryInterface.addIndex('corsi', ['scuola_id'], { name: 'corsi_scuola_id' });
    await queryInterface.addIndex('corsi', ['creato_da'], { name: 'corsi_creato_da' });
    await queryInterface.addIndex('corsi', ['stato'], { name: 'corsi_stato' });
    await queryInterface.addIndex('corsi', ['livello_jlpt'], { name: 'corsi_livello_jlpt' });

    // ── 2. Tabella capitoli ──
    await queryInterface.createTable('capitoli', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      corso_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'corsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      titolo: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      descrizione: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      video_url: {
        type: DataTypes.STRING(URL_MAX),
        allowNull: true,
      },
      video_durata_secondi: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      scaricabile: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      },
      ordine: {
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

    await queryInterface.addIndex('capitoli', ['corso_id', 'ordine'], {
      name: 'capitoli_corso_ordine',
    });

    // ── 3. Tabella documenti_capitolo ──
    await queryInterface.createTable('documenti_capitolo', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      capitolo_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'capitoli', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      titolo: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING(URL_MAX),
        allowNull: false,
      },
      ordine: {
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

    await queryInterface.addIndex('documenti_capitolo', ['capitolo_id', 'ordine'], {
      name: 'documenti_capitolo_capitolo_ordine',
    });

    // ── 4. Tabella ponte corso_aule (disponibilità) ──
    await queryInterface.createTable('corso_aule', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      corso_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'corsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classe_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'classi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reso_disponibile_da: {
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

    await queryInterface.addIndex('corso_aule', ['corso_id', 'classe_id'], {
      name: 'corso_aule_corso_classe',
      unique: true,
    });
    await queryInterface.addIndex('corso_aule', ['corso_id'], { name: 'corso_aule_corso' });
    await queryInterface.addIndex('corso_aule', ['classe_id'], { name: 'corso_aule_classe' });
  },

  down: async ({ context: queryInterface }) => {
    // Rimozione in ordine inverso rispetto alle dipendenze.
    await queryInterface.dropTable('corso_aule');
    await queryInterface.dropTable('documenti_capitolo');
    await queryInterface.dropTable('capitoli');
    await queryInterface.dropTable('corsi');

    // Rimuove i tipi ENUM orfani creati da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_corsi_livello_jlpt";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_corsi_stato";');
    }
  },
};
