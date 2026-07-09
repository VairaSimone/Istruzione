'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Corso = require('./Corso');
const Capitolo = require('./Capitolo');

const URL_MAX = Corso.URL_MAX;
const URL_REGEX = Corso.URL_REGEX;

/**
 * DocumentoCapitolo — allegato di un capitolo (PDF, slide, dispensa, ecc.).
 *
 * Ogni documento appartiene a un `capitolo` e può essere CARICATO come file dal
 * PC (`file_id` → file_caricati) OPPURE referenziato via URL esterno (`url`). Le
 * due strade sono alternative: un documento deve avere ESATTAMENTE uno dei due
 * (vincolo applicato nel service). I documenti allegati sono materiale di studio
 * pensato per il download e NON sono soggetti alla policy di download dei video.
 *
 * `ordine` definisce la sequenza dei documenti nel capitolo.
 */
class DocumentoCapitolo extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      capitoloId: this.capitolo_id,
      titolo: this.titolo,
      // Se caricato come file, il client lo scarica da
      // `/api/corsi/files/<fileId>`; in alternativa resta l'URL esterno.
      fileId: this.file_id,
      url: this.url,
      ordine: this.ordine,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

DocumentoCapitolo.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    capitolo_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'capitolo_id',
    },

    titolo: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il titolo del documento non può essere vuoto' },
        len: { args: [1, 200], msg: 'Il titolo del documento deve avere tra 1 e 200 caratteri' },
      },
    },

    // URL esterno del documento (facoltativo: alternativa al file caricato).
    // La regola "uno tra file e url è obbligatorio" è applicata nel service.
    url: {
      type: DataTypes.STRING(URL_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        is: {
          args: URL_REGEX,
          msg: "L'URL del documento deve iniziare con http:// o https://",
        },
      },
    },

    // Documento CARICATO come file (alternativa all'URL). Riferimento a
    // file_caricati; SET NULL se il file viene rimosso.
    file_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'file_id',
    },

    // Posizione del documento nel capitolo (ordinamento crescente).
    ordine: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: "L'ordine non può essere negativo" },
      },
    },
  },
  {
    sequelize,
    modelName: 'DocumentoCapitolo',
    tableName: 'documenti_capitolo',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Elenco ordinato dei documenti di un capitolo.
      { fields: ['capitolo_id', 'ordine'], name: 'documenti_capitolo_capitolo_ordine' },
      { fields: ['file_id'], name: 'documenti_capitolo_file_id' },
    ],
  }
);

// Un documento appartiene a un capitolo. CASCADE: eliminando il capitolo (o il
// corso) spariscono i suoi documenti.
DocumentoCapitolo.belongsTo(Capitolo, { as: 'capitolo', foreignKey: 'capitolo_id', onDelete: 'CASCADE' });
Capitolo.hasMany(DocumentoCapitolo, { as: 'documenti', foreignKey: 'capitolo_id', onDelete: 'CASCADE' });

// File caricato. SET NULL: rimuovere il file non elimina la riga documento.
const FileCaricato = require('./FileCaricato');
DocumentoCapitolo.belongsTo(FileCaricato, {
  as: 'file',
  foreignKey: 'file_id',
  onDelete: 'SET NULL',
});

module.exports = DocumentoCapitolo;
