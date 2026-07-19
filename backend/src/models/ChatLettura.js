'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Classe = require('./Classe');

/**
 * ChatLettura — MARCATORE di lettura di un MEMBRO su una CHAT d'aula.
 *
 * Perché un marcatore e non una riga di lettura per messaggio: in un gruppo il
 * flusso può essere fittissimo. Tenere lo stato «letto» per (messaggio ×
 * membro) genererebbe migliaia di righe e un fan-out a ogni invio. Basta invece
 * ricordare, per ciascun membro, FINO A QUANDO ha letto (`ultimo_letto_il`): i
 * non letti sono i messaggi dell'aula più recenti di quella soglia e non scritti
 * da lui.
 *
 *   nonLetti(utente, aula) =
 *     COUNT(messaggi_chat
 *           WHERE classe_id = aula
 *             AND eliminato = false
 *             AND mittente_id <> utente
 *             AND created_at > ultimo_letto_il)   // (tutti, se soglia null)
 *
 * `ultimo_letto_il = null` significa «mai aperta»: tutti i messaggi contano come
 * non letti. La riga viene creata/aggiornata (upsert) quando il membro apre la
 * chat o invia un messaggio (leggendo implicitamente fino a quel punto).
 *
 * Unicità (classe_id + utente_id): un solo marcatore per membro per aula.
 * CASCADE su aula e utente: niente marcatori orfani.
 */
class ChatLettura extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      classeId: this.classe_id,
      utenteId: this.utente_id,
      ultimoLettoIl: this.ultimo_letto_il,
    };
  }
}

ChatLettura.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    classe_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'classe_id',
    },

    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // Momento fino al quale il membro ha letto la chat. Null = mai aperta.
    ultimo_letto_il: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'ultimo_letto_il',
    },
  },
  {
    sequelize,
    modelName: 'ChatLettura',
    tableName: 'chat_letture',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Un solo marcatore per membro per aula. È anche la chiave dell'upsert.
      { unique: true, fields: ['classe_id', 'utente_id'], name: 'chat_letture_classe_utente' },
      // «Le mie chat»: tutti i marcatori di un utente (per il conteggio globale).
      { fields: ['utente_id'], name: 'chat_letture_utente' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────
ChatLettura.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(ChatLettura, { as: 'lettureChat', foreignKey: 'classe_id', onDelete: 'CASCADE' });

ChatLettura.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(ChatLettura, { as: 'lettureChat', foreignKey: 'utente_id', onDelete: 'CASCADE' });

module.exports = ChatLettura;
