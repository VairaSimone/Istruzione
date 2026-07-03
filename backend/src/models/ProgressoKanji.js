'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

// Livelli JLPT tracciati (dal più facile al più difficile).
const LIVELLI_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'];

// Range del punteggio SRS del singolo carattere (identico a ProgressoKana per
// riusare senza modifiche il motore SRS del quiz).
//   0 = appena sbagliato/sconosciuto · 3 = neutro (default) · 5 = padroneggiato.
const PUNTEGGIO_MIN = 0;
const PUNTEGGIO_MAX = 5;
const PUNTEGGIO_DEFAULT = 3;

/**
 * ProgressoKanji — SRS per singolo KANJI, gemello di `ProgressoKana`.
 *
 * Traccia, per ogni utente e per ogni kanji, lo stesso punteggio di conoscenza
 * 0–5 usato per i kana, così la generazione del pool e l'aggiornamento del
 * quiz condividono l'identico motore SRS (nessuna duplicazione di logica):
 *   - il pool pesca prima i kanji con punteggio < 3 (da rivedere);
 *   - ad ogni risposta corretta il punteggio sale (max 5), ad ogni errore
 *     scende (min 0).
 *
 * NOTA DI PROGETTAZIONE (campi SRS)
 * ---------------------------------
 * Il progetto NON usa uno scheduler SM-2 (easinessFactor/interval/repetitions/
 * nextReview): il suo SRS è il modello a punteggio 0–5 di `ProgressoKana`.
 * Per coerenza architetturale e per riusare il motore esistente senza
 * introdurre campi non utilizzati, `ProgressoKanji` adotta lo STESSO schema
 * (`punteggio`, `tentativi`, `errori`, `errori_tratti`). L'`accuracy` richiesta
 * è esposta come valore DERIVATO in `toPublicJSON` (1 − errori/tentativi).
 * L'eventuale passaggio a uno scheduler SM-2 completo aggiungerebbe qui le
 * relative colonne, in modo isolato e retrocompatibile.
 *
 * Vincolo di unicità composito (utente_id + kanji): un solo record per coppia
 * utente/kanji. È anche la chiave usata dall'upsert (ON DUPLICATE KEY UPDATE).
 */
class ProgressoKanji extends Model {
  /** Dati esponibili al client (allineati a ProgressoKana + livello/accuracy). */
  toPublicJSON() {
    return {
      kanji: this.kanji,
      livelloJLPT: this.livello_jlpt,
      punteggio: this.punteggio,
      tentativi: this.tentativi,
      errori: this.errori,
      erroriTratti: this.errori_tratti,
      // Accuratezza risposte (0..1); 1 se non ancora tentato (nessun errore).
      accuracy: this.tentativi > 0 ? (this.tentativi - this.errori) / this.tentativi : 1,
      // Tasso di errore nelle risposte (0..1); 0 se non ancora tentato.
      tassoErrore: this.tentativi > 0 ? this.errori / this.tentativi : 0,
    };
  }
}

ProgressoKanji.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Proprietario del progresso.
    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // L'ideogramma (singolo code point, ma alcuni kanji sono su piano
    // supplementare ⇒ 2 code unit UTF-16: STRING(8) come per i kana).
    kanji: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il kanji non può essere vuoto' },
      },
    },

    // Livello JLPT del kanji (memorizzato per filtraggio/visualizzazione).
    livello_jlpt: {
      type: DataTypes.ENUM(...LIVELLI_JLPT),
      allowNull: false,
      field: 'livello_jlpt',
      validate: {
        isIn: {
          args: [LIVELLI_JLPT],
          msg: `Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`,
        },
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

    // ─────────────────────────────────────────────
    // Statistiche di errore (Caratteri problematici / Allenamento Intensivo),
    // identiche a ProgressoKana: contatori MONOTÒNI a vita per carattere.
    // ─────────────────────────────────────────────

    // Numero totale di volte in cui il kanji è stato proposto in un quiz.
    tentativi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'I tentativi non possono essere negativi' },
        isInt: { msg: 'I tentativi devono essere un numero intero' },
      },
    },

    // Numero di risposte ERRATE al kanji nei quiz (≤ tentativi).
    errori: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Gli errori non possono essere negativi' },
        isInt: { msg: 'Gli errori devono essere un numero intero' },
      },
    },

    // Errori di ORDINE DEI TRATTI negli esercizi di scrittura su canvas.
    errori_tratti: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'errori_tratti',
      validate: {
        min: { args: [0], msg: 'Gli errori di tratto non possono essere negativi' },
        isInt: { msg: 'Gli errori di tratto devono essere un numero intero' },
      },
    },
  },
  {
    sequelize,
    modelName: 'ProgressoKanji',
    tableName: 'progressi_kanji',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità composita: un solo progresso per coppia utente/kanji.
      // È anche la chiave usata dall'upsert (ON DUPLICATE KEY UPDATE).
      { unique: true, fields: ['utente_id', 'kanji'], name: 'progressi_kanji_utente_kanji' },
      // Lookup rapido di tutti i progressi di un utente.
      { fields: ['utente_id'], name: 'progressi_kanji_utente_id' },
      // Indice composito per le query della dashboard (mastered / peggiori).
      { fields: ['utente_id', 'punteggio'], name: 'progressi_kanji_utente_punteggio' },
      // Filtraggio dei caratteri problematici per errori.
      { fields: ['utente_id', 'errori'], name: 'progressi_kanji_utente_errori' },
      // Filtraggio per livello JLPT (statistiche/selezione per livello).
      { fields: ['utente_id', 'livello_jlpt'], name: 'progressi_kanji_utente_livello' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
//   La cancellazione di un utente rimuove a cascata i suoi progressi.
// ─────────────────────────────────────────────
ProgressoKanji.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(ProgressoKanji, { as: 'progressiKanji', foreignKey: 'utente_id', onDelete: 'CASCADE' });

ProgressoKanji.LIVELLI_JLPT = LIVELLI_JLPT;
ProgressoKanji.PUNTEGGIO_MIN = PUNTEGGIO_MIN;
ProgressoKanji.PUNTEGGIO_MAX = PUNTEGGIO_MAX;
ProgressoKanji.PUNTEGGIO_DEFAULT = PUNTEGGIO_DEFAULT;

module.exports = ProgressoKanji;
