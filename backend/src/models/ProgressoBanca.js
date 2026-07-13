'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

// Range del punteggio SRS del singolo elemento (identico a ProgressoKana/Kanji
// per riusare senza modifiche il motore SRS del quiz).
//   0 = appena sbagliato · 3 = neutro (default) · 5 = padroneggiato.
const PUNTEGGIO_MIN = 0;
const PUNTEGGIO_MAX = 5;
const PUNTEGGIO_DEFAULT = 3;

/**
 * ProgressoBanca — SRS per singola VOCE di una banca dati (motore `banca`).
 *
 * Gemello generico di `ProgressoKana`/`ProgressoKanji`: traccia, per ogni
 * utente e per ogni voce (identificata dal suo id GLOBALMENTE univoco), lo
 * stesso punteggio 0–5 usato dagli altri motori, così la selezione del pool e
 * l'aggiornamento condividono l'IDENTICO motore SRS (nessuna duplicazione).
 *
 * A differenza di kana/kanji, questa UNICA tabella serve TUTTE le banche
 * (webdev, inglese-verbi, chimica, geografia, …): non serve una migrazione per
 * ogni nuova banca. La colonna `banca_codice` è conservata a scopo informativo
 * e per statistiche/filtri; l'unicità e l'upsert si basano su (utente_id,
 * voce_id), perché `voce_id` è già univoco a livello di piattaforma.
 *
 * `errori_tratti` NON è presente: le banche non hanno pratica di scrittura.
 */
class ProgressoBanca extends Model {
  toPublicJSON() {
    return {
      bancaCodice: this.banca_codice,
      voceId: this.voce_id,
      punteggio: this.punteggio,
      tentativi: this.tentativi,
      errori: this.errori,
      accuracy: this.tentativi > 0 ? (this.tentativi - this.errori) / this.tentativi : 1,
      tassoErrore: this.tentativi > 0 ? this.errori / this.tentativi : 0,
    };
  }
}

ProgressoBanca.init(
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

    // Codice della banca dati (es. 'webdev'). Informativo: consente statistiche
    // per materia/banca senza dover risalire dal dizionario.
    banca_codice: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'banca_codice',
      validate: {
        notEmpty: { msg: 'Il codice della banca non può essere vuoto' },
      },
    },

    // Identificatore univoco (globale) della voce. È la chiave del progresso.
    voce_id: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'voce_id',
      validate: {
        notEmpty: { msg: "L'identificatore della voce non può essere vuoto" },
      },
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

    tentativi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'I tentativi non possono essere negativi' },
        isInt: { msg: 'I tentativi devono essere un numero intero' },
      },
    },

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
    modelName: 'ProgressoBanca',
    tableName: 'progressi_banca',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità composita: un solo progresso per coppia utente/voce.
      // È anche la chiave usata dall'upsert (ON DUPLICATE KEY UPDATE).
      { unique: true, fields: ['utente_id', 'voce_id'], name: 'progressi_banca_utente_voce' },
      // Lookup rapido di tutti i progressi di un utente.
      { fields: ['utente_id'], name: 'progressi_banca_utente_id' },
      // Statistiche per banca (mastered/peggiori per banca).
      { fields: ['utente_id', 'banca_codice'], name: 'progressi_banca_utente_banca' },
      // Dashboard: mastered / da rivedere.
      { fields: ['utente_id', 'punteggio'], name: 'progressi_banca_utente_punteggio' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni: la cancellazione di un utente rimuove a cascata i progressi.
// ─────────────────────────────────────────────
ProgressoBanca.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(ProgressoBanca, { as: 'progressiBanca', foreignKey: 'utente_id', onDelete: 'CASCADE' });

ProgressoBanca.PUNTEGGIO_MIN = PUNTEGGIO_MIN;
ProgressoBanca.PUNTEGGIO_MAX = PUNTEGGIO_MAX;
ProgressoBanca.PUNTEGGIO_DEFAULT = PUNTEGGIO_DEFAULT;

module.exports = ProgressoBanca;
