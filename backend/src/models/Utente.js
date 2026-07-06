'use strict';

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

// Valori ammessi per la classe: immutabili e condivisi con i validator
const CLASSI_VALIDE = ['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta'];
const RUOLI_VALIDI = ['studente', 'insegnante', 'admin'];
const STATI_VALIDI = ['attivo', 'in_attesa', 'rifiutato'];
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
      stato: this.stato,
      scuola_id: this.scuola_id,
      lingua: this.lingua,
      email_verificata: this.email_verificata,
      profilo_completo: this.profilo_completo,
      created_at: this.created_at,
    };
  }
}

Utente.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, 
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
      // Reso opzionale a livello DB per consentire la registrazione
      // automatica via Google (profilo incompleto). La registrazione
      // classica continua a richiederla tramite i validator Express/Zod.
      allowNull: true,
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
      set(value) {
        this.setDataValue('email', value ? value.toLowerCase().trim() : value);
      },
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,

    },

    ruolo: {
      type: DataTypes.ENUM(...RUOLI_VALIDI),
      allowNull: false,
      defaultValue: 'studente',
      validate: {
        isIn: {
          args: [RUOLI_VALIDI],
          msg: `Il ruolo deve essere uno di: ${RUOLI_VALIDI.join(', ')}`,
        },
      },
    },

    // Stato dell'account: governa il ciclo di vita e l'approvazione.
    //   - 'attivo'     → l'account può autenticarsi normalmente;
    //   - 'in_attesa'  → candidatura insegnante NON ancora approvata: login negato;
    //   - 'rifiutato'  → candidatura respinta da un admin: login negato.
    // Gli studenti creati su invito e gli insegnanti creati/approvati dall'admin
    // nascono già 'attivo'.
    stato: {
      type: DataTypes.ENUM(...STATI_VALIDI),
      allowNull: false,
      defaultValue: 'attivo',
      validate: {
        isIn: {
          args: [STATI_VALIDI],
          msg: `Lo stato deve essere uno di: ${STATI_VALIDI.join(', ')}`,
        },
      },
    },

    // Messaggio facoltativo allegato alla candidatura insegnante, mostrato
    // all'admin nel pannello di approvazione.
    nota_candidatura: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: 'nota_candidatura',
    },

    classe: {
      type: DataTypes.ENUM(...CLASSI_VALIDE),
      // Reso opzionale a livello DB per la registrazione automatica via
      // Google. La registrazione classica continua a richiederla.
      allowNull: true,
      validate: {
        isIn: {
          args: [CLASSI_VALIDE],
          msg: `La classe deve essere una di: ${CLASSI_VALIDE.join(', ')}`,
        },
      },
    },

    // Tenant di appartenenza (scuola). Regole:
    //   - studenti e insegnanti appartengono SEMPRE a una scuola;
    //   - l'admin è trasversale alla piattaforma e ha `scuola_id = null`.
    // È il perno del multi-tenant: gli insegnanti vedono/operano solo entro la
    // propria scuola, l'admin su tutte. Nullable a livello DB per ospitare
    // l'admin (null) e gli eventuali account legacy pre-migrazione.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    email_verificata: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // L'hash SHA-256 (hex) di un token è SEMPRE lungo 64 caratteri: usare
    // STRING(64) invece di TEXT permette di indicizzare la colonna ed
    // eliminare il full table scan durante il lookup del refresh token.
    refresh_token: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: null,
    },

    // Identificativo univoco dell'account Google collegato (sub OIDC).
    // Null per gli account creati con email/password classica.
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'google_id',
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

    // false per gli account creati automaticamente via Google senza
    // età/classe: permette al frontend di richiedere il completamento profilo.
    profilo_completo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'profilo_completo',
    },

    // ─────────────────────────────────────────────
    // Statistiche di gioco globali (Quiz Kana)
    // Il livello NON è memorizzato: è derivato dagli XP con la formula
    //   livello = Math.floor(Math.sqrt(xp / 100)) + 1
    // (cfr. quizService.calcolaLivello), per evitare disallineamenti.
    // ─────────────────────────────────────────────

    // Punti esperienza totali accumulati.
    xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Gli XP non possono essere negativi' },
      },
    },

    // Giorni di studio consecutivi.
    streak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'La streak non può essere negativa' },
      },
    },

    // Streak record: massima striscia di giorni consecutivi mai raggiunta.
    // Monotòna crescente, usata dalla sezione streak per mostrare il primato
    // anche dopo che la streak corrente si è azzerata.
    streak_record: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'streak_record',
      validate: {
        min: { args: [0], msg: 'La streak record non può essere negativa' },
      },
    },

    // Ultima data di studio (solo data, niente orario): usata per calcolare
    // la continuità della streak. Normalizzata in UTC dal quizService.
    ultima_data_studio: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
      field: 'ultima_data_studio',
    },

    // Percentuale massima ottenuta in un singolo quiz (0-100).
    punteggio_record: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'punteggio_record',
      validate: {
        min: { args: [0], msg: 'Il punteggio record non può essere negativo' },
        max: { args: [100], msg: 'Il punteggio record non può superare 100' },
      },
    },

    // Numero di quiz completati (submit andati a buon fine). Alimenta i badge
    // "Primo quiz" / "Veterano".
    quiz_completati: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'quiz_completati',
      validate: {
        min: { args: [0], msg: 'Il numero di quiz completati non può essere negativo' },
      },
    },

    // Numero totale di tratti validati sul canvas di scrittura. Alimenta i
    // badge di scrittura ("Scrittore instancabile").
    tratti_validati: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'tratti_validati',
      validate: {
        min: { args: [0], msg: 'Il numero di tratti validati non può essere negativo' },
      },
    },

    // Contatore MONOTÒNO delle righe base di kana sbloccate (portate al
    // punteggio SRS massimo). Garantisce l'assegnazione una-tantum degli XP di
    // sblocco riga: non decresce mai, anche se una riga tornasse non completa.
    righe_sbloccate: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'righe_sbloccate',
      validate: {
        min: { args: [0], msg: 'Il numero di righe sbloccate non può essere negativo' },
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
      { fields: ['stato'] },
      // Indice sul tenant: filtro frequente per scuola (scope insegnante).
      { fields: ['scuola_id'] },
      // Indice sul refresh token: elimina il full table scan durante il
      // lookup eseguito ad ogni refresh della sessione.
      { fields: ['refresh_token'] },
      // Indice sul google_id: lookup rapido in fase di login OAuth.
      { fields: ['google_id'] },
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

// ─────────────────────────────────────────────
// Associazione tenant (scuola)
// RESTRICT: una scuola non può essere eliminata finché ha utenti collegati
// (protegge l'integrità del tenant).
// ─────────────────────────────────────────────
const Scuola = require('./Scuola');
Utente.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'RESTRICT' });
Scuola.hasMany(Utente, { as: 'utenti', foreignKey: 'scuola_id', onDelete: 'RESTRICT' });

Utente.CLASSI_VALIDE = CLASSI_VALIDE;
Utente.RUOLI_VALIDI = RUOLI_VALIDI;
Utente.STATI_VALIDI = STATI_VALIDI;

module.exports = Utente;
