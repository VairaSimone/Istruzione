'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Compito = require('./Compito');
const Classe = require('./Classe');
const Utente = require('./Utente');

/**
 * CompitoAssegnazione — destinatario di un compito.
 *
 * Un compito può essere assegnato a un'AULA (tutti i suoi studenti correnti)
 * oppure a un SINGOLO studente. Esattamente uno tra `classe_id` e `utente_id`
 * è valorizzato (vincolo applicato nel service). Modellare l'assegnazione come
 * tabella dedicata — invece di mettere gli id sul compito — permette di
 * assegnare lo stesso compito a più aule/studenti senza duplicare il compito.
 *
 * Gli studenti destinatari NON vengono materializzati riga per riga: l'insieme
 * è derivato dalle aule (membership corrente) unito agli studenti diretti. In
 * questo modo, se un'aula cambia composizione, i destinatari si aggiornano
 * automaticamente senza scritture a fan-out.
 */
class CompitoAssegnazione extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      compitoId: this.compito_id,
      classeId: this.classe_id,
      utenteId: this.utente_id,
      tipo: this.classe_id ? 'classe' : 'studente',
      assegnatoDa: this.assegnato_da,
      created_at: this.created_at,
    };
  }
}

CompitoAssegnazione.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    compito_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'compito_id',
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

    assegnato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'assegnato_da',
    },
  },
  {
    sequelize,
    modelName: 'CompitoAssegnazione',
    tableName: 'compito_assegnazioni',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Evita di assegnare due volte lo stesso compito alla stessa aula.
      // (In MySQL più NULL sono considerati distinti: le righe con classe_id
      //  null — cioè le assegnazioni a studente — non collidono tra loro.)
      { unique: true, fields: ['compito_id', 'classe_id'], name: 'compito_assegn_compito_classe' },
      // Evita di assegnare due volte lo stesso compito allo stesso studente.
      { unique: true, fields: ['compito_id', 'utente_id'], name: 'compito_assegn_compito_utente' },
      { fields: ['compito_id'], name: 'compito_assegn_compito' },
      { fields: ['classe_id'], name: 'compito_assegn_classe' },
      { fields: ['utente_id'], name: 'compito_assegn_utente' },
    ],
  }
);

CompitoAssegnazione.belongsTo(Compito, { as: 'compito', foreignKey: 'compito_id', onDelete: 'CASCADE' });
Compito.hasMany(CompitoAssegnazione, { as: 'assegnazioni', foreignKey: 'compito_id', onDelete: 'CASCADE' });

CompitoAssegnazione.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(CompitoAssegnazione, { as: 'compitiAssegnati', foreignKey: 'classe_id', onDelete: 'CASCADE' });

CompitoAssegnazione.belongsTo(Utente, { as: 'studente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(CompitoAssegnazione, { as: 'assegnazioniDirette', foreignKey: 'utente_id', onDelete: 'CASCADE' });

module.exports = CompitoAssegnazione;
