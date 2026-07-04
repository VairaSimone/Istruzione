'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Compito = require('./Compito');
const Utente = require('./Utente');

// Stato della consegna:
//   - 'completato' → lo studente ha svolto e inviato l'attività;
//   - 'valutato'   → l'insegnante ha aggiunto punteggio/feedback (gancio per
//                    la Fase 4 — feedback e messaggistica).
const STATI_CONSEGNA = ['completato', 'valutato'];

/**
 * CompitoConsegna — consegna di UN compito da parte di UNO studente.
 *
 * Le consegne sono create "pigramente" solo quando lo studente completa
 * l'attività: l'assenza di una consegna significa "non ancora svolto". Lo stato
 * per-studente (assegnato / in_scadenza / scaduto / completato) è derivato dal
 * confronto tra `Compito.data_scadenza` e l'esistenza della consegna, quindi
 * non serve materializzare una riga per ogni studente destinatario.
 *
 * Vincolo di unicità (compito_id + utente_id): una sola consegna per coppia.
 */
class CompitoConsegna extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      compitoId: this.compito_id,
      utenteId: this.utente_id,
      stato: this.stato,
      punteggioOttenuto: this.punteggio_ottenuto,
      tempoImpiegatoSecondi: this.tempo_impiegato_secondi,
      oltreTempoLimite: this.oltre_tempo_limite,
      inRitardo: this.in_ritardo,
      dataCompletamento: this.data_completamento,
      feedback: this.feedback,
      valutatoDa: this.valutato_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

CompitoConsegna.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    compito_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'compito_id',
    },

    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    stato: {
      type: DataTypes.ENUM(...STATI_CONSEGNA),
      allowNull: false,
      defaultValue: 'completato',
      validate: {
        isIn: {
          args: [STATI_CONSEGNA],
          msg: `Lo stato della consegna deve essere uno di: ${STATI_CONSEGNA.join(', ')}`,
        },
      },
    },

    // Punteggio ottenuto (0..Compito.punteggio_massimo). Validato nel service.
    punteggio_ottenuto: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: 'punteggio_ottenuto',
      validate: {
        min: { args: [0], msg: 'Il punteggio ottenuto non può essere negativo' },
      },
    },

    // Tempo impiegato dallo studente (secondi), facoltativo.
    tempo_impiegato_secondi: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: 'tempo_impiegato_secondi',
      validate: {
        min: { args: [0], msg: 'Il tempo impiegato non può essere negativo' },
      },
    },

    // True se il tempo impiegato ha superato il tempo limite del compito.
    oltre_tempo_limite: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'oltre_tempo_limite',
    },

    // True se la consegna è avvenuta dopo la data di scadenza.
    in_ritardo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'in_ritardo',
    },

    data_completamento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'data_completamento',
    },

    // Feedback dell'insegnante (gancio Fase 4).
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    valutato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'valutato_da',
    },
  },
  {
    sequelize,
    modelName: 'CompitoConsegna',
    tableName: 'compito_consegne',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { unique: true, fields: ['compito_id', 'utente_id'], name: 'compito_consegne_compito_utente' },
      { fields: ['compito_id'], name: 'compito_consegne_compito' },
      { fields: ['utente_id'], name: 'compito_consegne_utente' },
    ],
  }
);

CompitoConsegna.belongsTo(Compito, { as: 'compito', foreignKey: 'compito_id', onDelete: 'CASCADE' });
Compito.hasMany(CompitoConsegna, { as: 'consegne', foreignKey: 'compito_id', onDelete: 'CASCADE' });

CompitoConsegna.belongsTo(Utente, { as: 'studente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(CompitoConsegna, { as: 'consegne', foreignKey: 'utente_id', onDelete: 'CASCADE' });

CompitoConsegna.STATI_CONSEGNA = STATI_CONSEGNA;

module.exports = CompitoConsegna;
