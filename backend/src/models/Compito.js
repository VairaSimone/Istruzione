'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

/**
 * Tipi di attività assegnabili in un compito. Allineati alle attività già
 * presenti nel progetto:
 *   - 'quiz_kana'    → quiz sui kana (dominio kana di /api/quiz/generate);
 *   - 'quiz_kanji'   → quiz sui kanji (dominio kanji);
 *   - 'tracciamento' → pratica di scrittura/ordine dei tratti (canvas);
 *   - 'vocabolario'  → esercizio di vocabolario (predisposto: la
 *                      configurazione è libera, così un futuro modulo lo
 *                      interpreta senza modifiche allo schema).
 *
 * I parametri specifici dell'attività (dominio, alfabeto, livello JLPT, numero
 * di domande, ecc.) vivono nel campo JSON `configurazione`, che rispecchia il
 * payload già usato dal frontend per generare l'attività: nessun accoppiamento
 * rigido, piena estensibilità.
 */
const TIPI_ATTIVITA = ['quiz_kana', 'quiz_kanji', 'tracciamento', 'vocabolario'];

// Stato di pubblicazione del compito (distinto dallo stato PER STUDENTE, che è
// derivato: assegnato / in_scadenza / scaduto / completato).
//   - 'bozza'      → visibile solo all'autore, non assegnato agli studenti;
//   - 'pubblicato' → attivo e visibile agli studenti destinatari;
//   - 'archiviato' → concluso/nascosto, resta nello storico.
const STATI_COMPITO = ['bozza', 'pubblicato', 'archiviato'];

class Compito extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      titolo: this.titolo,
      descrizione: this.descrizione,
      tipoAttivita: this.tipo_attivita,
      configurazione: this.configurazione || null,
      dataScadenza: this.data_scadenza,
      tempoLimiteMinuti: this.tempo_limite_minuti,
      punteggioMassimo: this.punteggio_massimo,
      stato: this.stato,
      creatoDa: this.creato_da,
      // "data di creazione" richiesta dalla specifica = created_at.
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Compito.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    titolo: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il titolo non può essere vuoto' },
        len: { args: [2, 160], msg: 'Il titolo deve avere tra 2 e 160 caratteri' },
      },
    },

    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    tipo_attivita: {
      type: DataTypes.ENUM(...TIPI_ATTIVITA),
      allowNull: false,
      field: 'tipo_attivita',
      validate: {
        isIn: {
          args: [TIPI_ATTIVITA],
          msg: `Il tipo di attività deve essere uno di: ${TIPI_ATTIVITA.join(', ')}`,
        },
      },
    },

    // Parametri dell'attività (dominio, alfabeto, livello JLPT, numeroDomande…).
    configurazione: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },

    data_scadenza: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'data_scadenza',
    },

    // Tempo limite facoltativo (in minuti) per svolgere l'attività.
    tempo_limite_minuti: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      field: 'tempo_limite_minuti',
      validate: {
        min: { args: [1], msg: 'Il tempo limite deve essere di almeno 1 minuto' },
        max: { args: [1440], msg: 'Il tempo limite non può superare i 1440 minuti (24h)' },
      },
    },

    punteggio_massimo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: 'punteggio_massimo',
      validate: {
        min: { args: [1], msg: 'Il punteggio massimo deve essere almeno 1' },
        max: { args: [1000], msg: 'Il punteggio massimo non può superare 1000' },
      },
    },

    stato: {
      type: DataTypes.ENUM(...STATI_COMPITO),
      allowNull: false,
      defaultValue: 'bozza',
      validate: {
        isIn: {
          args: [STATI_COMPITO],
          msg: `Lo stato deve essere uno di: ${STATI_COMPITO.join(', ')}`,
        },
      },
    },

    // Insegnante autore del compito (ownership). SET NULL se l'account sparisce.
    creato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'creato_da',
    },
  },
  {
    sequelize,
    modelName: 'Compito',
    tableName: 'compiti',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { fields: ['creato_da'], name: 'compiti_creato_da' },
      { fields: ['stato'], name: 'compiti_stato' },
      { fields: ['tipo_attivita'], name: 'compiti_tipo_attivita' },
      { fields: ['data_scadenza'], name: 'compiti_data_scadenza' },
    ],
  }
);

Compito.belongsTo(Utente, { as: 'autore', foreignKey: 'creato_da', onDelete: 'SET NULL' });
Utente.hasMany(Compito, { as: 'compitiCreati', foreignKey: 'creato_da', onDelete: 'SET NULL' });

Compito.TIPI_ATTIVITA = TIPI_ATTIVITA;
Compito.STATI_COMPITO = STATI_COMPITO;

module.exports = Compito;
