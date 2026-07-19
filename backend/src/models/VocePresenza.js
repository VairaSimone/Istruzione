'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const RegistroPresenza = require('./RegistroPresenza');
const {
  esiste: statoEsiste,
  CODICI_PRESENZA,
  STATO_PRESENZA_DEFAULT,
} = require('../constants/statiPresenza');

// Lunghezza massima della nota per-voce (es. motivo del ritardo).
const NOTA_MAX = 300;

/**
 * VocePresenza — PRESENZA DEL SINGOLO STUDENTE in un appello.
 *
 * Una riga per studente per registro: lo stato (presente/assente/ritardo…) del
 * singolo nella sessione di appello. Speculare a `compito_consegne` rispetto a
 * `compiti`: l'intestazione è il registro, il corpo sono queste voci.
 *
 * Lo `stato` è una STRINGA validata contro `constants/statiPresenza.js` (nessun
 * ENUM di database): aggiungere uno stato non richiede migrazioni. Il vincolo di
 * unicità (registro_id + utente_id) garantisce una sola voce per studente per
 * appello e rende idempotente il salvataggio.
 */
class VocePresenza extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      registroId: this.registro_id,
      utenteId: this.utente_id,
      stato: this.stato,
      nota: this.nota,
      registratoDa: this.registrato_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

VocePresenza.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    registro_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'registro_id',
    },

    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // Codice dello stato (registro `constants/statiPresenza.js`). STRING: nuovi
    // stati senza migrazioni.
    stato: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: STATO_PRESENZA_DEFAULT,
      validate: {
        appartieneAlRegistro(valore) {
          if (!statoEsiste(valore)) {
            throw new Error(`Lo stato di presenza deve essere uno di: ${CODICI_PRESENZA.join(', ')}`);
          }
        },
      },
    },

    // Nota facoltativa (motivo del ritardo, riferimento alla giustifica…).
    nota: {
      type: DataTypes.STRING(NOTA_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, NOTA_MAX], msg: `La nota non può superare i ${NOTA_MAX} caratteri` },
      },
    },

    // Chi ha registrato/aggiornato la voce (audit leggero). SET NULL se sparisce.
    registrato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'registrato_da',
    },
  },
  {
    sequelize,
    modelName: 'VocePresenza',
    tableName: 'voci_presenza',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità: una sola voce per studente per appello (chiave di upsert).
      { unique: true, fields: ['registro_id', 'utente_id'], name: 'voci_pres_registro_utente' },
      // Corpo dell'appello: tutte le voci di un registro.
      { fields: ['registro_id'], name: 'voci_pres_registro' },
      // Storico di uno studente (per conteggio assenze).
      { fields: ['utente_id', 'stato'], name: 'voci_pres_utente_stato' },
    ],
  }
);

VocePresenza.belongsTo(RegistroPresenza, { as: 'registro', foreignKey: 'registro_id', onDelete: 'CASCADE' });
RegistroPresenza.hasMany(VocePresenza, { as: 'voci', foreignKey: 'registro_id', onDelete: 'CASCADE' });

VocePresenza.belongsTo(Utente, { as: 'studente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(VocePresenza, { as: 'presenze', foreignKey: 'utente_id', onDelete: 'CASCADE' });

VocePresenza.NOTA_MAX = NOTA_MAX;

module.exports = VocePresenza;
