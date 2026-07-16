'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { aDecimale } = require('../utils/denaro');

// Stati del pagamento. STRINGA LIBERA (non ENUM del DB), coerentemente con la
// convenzione della piattaforma per i campi "tipo/stato": aggiungere uno stato
// non richiede una migrazione ALTER sull'ENUM.
//   - 'in_attesa'  → sessione di checkout creata, pagamento non ancora concluso;
//   - 'completato' → pagamento riuscito (webhook checkout.session.completed);
//   - 'fallito'    → pagamento non riuscito (async_payment_failed);
//   - 'annullato'  → sessione scaduta o abbandonata (checkout.session.expired);
//   - 'rimborsato' → importo rimborsato dalla scuola.
const STATI_PAGAMENTO = ['in_attesa', 'completato', 'fallito', 'annullato', 'rimborsato'];

/**
 * Pagamento — ORDINE/TRANSAZIONE di iscrizione a un corso a pagamento.
 *
 * Una riga nasce quando uno studente avvia il checkout Stripe per un corso
 * ACQUISTABILE della propria scuola, e attraversa gli stati sopra fino a
 * `completato` (o `annullato`/`fallito`). Al completamento, il webhook iscrive
 * automaticamente l'acquirente nell'AULA DI DESTINAZIONE decisa dalla scuola per
 * quel corso e notifica sia lo studente sia lo staff.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ TANTI CAMPI "SNAPSHOT"
 * ─────────────────────────────────────────────
 * Prezzo del corso, valuta, percentuale di commissione della piattaforma e aula
 * di destinazione possono cambiare NEL TEMPO. Un ordine, però, deve restare
 * fedele alle condizioni del MOMENTO DELL'ACQUISTO: per questo `importo_centesimi`,
 * `valuta`, `commissione_piattaforma_percentuale`, `commissione_piattaforma_centesimi`
 * e `aula_destinazione_id` sono COPIATI qui alla creazione della sessione e non
 * derivati a runtime dal corso/scuola. È lo stesso principio degli snapshot dei
 * certificati.
 *
 * ISOLAMENTO TRA SCUOLE: `scuola_id` è timbrato alla creazione; ogni lettura per
 * lo staff è vincolata alla propria scuola. Un pagamento non è mai visibile ad
 * altri tenant.
 *
 * IDEMPOTENZA: `stripe_checkout_session_id` è UNIVOCO. Il webhook può essere
 * recapitato più volte da Stripe: l'iscrizione all'aula viene eseguita una sola
 * volta grazie al flag `iscrizione_effettuata` e alla transazione.
 *
 * ORDINE DELLE SCRITTURE: la riga nasce `in_attesa` e SENZA sessione; la
 * sessione Stripe viene creata subito dopo e collegata con un UPDATE. Mai il
 * contrario: una sessione pagabile senza ordine significherebbe incassare soldi
 * senza avere nulla su cui agganciare l'iscrizione.
 */
class Pagamento extends Model {
  /** Dati esponibili al client (acquirente/staff). */
  toPublicJSON() {
    return {
      id: this.id,
      scuolaId: this.scuola_id,
      corsoId: this.corso_id,
      utenteId: this.utente_id,
      aulaDestinazioneId: this.aula_destinazione_id,
      stato: this.stato,
      importoCentesimi: this.importo_centesimi,
      importo: aDecimale(this.importo_centesimi),
      valuta: this.valuta,
      commissionePiattaformaCentesimi: this.commissione_piattaforma_centesimi,
      commissionePiattaformaPercentuale:
        this.commissione_piattaforma_percentuale === null ||
        this.commissione_piattaforma_percentuale === undefined
          ? null
          : Number(this.commissione_piattaforma_percentuale),
      emailAcquirente: this.email_acquirente,
      iscrizioneEffettuata: this.iscrizione_effettuata,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Pagamento.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Tenant del pagamento: la scuola del corso acquistato. CASCADE con la scuola.
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'scuola_id',
    },

    // Corso acquistato. Se il corso viene eliminato l'ordine resta nello storico
    // (SET NULL): serve per rendicontazione e per non perdere la traccia contabile.
    corso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'corso_id',
    },

