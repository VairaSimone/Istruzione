'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Classe = require('./Classe');

// Stati del ciclo di vita di un invito.
const STATI_INVITO = ['pendente', 'completato', 'revocato'];
// Ruoli che un invito può conferire (l'admin non si invita: si crea via seed).
const RUOLI_INVITABILI = ['studente', 'insegnante'];

/**
 * Invito — token a scadenza che abilita la registrazione di un singolo
 * utente con un ruolo predeterminato.
 *
 *   - invito STUDENTE  → creato da un insegnante (o admin), `classe` valorizzata;
 *   - invito INSEGNANTE → creato da un admin (onboarding diretto), `classe` null.
 *
 * Il token in chiaro è inviato SOLO via email; nel DB se ne salva l'hash
 * SHA-256 (come per gli altri token del sistema). La registrazione tramite
 * invito eredita email e (per gli studenti) classe da questo record:
 * l'utente non può sovrascriverle.
 */
class Invito extends Model {
  /** True se l'invito è ancora utilizzabile (pendente e non scaduto). */
  isUtilizzabile() {
    return this.stato === 'pendente' && new Date(this.scadenza) > new Date();
  }

  /** Dati esponibili al pannello di gestione (no token_hash). */
  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      ruolo: this.ruolo,
      classe: this.classe,
      classe_id: this.classe_id,
      stato: this.stato,
      scadenza: this.scadenza,
      invitato_da: this.invitato_da,
      utente_creato_id: this.utente_creato_id,
      created_at: this.created_at,
    };
  }
}

Invito.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: { msg: 'Formato email non valido' },
        notEmpty: { msg: "L'email non può essere vuota" },
      },
      set(value) {
        this.setDataValue('email', value ? value.toLowerCase().trim() : value);
      },
    },

    ruolo: {
      type: DataTypes.ENUM(...RUOLI_INVITABILI),
      allowNull: false,
      validate: {
        isIn: {
          args: [RUOLI_INVITABILI],
          msg: `Il ruolo dell'invito deve essere uno di: ${RUOLI_INVITABILI.join(', ')}`,
        },
      },
    },

    // Valorizzata SOLO per gli inviti studente.
    classe: {
      type: DataTypes.ENUM(...Utente.CLASSI_VALIDE),
      allowNull: true,
    },

    // Aula virtuale (facoltativa) a cui l'invito è legato: se valorizzata, al
    // completamento della registrazione lo studente vi viene iscritto.
    classe_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'classe_id',
    },

    // Hash SHA-256 (hex, 64 char) del token inviato via email.
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'token_hash',
    },

    stato: {
      type: DataTypes.ENUM(...STATI_INVITO),
      allowNull: false,
      defaultValue: 'pendente',
      validate: {
        isIn: {
          args: [STATI_INVITO],
          msg: `Lo stato dell'invito deve essere uno di: ${STATI_INVITO.join(', ')}`,
        },
      },
    },

    scadenza: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    // Autore dell'invito (insegnante per gli studenti, admin per gli insegnanti).
    invitato_da: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'invitato_da',
    },

    // Utente generato al completamento dell'invito.
    utente_creato_id: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'utente_creato_id',
    },
  },
  {
    sequelize,
    modelName: 'Invito',
    tableName: 'inviti',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['token_hash'] },
      { fields: ['email'] },
      { fields: ['stato'] },
      { fields: ['invitato_da'] },
      { fields: ['classe_id'] },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────
Invito.belongsTo(Utente, { as: 'invitante', foreignKey: 'invitato_da' });
Invito.belongsTo(Utente, { as: 'utenteCreato', foreignKey: 'utente_creato_id' });
Utente.hasMany(Invito, { as: 'invitiInviati', foreignKey: 'invitato_da' });

// Invito legato (facoltativamente) a un'aula: se l'aula viene eliminata il
// riferimento sull'invito viene azzerato (SET NULL), senza perdere l'invito.
Invito.belongsTo(Classe, { as: 'aula', foreignKey: 'classe_id', onDelete: 'SET NULL' });
Classe.hasMany(Invito, { as: 'inviti', foreignKey: 'classe_id', onDelete: 'SET NULL' });

Invito.STATI_INVITO = STATI_INVITO;
Invito.RUOLI_INVITABILI = RUOLI_INVITABILI;

module.exports = Invito;
