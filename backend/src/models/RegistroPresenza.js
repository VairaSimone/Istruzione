'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Classe = require('./Classe');

// Lunghezza massima dell'argomento della lezione (facoltativo).
const ARGOMENTO_MAX = 200;

/**
 * RegistroPresenza — SESSIONE DI APPELLO di un'aula in una data.
 *
 * Rappresenta la rilevazione delle presenze fatta da un insegnante per una
 * determinata aula in un determinato giorno. Le presenze dei singoli studenti
 * vivono nelle righe `VocePresenza` collegate (una per studente): il registro è
 * l'intestazione, le voci sono il corpo dell'appello.
 *
 * Un solo registro per aula per data (vincolo di unicità `classe_id + data`):
 * riaprire l'appello dello stesso giorno modifica quello esistente, non ne crea
 * un secondo. La `data` è una DATEONLY (giorno, senza orario): l'appello è per
 * giornata, non per minuto.
 *
 * `scuola_id` timbra il tenant alla creazione (dalla scuola dell'aula) e rende
 * banali le query per scuola; CASCADE con la scuola e con l'aula.
 */
class RegistroPresenza extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      classeId: this.classe_id,
      scuolaId: this.scuola_id,
      data: this.data,
      argomento: this.argomento,
      note: this.note,
      creatoDa: this.creato_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

RegistroPresenza.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Aula a cui si riferisce l'appello. CASCADE: eliminando l'aula spariscono
    // i suoi registri (e, a cascata, le relative voci).
    classe_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'classe_id',
    },

    // Tenant dell'appello. Timbrato dalla scuola dell'aula alla creazione.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // Giorno dell'appello (senza orario). La coppia (classe_id, data) è unica.
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Argomento/note della lezione (facoltativo).
    argomento: {
      type: DataTypes.STRING(ARGOMENTO_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, ARGOMENTO_MAX], msg: `L'argomento non può superare i ${ARGOMENTO_MAX} caratteri` },
      },
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Insegnante che ha aperto l'appello. SET NULL se l'account sparisce.
    creato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'creato_da',
    },
  },
  {
    sequelize,
    modelName: 'RegistroPresenza',
    tableName: 'registri_presenza',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità: un solo appello per aula per giorno. È anche la chiave che
      // rende idempotente l'apertura del registro di una data.
      { unique: true, fields: ['classe_id', 'data'], name: 'registri_pres_classe_data' },
      { fields: ['scuola_id'], name: 'registri_pres_scuola' },
      { fields: ['creato_da'], name: 'registri_pres_creato_da' },
      // Filtro principale: registri di un'aula ordinati per data.
      { fields: ['classe_id', 'data'], name: 'registri_pres_classe_data_ord' },
    ],
  }
);

RegistroPresenza.belongsTo(Classe, { as: 'aula', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(RegistroPresenza, { as: 'registriPresenza', foreignKey: 'classe_id', onDelete: 'CASCADE' });

RegistroPresenza.belongsTo(Utente, { as: 'autore', foreignKey: 'creato_da', onDelete: 'SET NULL' });
Utente.hasMany(RegistroPresenza, { as: 'appelliCreati', foreignKey: 'creato_da', onDelete: 'SET NULL' });

const Scuola = require('./Scuola');
RegistroPresenza.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(RegistroPresenza, { as: 'registriPresenza', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

RegistroPresenza.ARGOMENTO_MAX = ARGOMENTO_MAX;

module.exports = RegistroPresenza;
