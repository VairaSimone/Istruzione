'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Messaggio = require('./Messaggio');
const Utente = require('./Utente');

/**
 * MessaggioDestinatario — recapito di un messaggio a UN destinatario, con il
 * suo stato di lettura.
 *
 * Un messaggio a singolo studente genera una riga; un messaggio a un'aula ne
 * genera una per ogni studente (fan-out), così ciascuno ha il proprio stato di
 * "letto". Le note private non hanno destinatari. Il conteggio delle notifiche
 * (messaggi non letti) è un semplice COUNT su `(utente_id, letto=false)`.
 *
 * Vincolo di unicità (messaggio_id + utente_id): un destinatario compare una
 * sola volta per messaggio.
 */
class MessaggioDestinatario extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      messaggioId: this.messaggio_id,
      utenteId: this.utente_id,
      letto: this.letto,
      lettoIl: this.letto_il,
      created_at: this.created_at,
    };
  }
}

MessaggioDestinatario.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    messaggio_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'messaggio_id',
    },

    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    letto: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    letto_il: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'letto_il',
    },
  },
  {
    sequelize,
    modelName: 'MessaggioDestinatario',
    tableName: 'messaggio_destinatari',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { unique: true, fields: ['messaggio_id', 'utente_id'], name: 'messaggio_dest_messaggio_utente' },
      // Inbox di un utente + filtro/conteggio dei non letti (notifiche).
      { fields: ['utente_id', 'letto'], name: 'messaggio_dest_utente_letto' },
      { fields: ['messaggio_id'], name: 'messaggio_dest_messaggio' },
    ],
  }
);

MessaggioDestinatario.belongsTo(Messaggio, { as: 'messaggio', foreignKey: 'messaggio_id', onDelete: 'CASCADE' });
Messaggio.hasMany(MessaggioDestinatario, { as: 'destinatari', foreignKey: 'messaggio_id', onDelete: 'CASCADE' });

MessaggioDestinatario.belongsTo(Utente, { as: 'destinatario', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(MessaggioDestinatario, { as: 'messaggiRicevuti', foreignKey: 'utente_id', onDelete: 'CASCADE' });

module.exports = MessaggioDestinatario;
