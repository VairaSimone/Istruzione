'use strict';

const { DataTypes } = require('sequelize');

/**
 * PAGAMENTI — iscrizioni ai corsi tramite Stripe (Stripe Connect).
 *
 * Questa migrazione introduce l'infrastruttura dati del modulo pagamenti,
 * OPZIONALE per ogni scuola:
 *
 *   1. NUOVA TABELLA `pagamenti` — un ordine/transazione per ogni acquisto di
 *      iscrizione a un corso. Contiene gli snapshot (importo, valuta, commissione
 *      piattaforma, aula di destinazione) per essere fedele alle condizioni del
 *      momento dell'acquisto, e gli identificativi Stripe (sessione di checkout e
 *      payment intent) per l'idempotenza del webhook e i rimborsi.
 *
 *   2. COLONNE su `scuole` — configurazione dell'incasso del tenant:
 *      - `pagamenti_stripe_attivi` (flag deciso dalla scuola; default false);
 *      - `stripe_account_id` (account Connect collegato con l'onboarding);
 *      - `stripe_onboarding_completato` (l'account può incassare);
 *      - `commissione_piattaforma_percentuale` (percentuale trattenuta dalla
 *        PIATTAFORMA, DECISA DALL'ADMIN — colonna dedicata come le quote, così lo
 *        staff non può abbassarsela; NULL = 0%).
 *
 *   3. COLONNE su `corsi` — listino PER-SCUOLA (i corsi sono già per-scuola):
 *      - `acquistabile` (in vendita nel catalogo; default false);
 *      - `prezzo_centesimi` (prezzo in centesimi; NULL = non impostato);
 *      - `valuta` (ISO-4217, default 'EUR');
 *      - `descrizione_vendita` (testo commerciale, distinto da quello didattico);
 *      - `aula_destinazione_id` (aula in cui iscrivere l'acquirente a pagamento
 *        avvenuto; FK verso `classi`, SET NULL).
 *
 * Tutte le colonne aggiunte sono retro-compatibili: le scuole e i corsi esistenti
 * nascono SENZA pagamenti (comportamento invariato). Lo `stato` di `pagamenti` è
 * una STRING (non ENUM), coerentemente con la convenzione del progetto per i campi
 * "tipo/stato" della piattaforma generica.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 1. Tabella pagamenti ──────────────────────────────────────────────
    await queryInterface.createTable('pagamenti', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      corso_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'corsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      utente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      aula_destinazione_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'classi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      stripe_checkout_session_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      stripe_payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      stato: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'in_attesa',
      },
      importo_centesimi: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      valuta: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'EUR',
      },
      commissione_piattaforma_percentuale: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      commissione_piattaforma_centesimi: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      email_acquirente: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      iscrizione_effettuata: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('pagamenti', ['stripe_checkout_session_id'], {
      name: 'pagamenti_checkout_session',
      unique: true,
    });
    await queryInterface.addIndex('pagamenti', ['scuola_id'], { name: 'pagamenti_scuola_id' });
    await queryInterface.addIndex('pagamenti', ['utente_id'], { name: 'pagamenti_utente_id' });
    await queryInterface.addIndex('pagamenti', ['corso_id'], { name: 'pagamenti_corso_id' });
    await queryInterface.addIndex('pagamenti', ['stato'], { name: 'pagamenti_stato' });
    await queryInterface.addIndex('pagamenti', ['stripe_payment_intent_id'], {
      name: 'pagamenti_payment_intent',
    });

    // ── 2. Colonne su scuole ──────────────────────────────────────────────
    await queryInterface.addColumn('scuole', 'pagamenti_stripe_attivi', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('scuole', 'stripe_account_id', {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('scuole', 'stripe_onboarding_completato', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('scuole', 'commissione_piattaforma_percentuale', {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: null,
    });

    // ── 3. Colonne su corsi ───────────────────────────────────────────────
    await queryInterface.addColumn('corsi', 'acquistabile', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('corsi', 'prezzo_centesimi', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('corsi', 'valuta', {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'EUR',
    });
    await queryInterface.addColumn('corsi', 'descrizione_vendita', {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('corsi', 'aula_destinazione_id', {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'classi', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('corsi', ['acquistabile'], { name: 'corsi_acquistabile' });
    await queryInterface.addIndex('corsi', ['aula_destinazione_id'], {
      name: 'corsi_aula_destinazione_id',
    });
  },

  down: async ({ context: queryInterface }) => {
    // Corsi
    await queryInterface.removeIndex('corsi', 'corsi_aula_destinazione_id');
    await queryInterface.removeIndex('corsi', 'corsi_acquistabile');
    await queryInterface.removeColumn('corsi', 'aula_destinazione_id');
    await queryInterface.removeColumn('corsi', 'descrizione_vendita');
    await queryInterface.removeColumn('corsi', 'valuta');
    await queryInterface.removeColumn('corsi', 'prezzo_centesimi');
    await queryInterface.removeColumn('corsi', 'acquistabile');

    // Scuole
    await queryInterface.removeColumn('scuole', 'commissione_piattaforma_percentuale');
    await queryInterface.removeColumn('scuole', 'stripe_onboarding_completato');
    await queryInterface.removeColumn('scuole', 'stripe_account_id');
    await queryInterface.removeColumn('scuole', 'pagamenti_stripe_attivi');

    // Pagamenti
    await queryInterface.dropTable('pagamenti');
  },
};
