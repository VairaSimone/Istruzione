'use strict';

const { DataTypes } = require('sequelize');

/**
 * Sistema di NOTIFICHE EMAIL (digest periodico).
 *
 * Nuova tabella:
 *   - `notifiche_email` → coda degli eventi da recapitare via email (nuovi
 *                         messaggi, nuovi compiti, scadenze, feedback). Le
 *                         notifiche restano `in_attesa` finché lo scheduler non
 *                         le raccoglie in un digest e le spedisce.
 *
 * Nuove colonne su `utenti`:
 *   - `preferenze_notifiche`        (JSON)     → interruttore generale + categorie;
 *   - `notifiche_digest_data`       (DATEONLY) → giorno del contatore digest;
 *   - `notifiche_digest_conteggio`  (INT)      → email di digest inviate oggi
 *                                                (governa il tetto giornaliero);
 *   - `notifiche_ultimo_invio`      (DATE)     → istante dell'ultimo digest
 *                                                (impone l'intervallo minimo).
 *
 * NOTA: la colonna JSON `preferenze_notifiche` non ammette un DEFAULT a livello
 * DB in MySQL; il valore ({}) è garantito dal modello Sequelige in fase di
 * INSERT e completato con i default in lettura dal service.
 */

const STATI_NOTIFICA = ['in_attesa', 'inviata', 'annullata'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    // ── 1. Tabella notifiche_email ──
    await queryInterface.createTable('notifiche_email', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      utente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      titolo: {
        type: DataTypes.STRING(200),
        allowNull: false,
        defaultValue: '',
      },
      corpo: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      },
      link: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      },
      riferimento_tipo: {
        type: DataTypes.STRING(40),
        allowNull: true,
        defaultValue: null,
      },
      riferimento_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
      },
      stato: {
        type: DataTypes.ENUM(...STATI_NOTIFICA),
        allowNull: false,
        defaultValue: 'in_attesa',
      },
      inviata_il: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex('notifiche_email', ['utente_id', 'stato'], {
      name: 'notifiche_email_utente_stato',
    });
    await queryInterface.addIndex(
      'notifiche_email',
      ['riferimento_tipo', 'riferimento_id', 'tipo'],
      { name: 'notifiche_email_riferimento' }
    );
    await queryInterface.addIndex('notifiche_email', ['stato'], {
      name: 'notifiche_email_stato',
    });

    // ── 2. Colonne notifiche su utenti ──
    await queryInterface.addColumn('utenti', 'preferenze_notifiche', {
      type: DataTypes.JSON,
      allowNull: false,
      // Il default JSON è applicato dal modello: qui '{}' garantisce NOT NULL
      // sui record esistenti al momento dell'ALTER.
      defaultValue: {},
    });
    await queryInterface.addColumn('utenti', 'notifiche_digest_data', {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('utenti', 'notifiche_digest_conteggio', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('utenti', 'notifiche_ultimo_invio', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async ({ context: queryInterface }) => {
    // Rimozione in ordine inverso.
    await queryInterface.removeColumn('utenti', 'notifiche_ultimo_invio');
    await queryInterface.removeColumn('utenti', 'notifiche_digest_conteggio');
    await queryInterface.removeColumn('utenti', 'notifiche_digest_data');
    await queryInterface.removeColumn('utenti', 'preferenze_notifiche');

    await queryInterface.removeIndex('notifiche_email', 'notifiche_email_stato');
    await queryInterface.removeIndex('notifiche_email', 'notifiche_email_riferimento');
    await queryInterface.removeIndex('notifiche_email', 'notifiche_email_utente_stato');
    await queryInterface.dropTable('notifiche_email');
  },
};
