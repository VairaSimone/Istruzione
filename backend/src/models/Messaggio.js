'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Classe = require('./Classe');
const Compito = require('./Compito');

/**
 * Categoria semantica del messaggio:
 *   - 'messaggio'       → comunicazione ordinaria;
 *   - 'incoraggiamento' → messaggio motivazionale;
 *   - 'feedback'        → riscontro legato a un compito (`compito_id`);
 *   - 'nota_privata'    → appunto visibile SOLO all'autore (nessun destinatario).
 */
const TIPI_MESSAGGIO = ['messaggio', 'incoraggiamento', 'feedback', 'nota_privata'];

/**
 * Messaggio — unità di comunicazione interna.
 *
 * Un messaggio ha un mittente e (tranne le note private) uno o più destinatari,
 * modellati dalla tabella `MessaggioDestinatario` con stato di lettura per
 * destinatario. Un messaggio a un'AULA viene consegnato ai suoi studenti
 * correnti (fan-out alla creazione, così ogni studente ha il proprio stato di
 * lettura). Le RISPOSTE sono messaggi con `messaggio_padre_id` valorizzato.
 *
 * Riferimenti di contesto facoltativi: `classe_id` (broadcast d'aula),
 * `compito_id` (feedback su compito), `nota_su_utente_id` (studente a cui una
 * nota privata si riferisce).
 */
class Messaggio extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      tipo: this.tipo,
      oggetto: this.oggetto,
      corpo: this.corpo,
      mittenteId: this.mittente_id,
      classeId: this.classe_id,
      compitoId: this.compito_id,
      notaSuUtenteId: this.nota_su_utente_id,
      messaggioPadreId: this.messaggio_padre_id,
      consentiRisposte: this.consenti_risposte,
      created_at: this.created_at,
    };
  }
}

Messaggio.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    mittente_id: {
      type: DataTypes.UUID,
      allowNull: true, // SET NULL se l'autore viene rimosso
      defaultValue: null,
      field: 'mittente_id',
    },

    tipo: {
      type: DataTypes.ENUM(...TIPI_MESSAGGIO),
      allowNull: false,
      defaultValue: 'messaggio',
      validate: {
        isIn: {
          args: [TIPI_MESSAGGIO],
          msg: `Il tipo deve essere uno di: ${TIPI_MESSAGGIO.join(', ')}`,
        },
      },
    },

    oggetto: {
      type: DataTypes.STRING(160),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, 160], msg: "L'oggetto non può superare i 160 caratteri" },
      },
    },

    corpo: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il corpo del messaggio non può essere vuoto' },
      },
    },

    // Broadcast d'aula (contesto). Null per i messaggi a singolo studente.
    classe_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'classe_id',
    },

    // Compito di riferimento per i feedback.
    compito_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'compito_id',
    },

    // Studente a cui una nota privata si riferisce (facoltativo).
    nota_su_utente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'nota_su_utente_id',
    },

    // Threading: id del messaggio a cui questo risponde.
    messaggio_padre_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'messaggio_padre_id',
    },

    // Se false, i destinatari NON possono rispondere.
    consenti_risposte: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'consenti_risposte',
    },
  },
  {
    sequelize,
    modelName: 'Messaggio',
    tableName: 'messaggi',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { fields: ['mittente_id'], name: 'messaggi_mittente' },
      { fields: ['classe_id'], name: 'messaggi_classe' },
      { fields: ['compito_id'], name: 'messaggi_compito' },
      { fields: ['messaggio_padre_id'], name: 'messaggi_padre' },
      { fields: ['tipo'], name: 'messaggi_tipo' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────
Messaggio.belongsTo(Utente, { as: 'mittente', foreignKey: 'mittente_id', onDelete: 'SET NULL' });
Utente.hasMany(Messaggio, { as: 'messaggiInviati', foreignKey: 'mittente_id', onDelete: 'SET NULL' });

Messaggio.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'SET NULL' });
Messaggio.belongsTo(Compito, { as: 'compito', foreignKey: 'compito_id', onDelete: 'SET NULL' });
Messaggio.belongsTo(Utente, { as: 'notaSu', foreignKey: 'nota_su_utente_id', onDelete: 'SET NULL' });

// Threading (auto-referenza).
Messaggio.belongsTo(Messaggio, { as: 'padre', foreignKey: 'messaggio_padre_id', onDelete: 'SET NULL' });
Messaggio.hasMany(Messaggio, { as: 'risposte', foreignKey: 'messaggio_padre_id', onDelete: 'SET NULL' });

Messaggio.TIPI_MESSAGGIO = TIPI_MESSAGGIO;

module.exports = Messaggio;
