'use strict';

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

// Valori ammessi per la classe: immutabili e condivisi con i validator
const CLASSI_VALIDE = ['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta'];
const RUOLI_VALIDI = ['studente', 'insegnante'];
const LINGUE_VALIDE = ['it', 'en'];
class Utente extends Model {
  /**
   * Verifica se la password fornita corrisponde all'hash salvato.
   * Usato nel servizio di autenticazione.
   */
  async verificaPassword(passwordInChiaro) {
    return bcrypt.compare(passwordInChiaro, this.password);
  }

  /**
   * Restituisce i dati pubblici dell'utente (senza campi sensibili).
   * Chiamato quando si invia la risposta al client.
   */
  toPublicJSON() {
    return {
      id: this.id,
      nome: this.nome,
      cognome: this.cognome,
      eta: this.eta,
      email: this.email,
      ruolo: this.ruolo,
      classe: this.classe,
      lingua: this.lingua,
      email_verificata: this.email_verificata,
      created_at: this.created_at,
    };
  }
}

Utente.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Genera automaticamente un UUIDv4 univoco
      primaryKey: true,
    },

    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il nome non può essere vuoto' },
        len: { args: [2, 100], msg: 'Il nome deve avere tra 2 e 100 caratteri' },
      },
    },

    cognome: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il cognome non può essere vuoto' },
        len: { args: [2, 100], msg: 'Il cognome deve avere tra 2 e 100 caratteri' },
      },
    },

    eta: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      validate: {
        min: { args: [14], msg: 'L\'età minima è 14 anni' },
        max: { args: [99], msg: 'L\'età massima è 99 anni' },
        isInt: { msg: 'L\'età deve essere un numero intero' },
      },
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'unique_email',
        msg: 'Questa email è già registrata',
      },
      validate: {
        isEmail: { msg: 'Formato email non valido' },
        notEmpty: { msg: 'L\'email non può essere vuota' },
      },
      // Salva sempre in minuscolo
      set(value) {
        this.setDataValue('email', value ? value.toLowerCase().trim() : value);
      },
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // Non restituire mai la password nelle query di default
      // (la escludiamo esplicitamente nelle query sensibili)
    },

    ruolo: {
      type: DataTypes.ENUM(...RUOLI_VALIDI),
      allowNull: false,
      defaultValue: 'studente', // Impostato automaticamente alla registrazione
      validate: {
        isIn: {
          args: [RUOLI_VALIDI],
          msg: `Il ruolo deve essere uno di: ${RUOLI_VALIDI.join(', ')}`,
        },
      },
    },

    classe: {
      type: DataTypes.ENUM(...CLASSI_VALIDE),
      allowNull: false,
      validate: {
        isIn: {
          args: [CLASSI_VALIDE],
          msg: `La classe deve essere una di: ${CLASSI_VALIDE.join(', ')}`,
        },
      },
    },

    email_verificata: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      // Campo sensibile, non includerlo nelle risposte pubbliche
    },

    reset_password_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'reset_password_token'
    },

    reset_password_expire: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'reset_password_expire'
    },

    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'email_verification_token'
    },

    email_verification_expire: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'email_verification_expire'
    },
    nuova_email_pendente: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'nuova_email_pendente'
    },
    token_version: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    tentativi_falliti: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    bloccato_fino_al: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lingua: {
      type: DataTypes.ENUM(...LINGUE_VALIDE),
      allowNull: false,
      defaultValue: 'it',
      validate: {
        isIn: {
          args: [LINGUE_VALIDE],
          msg: `La lingua deve essere una di: ${LINGUE_VALIDE.join(', ')}`,
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'Utente',
    tableName: 'utenti',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Indici per le colonne usate nelle query frequenti
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['reset_password_token'] },
      { fields: ['email_verification_token'] },
      { fields: ['ruolo'] },
    ],

    // Hook: hash della password prima di ogni INSERT/UPDATE
    hooks: {
      beforeCreate: async (utente) => {
        if (utente.password) {
          utente.password = await bcrypt.hash(utente.password, 12);
        }
      },
      beforeUpdate: async (utente) => {
        if (utente.changed('password')) {
          utente.password = await bcrypt.hash(utente.password, 12);
        }
      }
    }

  }
);

// Esportiamo anche le costanti per riutilizzarle nei validator
Utente.CLASSI_VALIDE = CLASSI_VALIDE;
Utente.RUOLI_VALIDI = RUOLI_VALIDI;

module.exports = Utente;
