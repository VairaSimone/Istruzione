'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const { TIPI_FILE } = require('../config/upload');

/**
 * FileCaricato — METADATO di un file caricato dal PC (video, immagine, documento).
 *
 * A differenza della prima versione delle videolezioni (che salvava solo URL a
 * risorse esterne), qui i file risiedono su disco, in una cartella privata
 * organizzata per scuola. Questa tabella tiene i METADATI del file; il binario
 * NON è nel database.
 *
 * Campi principali:
 *   - `tipo`            → categoria logica (video/immagine/documento);
 *   - `percorso`        → percorso RELATIVO (rispetto a UPLOAD_DIR) del file su
 *                         disco. È un dato PRIVATO: non viene MAI esposto al
 *                         client; i file si servono solo tramite l'endpoint
 *                         protetto `/api/corsi/files/:fileId`;
 *   - `nome_originale`  → nome file scelto dall'utente (usato per il download);
 *   - `mime_type`       → MIME validato in fase di upload;
 *   - `dimensione_byte` → dimensione del file;
 *   - `scuola_id`       → tenant proprietario (isolamento tra scuole);
 *   - `caricato_da`     → autore del caricamento (audit leggero).
 *
 * ISOLAMENTO TRA SCUOLE: `scuola_id` timbra il proprietario. L'endpoint di
 * distribuzione verifica sempre che il richiedente possa accedere al file
 * (staff della stessa scuola, oppure studente con il corso disponibile e
 * pubblicato in una sua aula).
 *
 * I file sono referenziati da corsi/capitoli/documenti con ON DELETE SET NULL:
 * la cancellazione della riga-file non rompe l'entità che la usava; la pulizia
 * del binario su disco e delle righe orfane è gestita esplicitamente dal
 * service (fileService/corsiService).
 */
class FileCaricato extends Model {
  /**
   * Dati esponibili al client. NON include mai `percorso` (dettaglio privato):
   * per scaricare/riprodurre il file si usa l'URL `/api/corsi/files/<id>`.
   */
  toPublicJSON() {
    return {
      id: this.id,
      tipo: this.tipo,
      nomeOriginale: this.nome_originale,
      mimeType: this.mime_type,
      dimensioneByte: this.dimensione_byte,
      created_at: this.created_at,
    };
  }
}

FileCaricato.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    tipo: {
      type: DataTypes.ENUM(...TIPI_FILE),
      allowNull: false,
      validate: {
        isIn: {
          args: [TIPI_FILE],
          msg: `Il tipo di file deve essere uno di: ${TIPI_FILE.join(', ')}`,
        },
      },
    },

    // Percorso relativo del file su disco (rispetto a UPLOAD_DIR). Privato.
    percorso: {
      type: DataTypes.STRING(512),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il percorso del file è obbligatorio' },
      },
    },

    nome_originale: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'nome_originale',
      validate: {
        notEmpty: { msg: 'Il nome originale del file è obbligatorio' },
      },
    },

    mime_type: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'mime_type',
    },

    dimensione_byte: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'dimensione_byte',
      validate: {
        min: { args: [0], msg: 'La dimensione del file non può essere negativa' },
      },
    },

    // Tenant proprietario del file (isolamento tra scuole). Null solo per file
    // caricati da un admin non associato ad alcuna scuola.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    caricato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'caricato_da',
    },
  },
  {
    sequelize,
    modelName: 'FileCaricato',
    tableName: 'file_caricati',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { fields: ['scuola_id'], name: 'file_caricati_scuola_id' },
      { fields: ['tipo'], name: 'file_caricati_tipo' },
      { fields: ['caricato_da'], name: 'file_caricati_caricato_da' },
    ],
  }
);

// Autore del caricamento (ownership debole). SET NULL se l'account sparisce.
FileCaricato.belongsTo(Utente, { as: 'autore', foreignKey: 'caricato_da', onDelete: 'SET NULL' });

// Tenant. CASCADE con la scuola: eliminando la scuola spariscono le righe-file
// (la pulizia dei binari su disco per quella scuola è gestita a parte).
const Scuola = require('./Scuola');
FileCaricato.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(FileCaricato, { as: 'file', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

module.exports = FileCaricato;
