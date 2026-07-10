'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const { CODICI_ATTIVITA, esiste: tipoAttivitaEsiste } = require('../constants/tipiAttivita');

/**
 * Tipi di attività assegnabili in un compito.
 *
 * NON sono più un ENUM di database: il valore è una stringa validata contro il
 * REGISTRO `constants/tipiAttivita.js`. Prima della generalizzazione l'ENUM
 * conteneva `quiz_kana | quiz_kanji | tracciamento | vocabolario`, valori legati
 * alla materia insegnata che imponevano una migrazione ALTER TABLE per ogni
 * nuovo tipo. Ora i tipi sono neutri (`quiz`, `corso`, `pratica_scrittura`,
 * `lettura`, `consegna`, `personalizzato`) e aggiungerne uno significa
 * aggiungere una voce al registro.
 *
 * I parametri specifici (quale quiz, quale corso, quante domande…) vivono nel
 * campo JSON `configurazione`: nessun accoppiamento rigido, piena estensibilità.
 */
const TIPI_ATTIVITA = CODICI_ATTIVITA;

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
      scuolaId: this.scuola_id,
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

    // Codice del tipo di attività (registro `constants/tipiAttivita.js`).
    // Colonna STRING: nuovi tipi senza migrazioni.
    tipo_attivita: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'tipo_attivita',
      validate: {
        appartieneAlRegistro(valore) {
          if (!tipoAttivitaEsiste(valore)) {
            throw new Error(`Il tipo di attività deve essere uno di: ${TIPI_ATTIVITA.join(', ')}`);
          }
        },
      },
    },

    // Parametri dell'attività (quizId, corsoId, numeroDomande…).
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

    // Scuola (tenant) del compito: timbrata alla creazione dalla scuola
    // dell'autore. Null solo per i compiti creati da un admin (trasversale).
    // Rende esplicito e verificabile il confine di tenant e abilita il filtro
    // per scuola lato admin; l'autorizzazione effettiva resta comunque garantita
    // dai controlli di membership sulle assegnazioni.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
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
      { fields: ['scuola_id'], name: 'compiti_scuola_id' },
      { fields: ['stato'], name: 'compiti_stato' },
      { fields: ['tipo_attivita'], name: 'compiti_tipo_attivita' },
      { fields: ['data_scadenza'], name: 'compiti_data_scadenza' },
    ],
  }
);

Compito.belongsTo(Utente, { as: 'autore', foreignKey: 'creato_da', onDelete: 'SET NULL' });
Utente.hasMany(Compito, { as: 'compitiCreati', foreignKey: 'creato_da', onDelete: 'SET NULL' });

// Tenant del compito. CASCADE con la scuola (coerente con le aule).
const Scuola = require('./Scuola');
Compito.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(Compito, { as: 'compiti', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

Compito.TIPI_ATTIVITA = TIPI_ATTIVITA;
Compito.STATI_COMPITO = STATI_COMPITO;

module.exports = Compito;
