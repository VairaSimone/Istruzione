'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const {
  applicaDefault,
  impostazioniPubbliche,
  funzionalitaDi,
} = require('../constants/impostazioniScuola');

// Lo slug identifica la scuola in modo leggibile e stabile negli URL pubblici
// (`GET /api/config?scuola=liceo-manzoni`). Minuscole, cifre e trattini.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 80;

// 1 GiB in byte. Le quote di storage si esprimono in GB verso l'esterno (più
// leggibili per l'admin) ma si PERSISTONO in byte, così il confronto con la
// somma di `file_caricati.dimensione_byte` è esatto e senza arrotondamenti.
const BYTE_PER_GB = 1024 * 1024 * 1024;

/** GB → byte. `null`/vuoto/non numerico ⇒ null (nessun limite). */
const gbABytes = (gb) => {
  if (gb === null || gb === undefined || gb === '') return null;
  const n = Number(gb);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * BYTE_PER_GB);
};

/** byte → GB (numero, per la vista). `null` resta `null`. */
const bytesAGb = (byte) => {
  if (byte === null || byte === undefined) return null;
  const n = Number(byte);
  if (!Number.isFinite(n)) return null;
  return n / BYTE_PER_GB;
};

/**
 * Genera uno slug a partire da un nome libero. Diacritici rimossi, spazi e
 * punteggiatura convertiti in trattini. Se il risultato è vuoto restituisce
 * `null`: il chiamante deve fornire uno slug esplicito.
 */
const slugifica = (testo) => {
  if (typeof testo !== 'string') return null;
  const s = testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove i segni diacritici
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
  return s === '' ? null : s;
};

/**
 * Scuola — TENANT della piattaforma.
 *
 * La piattaforma è GENERICA: nulla, qui dentro, presuppone una materia
 * insegnata. Una «scuola» è un qualsiasi ente di formazione (scuola pubblica,
 * accademia di lingue, centro professionale, azienda che eroga corsi interni).
 *
 * Ogni studente e ogni insegnante appartiene a una scuola (cfr. `Utente.scuola_id`);
 * aule, quiz, corsi, compiti e messaggi nascono legati alla scuola del loro
 * autore. Gli insegnanti vedono e operano SOLO entro la propria scuola; l'admin
 * (che NON appartiene ad alcuna scuola, `scuola_id = null`) ha piena visibilità.
 *
 * `impostazioni` è il blob JSON di configurazione del tenant: identità visiva
 * (nome, logo, favicon, colori, tema), contatti, social, footer, vocabolari
 * didattici e FUNZIONALITÀ ABILITATE. La sua forma è descritta in modo
 * dichiarativo da `constants/impostazioniScuola.js`: aggiungere un settaggio non
 * richiede migrazioni, le chiavi sconosciute sono ignorate in lettura e i
 * default vivono nell'applicazione.
 *
 * `slug` consente al frontend NON autenticato di risolvere il tenant (pagina di
 * login personalizzata) senza esporre gli UUID interni.
 *
 * `predefinita` marca la scuola servita da `GET /api/config` quando la richiesta
 * non indica alcun tenant: è il caso dei deploy MONO-SCUOLA, dove la piattaforma
 * ospita un solo ente e il frontend non deve preoccuparsi del multi-tenant.
 *
 * `attiva` permette di sospendere un tenant (branding non servito, accesso
 * negato) senza eliminarne i dati.
 */
class Scuola extends Model {
  /** Mappa risolta delle funzionalità abilitate per questa scuola. */
  get funzionalita() {
    return funzionalitaDi(this.impostazioni);
  }

  /** True se la sezione indicata è abilitata per questa scuola. */
  funzionalitaAttiva(chiave) {
    return Boolean(this.funzionalita[chiave]);
  }

