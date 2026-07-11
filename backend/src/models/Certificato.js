'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

// Stato del certificato:
//   - 'valido'   → certificato emesso e in corso di validità;
//   - 'revocato' → annullato dallo staff (resta nello storico, con motivo).
const STATI_CERTIFICATO = ['valido', 'revocato'];

// Lunghezza del codice pubblico di verifica (cfr. certificatoService.generaCodice).
const CODICE_LEN = 19; // es. "CERT-4F8K-2P9Q-7XZ1"

/**
 * Certificato — ATTESTATO DI FINE CORSO rilasciato da un insegnante (o admin)
 * a uno studente che ha completato il proprio percorso.
 *
 * Il certificato è SCARICABILE IN PDF e interamente PERSONALIZZABILE dalla
 * scuola (logo, colori, testi, firma): il modello vive nelle impostazioni del
 * tenant (`impostazioni.certificato`, cfr. constants/impostazioniScuola). Al
 * momento del rilascio il modello risolto e i valori stampati vengono
 * "congelati" nella colonna JSON `contenuto`: così un certificato già emesso
 * resta identico nel tempo anche se la scuola cambia in seguito il proprio
 * modello. Il PDF non è persistito su disco: è rigenerato on-demand dallo
 * snapshot, sempre uguale a sé stesso.
 *
 * ISOLAMENTO TRA SCUOLE: `scuola_id` timbra il tenant proprietario. Un
 * insegnante può rilasciare certificati solo a studenti delle proprie aule e li
 * vede solo entro la propria scuola; lo studente vede solo i propri.
 *
 * VERIFICA PUBBLICA: ogni certificato ha un `codice` univoco, opzionalmente
 * stampato sul PDF, con cui chiunque può verificarne l'autenticità tramite
 * l'endpoint pubblico `GET /api/certificati/verifica/:codice` (nessun dato
 * sensibile esposto: solo stato, nome, corso, scuola e date).
 *
 * `corso_id` è FACOLTATIVO: il "percorso" completato può non coincidere con un
 * singolo Corso della piattaforma. Quando manca, `nome_corso` (testo libero)
 * descrive il percorso. SET NULL se il corso viene poi eliminato: lo storico
 * del certificato non si rompe (il nome resta nello snapshot).
 */
class Certificato extends Model {
  /** Dati completi esponibili allo staff e allo studente proprietario. */
  toPublicJSON() {
    return {
      id: this.id,
      codice: this.codice,
      scuolaId: this.scuola_id,
      utenteId: this.utente_id,
      corsoId: this.corso_id,
      rilasciatoDa: this.rilasciato_da,
      titolo: this.titolo,
      nomeStudente: this.nome_studente,
      nomeCorso: this.nome_corso,
      esito: this.esito,
      dataCompletamento: this.data_completamento,
      stato: this.stato,
      motivoRevoca: this.motivo_revoca,
      revocatoDa: this.revocato_da,
      revocatoIl: this.revocato_il,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /** Vista PUBBLICA e minimale per l'endpoint di verifica (nessun id interno). */
  toVerificaJSON({ nomeScuola = null } = {}) {
    return {
      codice: this.codice,
      valido: this.stato === 'valido',
      stato: this.stato,
      titolo: this.titolo,
      nomeStudente: this.nome_studente,
      nomeCorso: this.nome_corso,
      esito: this.esito,
      scuola: nomeScuola,
      dataCompletamento: this.data_completamento,
      dataRilascio: this.created_at,
    };
  }
}

Certificato.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Codice pubblico univoco per la verifica. Generato dal service.
    codice: {
      type: DataTypes.STRING(CODICE_LEN),
      allowNull: false,
      unique: { name: 'certificati_codice_unico', msg: 'Codice certificato già in uso' },
    },

    // Studente destinatario del certificato.
    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // Corso completato (facoltativo: il percorso può essere a testo libero).
    corso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'corso_id',
    },

    // Insegnante che ha rilasciato il certificato (ownership debole).
    rilasciato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'rilasciato_da',
    },

    // Scuola (tenant). Null solo per i certificati emessi da un admin trasversale.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // ── Snapshot dei valori stampati (congelati al rilascio) ──
    titolo: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il titolo del certificato non può essere vuoto' },
        len: { args: [1, 200], msg: 'Il titolo non può superare i 200 caratteri' },
      },
    },

    nome_studente: {
      type: DataTypes.STRING(220),
      allowNull: false,
      field: 'nome_studente',
      validate: {
        notEmpty: { msg: 'Il nome dello studente non può essere vuoto' },
      },
    },

    nome_corso: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
      field: 'nome_corso',
    },

    // Esito/voto libero (es. "Superato con lode", "90/100").
    esito: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: null,
    },

    // Data in cui lo studente ha completato il percorso (solo data, no orario).
    data_completamento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'data_completamento',
    },

    // Snapshot COMPLETO del modello risolto + valori: consente di rigenerare il
    // PDF sempre identico, a prescindere da modifiche successive del modello.
    contenuto: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    stato: {
      type: DataTypes.ENUM(...STATI_CERTIFICATO),
      allowNull: false,
      defaultValue: 'valido',
      validate: {
        isIn: {
          args: [STATI_CERTIFICATO],
          msg: `Lo stato deve essere uno di: ${STATI_CERTIFICATO.join(', ')}`,
        },
      },
    },

    // ── Revoca (valorizzati solo quando stato = 'revocato') ──
    motivo_revoca: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'motivo_revoca',
    },

    revocato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'revocato_da',
    },

    revocato_il: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'revocato_il',
    },
  },
  {
    sequelize,
    modelName: 'Certificato',
    tableName: 'certificati',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { unique: true, fields: ['codice'], name: 'certificati_codice_unico' },
      { fields: ['scuola_id'], name: 'certificati_scuola_id' },
      { fields: ['utente_id'], name: 'certificati_utente_id' },
      { fields: ['corso_id'], name: 'certificati_corso_id' },
      { fields: ['rilasciato_da'], name: 'certificati_rilasciato_da' },
      { fields: ['stato'], name: 'certificati_stato' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────

// Studente destinatario. CASCADE: eliminando l'utente spariscono i suoi certificati.
Certificato.belongsTo(Utente, { as: 'studente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(Certificato, { as: 'certificati', foreignKey: 'utente_id', onDelete: 'CASCADE' });

// Insegnante emittente (ownership debole). SET NULL se l'account sparisce.
Certificato.belongsTo(Utente, { as: 'emittente', foreignKey: 'rilasciato_da', onDelete: 'SET NULL' });
Utente.hasMany(Certificato, { as: 'certificatiRilasciati', foreignKey: 'rilasciato_da', onDelete: 'SET NULL' });

// Corso completato (facoltativo). SET NULL: lo snapshot conserva comunque il nome.
const Corso = require('./Corso');
Certificato.belongsTo(Corso, { as: 'corso', foreignKey: 'corso_id', onDelete: 'SET NULL' });
Corso.hasMany(Certificato, { as: 'certificati', foreignKey: 'corso_id', onDelete: 'SET NULL' });

// Tenant. CASCADE con la scuola (coerente con corsi, aule, eventi).
const Scuola = require('./Scuola');
Certificato.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(Certificato, { as: 'certificati', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

Certificato.STATI_CERTIFICATO = STATI_CERTIFICATO;
Certificato.CODICE_LEN = CODICE_LEN;

module.exports = Certificato;
