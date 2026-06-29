'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

/**
 * BadgeUtente — badge/obiettivi sbloccati da un utente.
 *
 * Una riga = un badge sbloccato. Lo sblocco è una sola volta per coppia
 * (utente, badge): l'unicità composita su (utente_id, badge_code) rende
 * l'inserimento idempotente anche in presenza di richieste concorrenti
 * (insert con `ignoreDuplicates`).
 *
 * Si memorizza SOLO il codice stabile del badge (es. 'MAESTRO_HIRAGANA'): il
 * nome e la descrizione localizzati vivono nel frontend (i18n). Il campo
 * `created_at` funge da data di sblocco.
 */
class BadgeUtente extends Model {
  /** Dati esponibili al client. */
  toPublicJSON() {
    return {
      codice: this.badge_code,
      dataSblocco: this.created_at,
    };
  }
}

BadgeUtente.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Proprietario del badge.
    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // Codice stabile del badge (cfr. constants/badges.js).
    badge_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'badge_code',
      validate: {
        notEmpty: { msg: 'Il codice del badge non può essere vuoto' },
      },
    },
  },
  {
    sequelize,
    modelName: 'BadgeUtente',
    tableName: 'badge_utente',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità composita: un solo record per coppia utente/badge.
      // È anche la chiave che garantisce l'idempotenza dello sblocco.
      { unique: true, fields: ['utente_id', 'badge_code'], name: 'badge_utente_utente_codice' },
      // Lookup rapido di tutti i badge di un utente (profilo).
      { fields: ['utente_id'], name: 'badge_utente_utente_id' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
//   La cancellazione di un utente rimuove a cascata i suoi badge.
// ─────────────────────────────────────────────
BadgeUtente.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(BadgeUtente, { as: 'badge', foreignKey: 'utente_id', onDelete: 'CASCADE' });

module.exports = BadgeUtente;
