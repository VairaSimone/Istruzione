'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const DomandaQuiz = require('./DomandaQuiz');

const TESTO_MAX = 500;

/**
 * OpzioneQuiz — una risposta possibile di una domanda a scelta multipla
 * (o vero/falso) di un quiz personalizzato.
 *
 * Il flag `corretta` NON viene mai esposto agli studenti: la correzione è
 * interamente lato server. Le domande di tipo 'risposta_breve' non hanno righe
 * in questa tabella.
 *
 * Il vincolo \"esattamente una opzione corretta\" è applicato nel service, dove
 * l'insieme delle opzioni della domanda è visibile per intero.
 */
class OpzioneQuiz extends Model {
  /** Dati per lo STAFF: include il flag di correttezza. */
  toPublicJSON() {
    return {
      id: this.id,
      domandaId: this.domanda_id,
      testo: this.testo,
      corretta: this.corretta,
      ordine: this.ordine,
    };
  }

  /** Dati per lo STUDENTE: nessuna indicazione sulla correttezza. */
  toStudenteJSON() {
    return {
      id: this.id,
      testo: this.testo,
    };
  }
}

OpzioneQuiz.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    domanda_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'domanda_id',
    },

    testo: {
      type: DataTypes.STRING(TESTO_MAX),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Il testo dell'opzione non può essere vuoto" },
        len: { args: [1, TESTO_MAX], msg: `Il testo dell'opzione non può superare i ${TESTO_MAX} caratteri` },
      },
    },

    corretta: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

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
    modelName: 'OpzioneQuiz',
    tableName: 'opzioni_quiz',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Elenco ordinato delle opzioni di una domanda.
      { fields: ['domanda_id', 'ordine'], name: 'opzioni_quiz_domanda_ordine' },
    ],
  }
);

// CASCADE: eliminando la domanda spariscono le sue opzioni.
OpzioneQuiz.belongsTo(DomandaQuiz, { as: 'domanda', foreignKey: 'domanda_id', onDelete: 'CASCADE' });
DomandaQuiz.hasMany(OpzioneQuiz, { as: 'opzioni', foreignKey: 'domanda_id', onDelete: 'CASCADE' });

OpzioneQuiz.TESTO_MAX = TESTO_MAX;

module.exports = OpzioneQuiz;
