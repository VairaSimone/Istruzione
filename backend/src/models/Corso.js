'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

// Livello e materia del corso sono STRINGHE LIBERE, non ENUM: la piattaforma è
// generica e ogni scuola usa la propria scala ("A1", "Base", "Terzo anno") e le
// proprie materie ("Inglese", "Matematica", "Sicurezza sul lavoro"). I valori
// possono essere ristretti per tenant tramite
// `impostazioni.didattica.livelliDisponibili` / `materieDisponibili`.
const LIVELLO_MAX = 40;
const MATERIA_MAX = 80;

// Stato di pubblicazione del corso (coerente con lo stato dei compiti):
//   - 'bozza'      → visibile solo allo staff della scuola, non agli studenti;
//   - 'pubblicato' → attivo: gli studenti delle aule a cui è reso disponibile
//                    possono guardarlo quando vogliono;
//   - 'archiviato' → concluso/nascosto, resta nello storico.
const STATI_CORSO = ['bozza', 'pubblicato', 'archiviato'];

// Lunghezza massima per gli URL (copertina/video/documenti) esterni. Volutamente
// ampia. Da questa versione i contenuti possono essere CARICATI come file dal PC
// (cfr. FileCaricato) OPPURE, in alternativa, referenziati via URL esterno: le
// due strade convivono e i campi `*_url` restano supportati come fallback.
const URL_MAX = 2048;

// Riferimento HTTP(S) valido. La validazione fine (con express-validator) vive
// nel layer validators; qui c'è la difesa a livello modello.
const URL_REGEX = /^https?:\/\/.+/i;

/**
 * Corso — VIDEOLEZIONE ON-DEMAND (contenitore).
 *
 * Ogni corso appartiene a UNA scuola (tenant, `scuola_id`). I corsi di una
 * scuola non sono MAI visibili alle altre scuole: l'isolamento è garantito da
 *   1. lo `scuola_id` timbrato alla creazione;
 *   2. le query di lettura sempre limitate alla scuola del richiedente;
 *   3. il vincolo per cui un corso può essere reso disponibile SOLO ad aule
 *      della stessa scuola (cfr. CorsoAula), così gli studenti non possono
 *      raggiungere corsi di scuole diverse dalla propria.
 *
 * Il corso raccoglie più `capitoli` (ognuno con un video e/o documenti), e può
 * essere reso disponibile a una o più `aule` tramite la tabella ponte
 * `corso_aule`. Lo staff sceglie per ogni aula quali corsi rendere disponibili.
 *
 * `video_scaricabile` è la POLICY DI DOWNLOAD PREDEFINITA del corso: decide se,
 * per impostazione predefinita, gli studenti possono scaricare i video (oltre a
 * guardarli in streaming). Ogni capitolo può sovrascrivere questa scelta
 * (`Capitolo.scaricabile`); quando l'override è null, vale questo default.
 *
 * `creato_da` traccia l'autore (ownership debole: SET NULL se l'account sparisce;
 * il corso resta gestibile dagli altri insegnanti della scuola e dall'admin).
 */
class Corso extends Model {
  /** Dati esponibili al client (capitoli/aule sono aggiunti dal service). */
  toPublicJSON() {
    return {
      id: this.id,
      titolo: this.titolo,
      descrizione: this.descrizione,
      // Copertina: se caricata come file, il client la carica da
      // `/api/corsi/files/<copertinaFileId>`; in alternativa resta l'URL esterno.
      copertinaFileId: this.copertina_file_id,
      copertinaUrl: this.copertina_url,
      materia: this.materia,
      livello: this.livello,
      stato: this.stato,
      videoScaricabile: this.video_scaricabile,
      scuolaId: this.scuola_id,
      creatoDa: this.creato_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Corso.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    titolo: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il titolo del corso non può essere vuoto' },
        len: { args: [2, 160], msg: 'Il titolo del corso deve avere tra 2 e 160 caratteri' },
      },
    },

    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // URL dell'immagine di copertina esterna (facoltativo, alternativa al file).
    copertina_url: {
      type: DataTypes.STRING(URL_MAX),
      allowNull: true,
      defaultValue: null,
      field: 'copertina_url',
      validate: {
        is: {
          args: URL_REGEX,
          msg: "L'URL della copertina deve iniziare con http:// o https://",
        },
      },
    },

    // Immagine di copertina CARICATA come file (facoltativa, alternativa all'URL).
    // Riferimento a file_caricati; SET NULL se il file viene rimosso.
    copertina_file_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'copertina_file_id',
    },

    // Materia/categoria del corso (facoltativa, testo libero).
    materia: {
      type: DataTypes.STRING(MATERIA_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, MATERIA_MAX], msg: `La materia non può superare i ${MATERIA_MAX} caratteri` },
      },
    },

    // Livello prevalente del corso (facoltativo, testo libero).
    // La validazione contro il vocabolario della scuola avviene nel service.
    livello: {
      type: DataTypes.STRING(LIVELLO_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, LIVELLO_MAX], msg: `Il livello non può superare i ${LIVELLO_MAX} caratteri` },
      },
    },

    stato: {
      type: DataTypes.ENUM(...STATI_CORSO),
      allowNull: false,
      defaultValue: 'bozza',
      validate: {
        isIn: {
          args: [STATI_CORSO],
          msg: `Lo stato deve essere uno di: ${STATI_CORSO.join(', ')}`,
        },
      },
    },

    // Policy di download predefinita per i video del corso. Default: non
    // scaricabili (solo streaming). Sovrascrivibile per singolo capitolo.
    video_scaricabile: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'video_scaricabile',
    },

    // Scuola (tenant) del corso: timbrata alla creazione dalla scuola dell'autore.
    // Null solo per i corsi creati da un admin (trasversale). Nullable a livello
    // DB solo per compatibilità con eventuali record legacy: l'applicazione la
    // valorizza SEMPRE per i corsi creati da insegnanti.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // Autore del corso (ownership debole). SET NULL se l'account sparisce.
    creato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'creato_da',
    },
  },
  {
    sequelize,
    modelName: 'Corso',
    tableName: 'corsi',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Scope per tenant (scuola): elenco corsi di una scuola.
      { fields: ['scuola_id'], name: 'corsi_scuola_id' },
      { fields: ['creato_da'], name: 'corsi_creato_da' },
      { fields: ['stato'], name: 'corsi_stato' },
      { fields: ['livello'], name: 'corsi_livello' },
      { fields: ['materia'], name: 'corsi_materia' },
      { fields: ['copertina_file_id'], name: 'corsi_copertina_file_id' },
    ],
  }
);

Corso.belongsTo(Utente, { as: 'autore', foreignKey: 'creato_da', onDelete: 'SET NULL' });
Utente.hasMany(Corso, { as: 'corsiCreati', foreignKey: 'creato_da', onDelete: 'SET NULL' });

// Tenant del corso. CASCADE con la scuola (coerente con aule e compiti).
const Scuola = require('./Scuola');
Corso.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(Corso, { as: 'corsi', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

// Copertina caricata come file. SET NULL: rimuovere il file non elimina il corso.
const FileCaricato = require('./FileCaricato');
Corso.belongsTo(FileCaricato, {
  as: 'copertinaFile',
  foreignKey: 'copertina_file_id',
  onDelete: 'SET NULL',
});

Corso.LIVELLO_MAX = LIVELLO_MAX;
Corso.MATERIA_MAX = MATERIA_MAX;
Corso.STATI_CORSO = STATI_CORSO;
Corso.URL_MAX = URL_MAX;
Corso.URL_REGEX = URL_REGEX;

module.exports = Corso;
