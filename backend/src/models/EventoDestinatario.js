'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const EventoCalendario = require('./EventoCalendario');
const Classe = require('./Classe');
const Utente = require('./Utente');

/**
 * EventoDestinatario — destinatario di un evento di calendario.
 *
 * Rispecchia la modellazione di `CompitoAssegnazione`: un evento può essere
 * destinato a un'AULA (tutti i suoi membri correnti, studenti e insegnanti)
 * oppure a un SINGOLO studente. Esattamente uno tra `classe_id` e `utente_id`
 * è valorizzato (vincolo applicato nel service).
 *
 * I destinatari effettivi NON vengono materializzati riga per riga: l'insieme è
 * derivato dalle aule (membership corrente) unito ai destinatari diretti. Se
 * un'aula cambia composizione, la visibilità dell'evento si aggiorna da sola,
 * senza scritture a fan-out.
 */
class EventoDestinatario extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      eventoId: this.evento_id,
      classeId: this.classe_id,
      utenteId: this.utente_id,
      tipo: this.classe_id ? 'classe' : 'studente',
      aggiuntoDa: this.aggiunto_da,
      created_at: this.created_at,
    };
  }
}

EventoDestinatario.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    evento_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'evento_id',
    },

    // Destinatario aula (mutuamente esclusivo con utente_id).
    classe_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'classe_id',
    },

    // Destinatario singolo studente (mutuamente esclusivo con classe_id).
    utente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'utente_id',
    },

    aggiunto_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'aggiunto_da',
    },
  },
  {
    sequelize,
    modelName: 'EventoDestinatario',
    tableName: 'evento_destinatari',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Evita di destinare due volte lo stesso evento alla stessa aula.
      // (In MySQL più NULL sono considerati distinti: le righe con classe_id
      //  null — destinatari a studente — non collidono tra loro.)
      { unique: true, fields: ['evento_id', 'classe_id'], name: 'evento_dest_evento_classe' },
      // Evita di destinare due volte lo stesso evento allo stesso studente.
      { unique: true, fields: ['evento_id', 'utente_id'], name: 'evento_dest_evento_utente' },
      { fields: ['evento_id'], name: 'evento_dest_evento' },
      { fields: ['classe_id'], name: 'evento_dest_classe' },
      { fields: ['utente_id'], name: 'evento_dest_utente' },
    ],
  }
);

EventoDestinatario.belongsTo(EventoCalendario, { as: 'evento', foreignKey: 'evento_id', onDelete: 'CASCADE' });
EventoCalendario.hasMany(EventoDestinatario, { as: 'destinatari', foreignKey: 'evento_id', onDelete: 'CASCADE' });

EventoDestinatario.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(EventoDestinatario, { as: 'eventiDestinati', foreignKey: 'classe_id', onDelete: 'CASCADE' });

EventoDestinatario.belongsTo(Utente, { as: 'studente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(EventoDestinatario, { as: 'eventiDiretti', foreignKey: 'utente_id', onDelete: 'CASCADE' });

module.exports = EventoDestinatario;
