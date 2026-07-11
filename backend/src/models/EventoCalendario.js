'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const { esiste: tipoEventoEsiste, CODICI_EVENTO } = require('../constants/tipiEvento');

// Pattern esadecimale per il colore opzionale (#RGB o #RRGGBB), coerente con
// quello già usato dalle aule (`Classe`).
const COLORE_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Lunghezza massima del link di videochiamata. I link di Meet/Zoom/Teams con
// token di sessione possono essere lunghi: teniamo un margine ampio.
const LINK_MAX = 2048;

/**
 * EventoCalendario — VOCE DI CALENDARIO creata da un insegnante (o admin).
 *
 * Rappresenta un appuntamento della piattaforma: una lezione, una riunione, una
 * verifica o — caso centrale della funzionalità — una VIDEOCHIAMATA raggiungibile
 * tramite un link esterno (Zoom, Google Meet, Teams…). L'evento è recapitato ai
 * destinatari tramite la tabella ponte `EventoDestinatario` (aula OPPURE singolo
 * studente), esattamente come i compiti: così lo stesso evento può raggiungere
 * più aule/studenti senza duplicazione.
 *
 * Le SCADENZE DEI COMPITI non sono duplicate qui: il feed del calendario le
 * deriva a runtime dai compiti pubblicati destinati all'utente (cfr.
 * `calendarioService.feedCalendario`). In calendario finiscono quindi due
 * sorgenti: gli eventi persistiti in questa tabella e i compiti già esistenti.
 *
 * Il `tipo` è una STRINGA validata contro `constants/tipiEvento.js` (nessun ENUM
 * di database): aggiungere un tipo non richiede migrazioni.
 */
class EventoCalendario extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      titolo: this.titolo,
      descrizione: this.descrizione,
      tipo: this.tipo,
      dataInizio: this.data_inizio,
      dataFine: this.data_fine,
      tuttoIlGiorno: this.tutto_il_giorno,
      luogo: this.luogo,
      linkVideochiamata: this.link_videochiamata,
      piattaformaVideochiamata: this.piattaforma_videochiamata,
      colore: this.colore,
      scuolaId: this.scuola_id,
      creatoDa: this.creato_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

EventoCalendario.init(
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
        notEmpty: { msg: "Il titolo dell'evento non può essere vuoto" },
        len: { args: [2, 160], msg: 'Il titolo deve avere tra 2 e 160 caratteri' },
      },
    },

    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Codice del tipo di evento (registro `constants/tipiEvento.js`).
    // Colonna STRING: nuovi tipi senza migrazioni.
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'lezione',
      validate: {
        appartieneAlRegistro(valore) {
          if (!tipoEventoEsiste(valore)) {
            throw new Error(`Il tipo di evento deve essere uno di: ${CODICI_EVENTO.join(', ')}`);
          }
        },
      },
    },

    // Inizio dell'evento (obbligatorio). Per gli eventi "tutto il giorno" conta
    // solo la parte data.
    data_inizio: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'data_inizio',
    },

    // Fine dell'evento (facoltativa). La coerenza `data_fine >= data_inizio` è
    // verificata nel service (dove abbiamo entrambi i valori normalizzati).
    data_fine: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'data_fine',
    },

    // Evento su intera giornata (senza orario puntuale).
    tutto_il_giorno: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'tutto_il_giorno',
    },

    // Luogo fisico opzionale (aula, indirizzo…). Il link online sta a parte.
    luogo: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, 200], msg: 'Il luogo non può superare i 200 caratteri' },
      },
    },

    // Link della videochiamata (Zoom, Meet, Teams…). Testo libero: non vincola
    // l'utente a un fornitore. La validazione di formato URL è nel validator.
    link_videochiamata: {
      type: DataTypes.STRING(LINK_MAX),
      allowNull: true,
      defaultValue: null,
      field: 'link_videochiamata',
      validate: {
        len: { args: [0, LINK_MAX], msg: `Il link non può superare i ${LINK_MAX} caratteri` },
      },
    },

    // Piattaforma rilevata dal link (zoom | meet | teams | webex | jitsi | altro).
    // Valorizzata dal service tramite `rilevaPiattaforma`; puramente informativa
    // per la UI (icona).
    piattaforma_videochiamata: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
      field: 'piattaforma_videochiamata',
    },

    // Colore identificativo opzionale (#RGB o #RRGGBB) per la UI.
    colore: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: null,
      validate: {
        is: {
          args: COLORE_REGEX,
          msg: 'Il colore deve essere un valore esadecimale valido (es. #4F46E5)',
        },
      },
    },

    // Scuola (tenant) dell'evento: timbrata alla creazione dalla scuola
    // dell'autore. Null solo per gli eventi creati da un admin (trasversale).
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // Insegnante autore dell'evento (ownership). SET NULL se l'account sparisce.
    creato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'creato_da',
    },
  },
  {
    sequelize,
    modelName: 'EventoCalendario',
    tableName: 'eventi_calendario',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      { fields: ['creato_da'], name: 'eventi_cal_creato_da' },
      { fields: ['scuola_id'], name: 'eventi_cal_scuola_id' },
      { fields: ['tipo'], name: 'eventi_cal_tipo' },
      // Filtro principale del feed: eventi in una finestra temporale.
      { fields: ['data_inizio'], name: 'eventi_cal_data_inizio' },
    ],
  }
);

EventoCalendario.belongsTo(Utente, { as: 'autore', foreignKey: 'creato_da', onDelete: 'SET NULL' });
Utente.hasMany(EventoCalendario, { as: 'eventiCreati', foreignKey: 'creato_da', onDelete: 'SET NULL' });

// Tenant dell'evento. CASCADE con la scuola (coerente con aule e compiti).
const Scuola = require('./Scuola');
EventoCalendario.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(EventoCalendario, { as: 'eventi', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

EventoCalendario.COLORE_REGEX = COLORE_REGEX;
EventoCalendario.LINK_MAX = LINK_MAX;

module.exports = EventoCalendario;
