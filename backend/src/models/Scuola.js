'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Scuola — TENANT della piattaforma.
 *
 * Ogni studente e ogni insegnante appartiene a una scuola (cfr. `Utente.scuola_id`);
 * aule, compiti e messaggi nascono legati alla scuola del loro autore. Gli
 * insegnanti vedono e operano SOLO entro la propria scuola; l'admin (che NON
 * appartiene ad alcuna scuola, `scuola_id = null`) ha piena visibilità su tutte.
 *
 * `impostazioni` è un blob JSON di configurazione PERSONALE della scuola: ogni
 * scuola può avere settaggi differenti per l'intera piattaforma senza influenzare
 * le altre. Lo schema del blob è volutamente libero (estensibile senza migrazioni):
 * le chiavi sconosciute sono ignorate, i default vivono nell'applicazione.
 */
class Scuola extends Model {
  /** Dati esponibili al client. */
  toPublicJSON() {
    return {
      id: this.id,
      nome: this.nome,
      impostazioni: this.impostazioni || {},
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Scuola.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: {
        name: 'unique_scuola_nome',
        msg: 'Esiste già una scuola con questo nome',
      },
      validate: {
        notEmpty: { msg: 'Il nome della scuola non può essere vuoto' },
        len: { args: [2, 160], msg: 'Il nome della scuola deve avere tra 2 e 160 caratteri' },
      },
    },

    // Configurazione personale della scuola (blob JSON libero). Default {}.
    impostazioni: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: 'Scuola',
    tableName: 'scuole',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['nome'], name: 'scuole_nome' }],
  }
);

module.exports = Scuola;