  /**
   * Dati per lo STAFF e per il frontend autenticato: impostazioni COMPLETE,
   * con i default applicati a ogni chiave mancante.
   */
  toPublicJSON() {
    return {
      id: this.id,
      nome: this.nome,
      slug: this.slug,
      attiva: this.attiva,
      predefinita: this.predefinita,
      impostazioni: applicaDefault(this.impostazioni, this.nome),
      // Quote impostate dall'admin. `null` = illimitato. Lo storage è esposto sia
      // in byte (per i calcoli) sia in GB (per la UI).
      limiti: {
        storageByte:
          this.limite_storage_byte === null || this.limite_storage_byte === undefined
            ? null
            : Number(this.limite_storage_byte),
        storageGb: bytesAGb(this.limite_storage_byte),
        utenti:
          this.limite_utenti === null || this.limite_utenti === undefined
            ? null
            : Number(this.limite_utenti),
        insegnanti:
          this.limite_insegnanti === null || this.limite_insegnanti === undefined
            ? null
            : Number(this.limite_insegnanti),
      },
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Dati per il frontend NON autenticato (`GET /api/config`): solo l'identità
   * visiva e le funzionalità abilitate. Nessun vocabolario didattico, nessun
   * conteggio, nessun UUID di risorse interne.
   */
  toBrandingJSON() {
    return {
      id: this.id,
      slug: this.slug,
      nome: this.nome,
      impostazioni: impostazioniPubbliche(this.impostazioni, this.nome),
    };
  }
}

Scuola.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: {
        name: 'unique_scuola_nome',
        msg: 'Esiste già una scuola con questo nome',
      },
      validate: {
        notEmpty: { msg: 'Il nome della scuola non può essere vuoto' },
        len: { args: [2, 160], msg: 'Il nome della scuola deve avere tra 2 e 160 caratteri' },
      },
    },

    // Identificativo leggibile per gli URL pubblici. Derivato dal nome se non
    // fornito. Nullable a livello DB solo per le righe legacy: il service lo
    // valorizza sempre.
    slug: {
      type: DataTypes.STRING(SLUG_MAX),
      allowNull: true,
      defaultValue: null,
      unique: {
        name: 'unique_scuola_slug',
        msg: 'Esiste già una scuola con questo identificativo (slug)',
      },
      validate: {
        is: {
          args: SLUG_REGEX,
          msg: 'Lo slug può contenere solo lettere minuscole, cifre e trattini (es. liceo-manzoni)',
        },
      },
    },

    // Tenant sospendibile senza perdita di dati.
    attiva: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // Scuola servita dagli endpoint pubblici quando il tenant non è indicato.
    // L'unicità del flag è garantita dal service (una sola scuola predefinita).
    predefinita: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Configurazione del tenant. Schema in `constants/impostazioniScuola.js`.
    // In MySQL le colonne JSON non ammettono un DEFAULT a livello DB: il valore
    // di default `{}` è garantito da Sequelize.
    impostazioni: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    // ── QUOTE (impostate dall'admin; NULL = illimitato) ──
    // Spazio massimo occupabile dai file caricati (video/immagini/documenti),
    // in byte. Confrontato con SUM(file_caricati.dimensione_byte) per la scuola.
    limite_storage_byte: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: { args: [0], msg: 'Il limite di storage non può essere negativo' },
      },
    },

    // Numero massimo di utenti (studenti + insegnanti) della scuola.
    limite_utenti: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: { args: [0], msg: 'Il limite utenti non può essere negativo' },
      },
    },

    // Sotto-limite: numero massimo di insegnanti della scuola.
    limite_insegnanti: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: { args: [0], msg: 'Il limite insegnanti non può essere negativo' },
      },
    },
  },
  {
    sequelize,
    modelName: 'Scuola',
    tableName: 'scuole',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['nome'], name: 'scuole_nome' },
      { unique: true, fields: ['slug'], name: 'scuole_slug' },
      // Risoluzione del tenant predefinito in una sola lettura indicizzata.
      { fields: ['predefinita'], name: 'scuole_predefinita' },
      { fields: ['attiva'], name: 'scuole_attiva' },
    ],
  }
);

Scuola.SLUG_REGEX = SLUG_REGEX;
Scuola.SLUG_MAX = SLUG_MAX;
Scuola.slugifica = slugifica;
Scuola.BYTE_PER_GB = BYTE_PER_GB;
Scuola.gbABytes = gbABytes;
Scuola.bytesAGb = bytesAGb;

module.exports = Scuola;
