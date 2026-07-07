'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Corso = require('./Corso');

const URL_MAX = Corso.URL_MAX;
const URL_REGEX = Corso.URL_REGEX;

/**
 * Capitolo — unità di un corso (una "lezione").
 *
 * Un capitolo appartiene a un `corso` e raccoglie:
 *   - un VIDEO (facoltativo, `video_url`): la videolezione vera e propria,
 *     referenziata via URL (streaming/CDN). Facoltativo perché un capitolo può
 *     essere di soli documenti/descrizione;
 *   - una DESCRIZIONE (facoltativa);
 *   - più DOCUMENTI allegati (cfr. DocumentoCapitolo).
 *
 * `ordine` definisce la sequenza dei capitoli all'interno del corso (gli
 * studenti li vedono ordinati per `ordine` crescente, poi per `created_at`).
 *
 * `scaricabile` è l'OVERRIDE della policy di download del video per QUESTO
 * capitolo:
 *   - true  → il video è scaricabile dagli studenti;
 *   - false → il video è solo in streaming;
 *   - null  → eredita la policy predefinita del corso (`Corso.video_scaricabile`).
 * Il valore EFFETTIVO (booleano) è calcolato dal service ed esposto agli studenti.
 */
class Capitolo extends Model {
  /**
   * Risolve la policy di download EFFETTIVA del video del capitolo, applicando
   * l'eredità dal corso quando l'override è null.
   * @param {boolean} defaultCorso  valore di `Corso.video_scaricabile`
   * @returns {boolean}
   */
  scaricabileEffettivo(defaultCorso) {
    return this.scaricabile === null || this.scaricabile === undefined
      ? Boolean(defaultCorso)
      : Boolean(this.scaricabile);
  }

  /** Dati esponibili al client (i documenti sono aggiunti dal service). */
  toPublicJSON() {
    return {
      id: this.id,
      corsoId: this.corso_id,
      titolo: this.titolo,
      descrizione: this.descrizione,
      videoUrl: this.video_url,
      videoDurataSecondi: this.video_durata_secondi,
      scaricabile: this.scaricabile,
      ordine: this.ordine,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Capitolo.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    corso_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'corso_id',
    },

    titolo: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il titolo del capitolo non può essere vuoto' },
        len: { args: [2, 160], msg: 'Il titolo del capitolo deve avere tra 2 e 160 caratteri' },
      },
    },

    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // URL della videolezione (facoltativo). Solo riferimento, non file.
    video_url: {
      type: DataTypes.STRING(URL_MAX),
      allowNull: true,
      defaultValue: null,
      field: 'video_url',
      validate: {
        is: {
          args: URL_REGEX,
          msg: "L'URL del video deve iniziare con http:// o https://",
        },
      },
    },

    // Durata del video in secondi (facoltativa, metadato per la UI).
    video_durata_secondi: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: 'video_durata_secondi',
      validate: {
        min: { args: [0], msg: 'La durata del video non può essere negativa' },
        max: { args: [86400], msg: 'La durata del video non può superare le 24 ore' },
      },
    },

    // Override della policy di download del video (null = eredita dal corso).
    scaricabile: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },

    // Posizione del capitolo nel corso (ordinamento crescente).
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
    modelName: 'Capitolo',
    tableName: 'capitoli',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Elenco ordinato dei capitoli di un corso.
      { fields: ['corso_id', 'ordine'], name: 'capitoli_corso_ordine' },
    ],
  }
);

// Un capitolo appartiene a un corso. CASCADE: eliminando il corso spariscono i
// suoi capitoli (e, a cascata, i documenti allegati).
Capitolo.belongsTo(Corso, { as: 'corso', foreignKey: 'corso_id', onDelete: 'CASCADE' });
Corso.hasMany(Capitolo, { as: 'capitoli', foreignKey: 'corso_id', onDelete: 'CASCADE' });

module.exports = Capitolo;
