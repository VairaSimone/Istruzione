'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Classe = require('./Classe');
const FileCaricato = require('./FileCaricato');

/**
 * MessaggioChat — un messaggio della CHAT DI GRUPPO di un'AULA.
 *
 * A differenza della messaggistica interna (`Messaggio` + `MessaggioDestinatario`,
 * pensata come CASELLA DI POSTA docente → studente con stato di lettura per
 * destinatario), la chat d'aula è un FEED CONDIVISO: tutti i membri dell'aula
 * (studenti E insegnanti, via `ClasseUtente`) leggono lo stesso flusso e vi
 * scrivono liberamente, come in un gruppo. Non c'è fan-out per destinatario: il
 * feed è uno solo, filtrato per `classe_id`; lo stato «letto/non letto» è un
 * marcatore per membro (`ChatLettura.ultimo_letto_il`), non una riga per
 * messaggio — così una chat affollata non genera N righe di lettura a messaggio.
 *
 * Un messaggio ha SEMPRE almeno uno tra `corpo` (testo) e `file_id` (allegato):
 * il vincolo è garantito dal service e dai validator (i CHECK con espressioni
 * non sono portabili su tutti i dialetti, quindi non lo si affida al DB).
 *
 * ELIMINAZIONE SOFT: un messaggio eliminato resta in tabella con `eliminato=true`
 * (continuità del feed e audit), ma l'API ne oscura corpo e allegato. Il binario
 * dell'eventuale allegato viene invece rimosso davvero dal disco alla
 * cancellazione (un allegato inappropriato non deve restare scaricabile), e
 * `file_id` torna null.
 */
class MessaggioChat extends Model {
  /**
   * Vista esponibile al client. Un messaggio eliminato non espone mai corpo né
   * allegato. L'URL dell'allegato NON è costruito qui (dipende dall'aula): lo
   * compone il service, che conosce il `classe_id` di contesto.
   */
  toPublicJSON() {
    if (this.eliminato) {
      return {
        id: this.id,
        classeId: this.classe_id,
        mittenteId: this.mittente_id,
        corpo: null,
        allegato: null,
        eliminato: true,
        created_at: this.created_at,
      };
    }
    return {
      id: this.id,
      classeId: this.classe_id,
      mittenteId: this.mittente_id,
      corpo: this.corpo,
      fileId: this.file_id,
      eliminato: false,
      created_at: this.created_at,
    };
  }
}

MessaggioChat.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Aula (gruppo) a cui il messaggio appartiene. CASCADE: eliminando l'aula
    // sparisce la sua chat.
    classe_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'classe_id',
    },

    // Autore. SET NULL se l'account viene rimosso: il messaggio resta nel feed
    // come «utente non più disponibile», senza rompere lo storico.
    mittente_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'mittente_id',
    },

    // Scuola (tenant) del messaggio: timbrata dalla scuola del mittente. Rende
    // esplicito il confine di tenant e ne abilita il filtro/pulizia lato admin.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // Testo del messaggio. Nullable: un messaggio può essere di solo allegato.
    corpo: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Allegato opzionale (immagine/documento/video), referenziato dai metadati
    // in `file_caricati`. SET NULL: se la riga-file sparisce (o alla
    // cancellazione soft del messaggio) il riferimento si azzera senza rompere
    // il messaggio.
    file_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'file_id',
    },

    // Eliminazione soft: nasconde il contenuto dall'API mantenendo la riga.
    eliminato: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Audit leggero: chi ha eliminato il messaggio (autore o insegnante/admin).
    eliminato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'eliminato_da',
    },

    eliminato_il: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'eliminato_il',
    },
  },
  {
    sequelize,
    modelName: 'MessaggioChat',
    tableName: 'messaggi_chat',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Query principale: il feed di un'aula, ordinato per data (con cursore
      // per lo scroll all'indietro). È l'indice che fa lavorare la chat.
      { fields: ['classe_id', 'created_at'], name: 'chat_msg_classe_created' },
      { fields: ['mittente_id'], name: 'chat_msg_mittente' },
      { fields: ['scuola_id'], name: 'chat_msg_scuola_id' },
      { fields: ['file_id'], name: 'chat_msg_file' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────
MessaggioChat.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(MessaggioChat, { as: 'messaggiChat', foreignKey: 'classe_id', onDelete: 'CASCADE' });

MessaggioChat.belongsTo(Utente, { as: 'mittente', foreignKey: 'mittente_id', onDelete: 'SET NULL' });
Utente.hasMany(MessaggioChat, { as: 'messaggiChatInviati', foreignKey: 'mittente_id', onDelete: 'SET NULL' });

MessaggioChat.belongsTo(FileCaricato, { as: 'allegato', foreignKey: 'file_id', onDelete: 'SET NULL' });

// Tenant. CASCADE con la scuola.
const Scuola = require('./Scuola');
MessaggioChat.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(MessaggioChat, { as: 'messaggiChat', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

module.exports = MessaggioChat;
