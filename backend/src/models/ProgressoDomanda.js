'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const DomandaQuiz = require('./DomandaQuiz');

// Range del punteggio SRS della singola domanda, identico a ProgressoKana:
//   0 = appena sbagliata/sconosciuta · 3 = neutro (default) · 5 = padroneggiata.
const PUNTEGGIO_MIN = 0;
const PUNTEGGIO_MAX = 5;
const PUNTEGGIO_DEFAULT = 3;

/**
 * ProgressoDomanda — Sistema di Ripetizione Spaziata (SRS) per le domande dei
 * QUIZ PERSONALIZZATI.
 *
 * È il gemello di `ProgressoKana`/`ProgressoKanji` per il motore `domande`:
 * traccia, per ogni utente e per ogni domanda, un punteggio di conoscenza che
 * guida la selezione delle domande nelle partite successive (prima quelle con
 * punteggio < 3, poi le altre). Grazie a questa simmetria, il motore SRS di
 * `quizService` resta UNO SOLO per tutti i domini.
 *
 * Vincolo di unicità composito (utente_id + domanda_id): un solo record di
 * progresso per coppia utente/domanda. È anche la chiave dell'upsert massivo.
 *
 * CASCADE su entrambe le FK: eliminare un utente, un quiz o una domanda
 * rimuove i progressi collegati, senza lasciare record orfani.
 */
class ProgressoDomanda extends Model {
  /** Dati esponibili al client. */
  toPublicJSON() {
    return {
      domandaId: this.domanda_id,
      punteggio: this.punteggio,
      tentativi: this.tentativi,
      errori: this.errori,
      // Tasso di errore nelle risposte (0..1); 0 se non ancora tentata.
      tassoErrore: this.tentativi > 0 ? this.errori / this.tentativi : 0,
    };
  }
}

ProgressoDomanda.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    domanda_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'domanda_id',
    },

    punteggio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: PUNTEGGIO_DEFAULT,
      validate: {
        min: { args: [PUNTEGGIO_MIN], msg: `Il punteggio minimo è ${PUNTEGGIO_MIN}` },
        max: { args: [PUNTEGGIO_MAX], msg: `Il punteggio massimo è ${PUNTEGGIO_MAX}` },
        isInt: { msg: 'Il punteggio deve essere un numero intero' },
      },
    },

    // Numero totale di volte in cui la domanda è stata proposta.
    tentativi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'I tentativi non possono essere negativi' },
        isInt: { msg: 'I tentativi devono essere un numero intero' },
      },
    },

    // Numero di risposte ERRATE alla domanda (≤ tentativi).
    errori: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Gli errori non possono essere negativi' },
        isInt: { msg: 'Gli errori devono essere un numero intero' },
      },
    },
  },
  {
    sequelize,
    modelName: 'ProgressoDomanda',
    tableName: 'progressi_domanda',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità composita: chiave dell'upsert (ON DUPLICATE KEY UPDATE).
      { unique: true, fields: ['utente_id', 'domanda_id'], name: 'progressi_domanda_utente_domanda' },
      // Lookup rapido di tutti i progressi di un utente.
      { fields: ['utente_id'], name: 'progressi_domanda_utente_id' },
      // Selezione SRS: domande \"da rivedere\" dell'utente.
      { fields: ['utente_id', 'punteggio'], name: 'progressi_domanda_utente_punteggio' },
      // Statistiche per domanda (quante volte è stata sbagliata in generale).
      { fields: ['domanda_id'], name: 'progressi_domanda_domanda_id' },
    ],
  }
);

ProgressoDomanda.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(ProgressoDomanda, { as: 'progressiDomanda', foreignKey: 'utente_id', onDelete: 'CASCADE' });

ProgressoDomanda.belongsTo(DomandaQuiz, { as: 'domanda', foreignKey: 'domanda_id', onDelete: 'CASCADE' });
DomandaQuiz.hasMany(ProgressoDomanda, { as: 'progressi', foreignKey: 'domanda_id', onDelete: 'CASCADE' });

ProgressoDomanda.PUNTEGGIO_MIN = PUNTEGGIO_MIN;
ProgressoDomanda.PUNTEGGIO_MAX = PUNTEGGIO_MAX;
ProgressoDomanda.PUNTEGGIO_DEFAULT = PUNTEGGIO_DEFAULT;

module.exports = ProgressoDomanda;