    // Acquirente. CASCADE con l'utente (se l'account sparisce sparisce l'ordine;
    // la rendicontazione contabile vera è comunque su Stripe).
    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    // Aula in cui iscrivere l'acquirente al completamento (snapshot). SET NULL se
    // l'aula viene poi eliminata: l'ordine resta, l'iscrizione era già avvenuta.
    aula_destinazione_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'aula_destinazione_id',
    },

    // Identificativo della sessione di Checkout Stripe. UNIVOCO: rende idempotente
    // il webhook e permette di ritrovare l'ordine dall'evento Stripe.
    // NULLABLE per un motivo preciso: l'ordine viene creato PRIMA della sessione
    // Stripe (cfr. `pagamentiService.creaCheckout`), così non può mai esistere
    // un link di pagamento valido senza un ordine che lo attenda. Nell'istante
    // tra le due scritture la colonna è nulla. L'indice UNIVOCO resta e continua
    // a garantire l'idempotenza del webhook: in SQL più righe NULL non
    // confliggono tra loro.
    stripe_checkout_session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'stripe_checkout_session_id',
    },

    // PaymentIntent associato (valorizzato al completamento). Utile per i rimborsi.
    stripe_payment_intent_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'stripe_payment_intent_id',
    },

    stato: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'in_attesa',
      validate: {
        isIn: {
          args: [STATI_PAGAMENTO],
          msg: `Lo stato del pagamento deve essere uno di: ${STATI_PAGAMENTO.join(', ')}`,
        },
      },
    },

    // Importo TOTALE addebitato all'acquirente, in centesimi (snapshot del prezzo).
    importo_centesimi: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'importo_centesimi',
      validate: {
        min: { args: [0], msg: "L'importo non può essere negativo" },
      },
    },

    // Valuta ISO-4217 (snapshot). Maiuscola verso l'esterno.
    valuta: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'EUR',
    },

    // Percentuale trattenuta dalla piattaforma al momento dell'acquisto (snapshot).
    commissione_piattaforma_percentuale: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: null,
      field: 'commissione_piattaforma_percentuale',
    },

    // Commissione della piattaforma effettivamente applicata, in centesimi
    // (application_fee_amount inviata a Stripe). Snapshot.
    commissione_piattaforma_centesimi: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'commissione_piattaforma_centesimi',
    },

    // Email dell'acquirente al momento dell'acquisto (snapshot, comodità staff).
    email_acquirente: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: 'email_acquirente',
    },

    // True quando l'iscrizione automatica all'aula di destinazione è già stata
    // eseguita: garantisce che un webhook recapitato più volte non iscriva due
    // volte (o non tenti di iscrivere dopo un'eliminazione manuale).
    iscrizione_effettuata: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'iscrizione_effettuata',
    },
  },
  {
    sequelize,
    modelName: 'Pagamento',
    tableName: 'pagamenti',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Idempotenza del webhook + ricerca dall'evento Stripe.
      { unique: true, fields: ['stripe_checkout_session_id'], name: 'pagamenti_checkout_session' },
      // Rendicontazione della scuola (incassi del tenant).
      { fields: ['scuola_id'], name: 'pagamenti_scuola_id' },
      // Ordini di un acquirente ("i miei acquisti").
      { fields: ['utente_id'], name: 'pagamenti_utente_id' },
      // Ordini per corso (quante iscrizioni pagate ha un corso).
      { fields: ['corso_id'], name: 'pagamenti_corso_id' },
      // Filtro per stato (es. incassi completati).
      { fields: ['stato'], name: 'pagamenti_stato' },
      // Ricerca dal PaymentIntent (rimborsi/riconciliazioni).
      { fields: ['stripe_payment_intent_id'], name: 'pagamenti_payment_intent' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni
// ─────────────────────────────────────────────
const Scuola = require('./Scuola');
const Utente = require('./Utente');
const Corso = require('./Corso');
const Classe = require('./Classe');

// Tenant: CASCADE con la scuola (coerente con le altre risorse del tenant).
Pagamento.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(Pagamento, { as: 'pagamenti', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

// Acquirente: CASCADE con l'utente.
Pagamento.belongsTo(Utente, { as: 'acquirente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Utente.hasMany(Pagamento, { as: 'pagamenti', foreignKey: 'utente_id', onDelete: 'CASCADE' });

// Corso: SET NULL — l'ordine sopravvive all'eventuale eliminazione del corso.
Pagamento.belongsTo(Corso, { as: 'corso', foreignKey: 'corso_id', onDelete: 'SET NULL' });
Corso.hasMany(Pagamento, { as: 'pagamenti', foreignKey: 'corso_id', onDelete: 'SET NULL' });

// Aula di destinazione: SET NULL — l'ordine resta anche se l'aula viene rimossa.
Pagamento.belongsTo(Classe, {
  as: 'aulaDestinazione',
  foreignKey: 'aula_destinazione_id',
  onDelete: 'SET NULL',
});

Pagamento.STATI_PAGAMENTO = STATI_PAGAMENTO;

module.exports = Pagamento;
