'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Scuola = require('./Scuola');
const Utente = require('./Utente');
const {
  CODICI_TIPO,
  TIPO_DEFAULT,
  CODICI_STATO,
  STATO_DEFAULT,
} = require('../constants/tipiRichiestaContatto');

/**
 * RichiestaContatto — LEAD inviato dal FORM della homepage pubblica di una
 * scuola. Proviene da un visitatore NON autenticato: non è collegato ad alcun
 * `Utente` mittente (a differenza della messaggistica interna, riservata agli
 * account). È sempre legato alla SCUOLA destinataria (`scuola_id`), risolta dal
 * dominio o dal tenant indicato.
 *
 * Lo staff della scuola consulta e lavora le richieste (nuova → in gestione →
 * chiusa/spam). `gestita_da` traccia chi l'ha presa in carico.
 *
 * PRIVACY: qui vivono dati personali di terzi (nome, email, telefono). Non
 * memorizziamo l'IP grezzo del visitatore; `meta` conserva solo il contesto
 * tecnico non identificativo (dominio d'origine, tipo di provenienza).
 *
 * `tipo` e `stato` sono STRING validate a livello applicativo contro
 * `constants/tipiRichiestaContatto.js` (nessun ENUM di database).
 */
class RichiestaContatto extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      scuolaId: this.scuola_id,
      tipo: this.tipo,
      stato: this.stato,
      nome: this.nome,
      email: this.email,
      telefono: this.telefono,
      messaggio: this.messaggio,
      meta: this.meta || null,
      gestitaDa: this.gestita_da,
      noteInterne: this.note_interne,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

RichiestaContatto.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    scuola_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'scuole', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },

    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: TIPO_DEFAULT,
      validate: {
        isIn: {
          args: [CODICI_TIPO],
          msg: `Il tipo di richiesta deve essere uno tra: ${CODICI_TIPO.join(', ')}.`,
        },
      },
    },

    stato: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: STATO_DEFAULT,
      validate: {
        isIn: {
          args: [CODICI_STATO],
          msg: `Lo stato deve essere uno tra: ${CODICI_STATO.join(', ')}.`,
        },
      },
    },

    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il nome è obbligatorio.' },
        len: { args: [2, 160], msg: 'Il nome deve avere tra 2 e 160 caratteri.' },
      },
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: "L'email è obbligatoria." },
        isEmail: { msg: "L'email non è valida." },
      },
    },

    telefono: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
    },

    messaggio: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Contesto tecnico non identificativo (origine, dominio). Nessun IP grezzo.
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },

    // Membro dello staff che ha preso in carico la richiesta.
    gestita_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'utenti', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },

    note_interne: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'RichiestaContatto',
    tableName: 'richieste_contatto',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['scuola_id'], name: 'richieste_contatto_scuola_id' },
      { fields: ['stato'], name: 'richieste_contatto_stato' },
      // Elenco dello staff: filtra per scuola/stato ordinando per data.
      { fields: ['scuola_id', 'stato', 'created_at'], name: 'richieste_contatto_scuola_stato_data' },
      { fields: ['gestita_da'], name: 'richieste_contatto_gestita_da' },
    ],
  }
);

RichiestaContatto.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(RichiestaContatto, { as: 'richiesteContatto', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

RichiestaContatto.belongsTo(Utente, { as: 'gestore', foreignKey: 'gestita_da', onDelete: 'SET NULL' });

module.exports = RichiestaContatto;
