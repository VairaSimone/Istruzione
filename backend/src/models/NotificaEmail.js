'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const { CHIAVI_NOTIFICA, esiste: tipoNotificaEsiste } = require('../constants/tipiNotifica');

/**
 * NotificaEmail — CODA delle notifiche da recapitare via email.
 *
 * Ogni riga rappresenta UN evento destinato a UN utente (nuovo messaggio, nuovo
 * compito, scadenza in avvicinamento, feedback ricevuto). Le notifiche NON
 * vengono spedite subito: restano `in_attesa` finché lo scheduler non le
 * raccoglie in un DIGEST periodico (un'unica email di riepilogo), rispettando
 * il tetto massimo di email al giorno per utente.
 *
 * Ciclo di vita dello `stato`:
 *   - 'in_attesa' → generata, non ancora recapitata (finirà nel prossimo digest);
 *   - 'inviata'   → confluita in un digest spedito con successo;
 *   - 'annullata' → non più pertinente (es. l'evento è stato revocato) oppure
 *                   scartata perché l'utente ha disattivato quella categoria.
 *
 * IDEMPOTENZA (`riferimento_tipo` + `riferimento_id`):
 *   per gli eventi che devono generare AL PIÙ UNA notifica per destinatario
 *   (tipicamente la scadenza di un compito, valutata a ogni giro dello
 *   scheduler), il service verifica l'assenza di una riga con lo stesso
 *   riferimento prima di accodare. Così un compito in scadenza non produce una
 *   notifica a ogni tick.
 */
const STATI = ['in_attesa', 'inviata', 'annullata'];

class NotificaEmail extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      utenteId: this.utente_id,
      scuolaId: this.scuola_id,
      tipo: this.tipo,
      titolo: this.titolo,
      corpo: this.corpo,
      link: this.link,
      riferimentoTipo: this.riferimento_tipo,
      riferimentoId: this.riferimento_id,
      stato: this.stato,
      inviataIl: this.inviata_il,
      created_at: this.created_at,
    };
  }
}

NotificaEmail.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Destinatario della notifica. CASCADE: se l'utente sparisce, spariscono
    // anche le sue notifiche in coda.
    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // Tenant di appartenenza, usato per personalizzare il mittente/branding
    // dell'email di digest. Null per gli eventi generati da un admin trasversale.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // Tipo di evento (registro `constants/tipiNotifica.js`). Colonna STRING:
    // nuovi tipi senza migrazioni.
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: {
        appartieneAlRegistro(valore) {
          if (!tipoNotificaEsiste(valore)) {
            throw new Error(
              `Il tipo di notifica deve essere uno di: ${CHIAVI_NOTIFICA.join(', ')}`
            );
          }
        },
      },
    },

    // Titolo breve mostrato nella riga del digest (es. il nome del compito o
    // l'oggetto del messaggio).
    titolo: {
      type: DataTypes.STRING(200),
      allowNull: false,
      defaultValue: '',
    },

    // Riepilogo facoltativo (es. il mittente del messaggio, la data di scadenza).
    corpo: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },

    // URL del frontend a cui la riga del digest rimanda (es. il messaggio, il
    // compito). Percorso relativo o assoluto: il service lo antepone a
    // FRONTEND_URL se relativo.
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },

    // Coppia di idempotenza: entità di dominio a cui la notifica si riferisce.
    riferimento_tipo: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
      field: 'riferimento_tipo',
    },
    riferimento_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'riferimento_id',
    },

    stato: {
      type: DataTypes.ENUM(...STATI),
      allowNull: false,
      defaultValue: 'in_attesa',
      validate: {
        isIn: {
          args: [STATI],
          msg: `Lo stato deve essere uno di: ${STATI.join(', ')}`,
        },
      },
    },

    // Istante in cui la notifica è confluita in un digest spedito.
    inviata_il: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'inviata_il',
    },
  },
  {
    sequelize,
    modelName: 'NotificaEmail',
    tableName: 'notifiche_email',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Raccolta del digest: tutte le notifiche in attesa di un utente, in
      // ordine cronologico.
      { fields: ['utente_id', 'stato'], name: 'notifiche_email_utente_stato' },
      // Verifica di idempotenza prima dell'accodamento (scadenze compiti).
      {
        fields: ['riferimento_tipo', 'riferimento_id', 'tipo'],
        name: 'notifiche_email_riferimento',
      },
      { fields: ['stato'], name: 'notifiche_email_stato' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────
NotificaEmail.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(NotificaEmail, { as: 'notificheEmail', foreignKey: 'utente_id', onDelete: 'CASCADE' });

const Scuola = require('./Scuola');
NotificaEmail.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(NotificaEmail, { as: 'notificheEmail', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

NotificaEmail.STATI = STATI;

module.exports = NotificaEmail;
