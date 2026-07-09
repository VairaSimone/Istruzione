'use strict';

const { DataTypes } = require('sequelize');

/**
 * Upload dei file dal PC + sotto-capitoli (stile Udemy) per le videolezioni.
 *
 * Cambiamenti rispetto alla prima versione (che memorizzava SOLO URL esterni):
 *
 *   1. Nuova tabella `file_caricati` → METADATI dei binari caricati dal PC
 *      (video, immagini di copertina, documenti allegati). Il file vero risiede
 *      su disco in una cartella privata organizzata per scuola; qui restano solo
 *      i metadati (tipo, percorso relativo privato, nome originale, MIME,
 *      dimensione, scuola proprietaria, autore).
 *
 *   2. `corsi.copertina_file_id` → copertina caricata come file (FK SET NULL).
 *      La colonna `copertina_url` resta come alternativa esterna facoltativa.
 *
 *   3. `capitoli.capitolo_padre_id` → auto-riferimento per i SOTTO-CAPITOLI:
 *      NULL = sezione di primo livello; valorizzato = sotto-capitolo/lezione di
 *      quella sezione (profondità massima 1, applicata a livello applicativo).
 *      `capitoli.video_file_id` → video caricato come file (FK SET NULL);
 *      `capitoli.video_url` resta come alternativa esterna facoltativa.
 *
 *   4. `documenti_capitolo.file_id` → allegato caricato come file (FK SET NULL);
 *      `documenti_capitolo.url` diventa NULLABLE (un documento è "file" OPPURE
 *      "url"; il vincolo esatto è applicato dal service).
 *
 * ISOLAMENTO TRA SCUOLE: `file_caricati.scuola_id` (FK → scuole, ON DELETE
 * CASCADE) timbra il tenant proprietario del binario. L'endpoint protetto di
 * distribuzione verifica sempre l'accesso (staff della stessa scuola, oppure
 * studente con il corso disponibile e pubblicato in una sua aula).
 *
 * SET NULL sui riferimenti al file: la cancellazione della riga-file non rompe
 * l'entità che la referenziava; la pulizia dei binari e delle righe orfane è
 * gestita esplicitamente dal service.
 */
const TIPI_FILE = ['video', 'immagine', 'documento'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 1. Tabella file_caricati ──
    await queryInterface.createTable('file_caricati', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tipo: {
        type: DataTypes.ENUM(...TIPI_FILE),
        allowNull: false,
      },
      // Percorso RELATIVO rispetto a UPLOAD_DIR. Privato: mai esposto al client.
      percorso: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      nome_originale: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      dimensione_byte: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      caricato_da: {
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

    await queryInterface.addIndex('file_caricati', ['scuola_id'], { name: 'file_caricati_scuola_id' });
    await queryInterface.addIndex('file_caricati', ['tipo'], { name: 'file_caricati_tipo' });
    await queryInterface.addIndex('file_caricati', ['caricato_da'], { name: 'file_caricati_caricato_da' });

    // ── 2. corsi.copertina_file_id ──
    await queryInterface.addColumn('corsi', 'copertina_file_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'file_caricati', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('corsi', ['copertina_file_id'], { name: 'corsi_copertina_file_id' });

    // ── 3. capitoli: sotto-capitoli + video via file ──
    await queryInterface.addColumn('capitoli', 'capitolo_padre_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'capitoli', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addColumn('capitoli', 'video_file_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'file_caricati', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('capitoli', ['capitolo_padre_id', 'ordine'], { name: 'capitoli_padre_ordine' });
    await queryInterface.addIndex('capitoli', ['video_file_id'], { name: 'capitoli_video_file_id' });

    // ── 4. documenti_capitolo: url nullable + file_id ──
    await queryInterface.changeColumn('documenti_capitolo', 'url', {
      type: DataTypes.STRING(2048),
      allowNull: true,
    });
    await queryInterface.addColumn('documenti_capitolo', 'file_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'file_caricati', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('documenti_capitolo', ['file_id'], { name: 'documenti_capitolo_file_id' });
  },

  down: async ({ context: queryInterface }) => {
    // Rimozione in ordine inverso rispetto alle dipendenze.

    // documenti_capitolo
    await queryInterface.removeIndex('documenti_capitolo', 'documenti_capitolo_file_id');
    await queryInterface.removeColumn('documenti_capitolo', 'file_id');
    // Ripristina url NOT NULL (i documenti pre-esistenti avevano sempre un url).
    await queryInterface.changeColumn('documenti_capitolo', 'url', {
      type: DataTypes.STRING(2048),
      allowNull: false,
    });

    // capitoli
    await queryInterface.removeIndex('capitoli', 'capitoli_video_file_id');
    await queryInterface.removeIndex('capitoli', 'capitoli_padre_ordine');
    await queryInterface.removeColumn('capitoli', 'video_file_id');
    await queryInterface.removeColumn('capitoli', 'capitolo_padre_id');

    // corsi
    await queryInterface.removeIndex('corsi', 'corsi_copertina_file_id');
    await queryInterface.removeColumn('corsi', 'copertina_file_id');

    // file_caricati
    await queryInterface.dropTable('file_caricati');

    // Rimuove il tipo ENUM orfano creato da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_file_caricati_tipo";');
    }
  },
};
