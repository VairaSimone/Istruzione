'use strict';

const crypto = require('crypto');
const { DataTypes } = require('sequelize');

/**
 * Multi-tenant per SCUOLA.
 *
 * Nuova tabella:
 *   - `scuole` → il tenant (nome univoco + blob JSON `impostazioni` personale).
 *
 * Nuova colonna `scuola_id` (nullable, FK → scuole) su:
 *   - `utenti`   → scuola di appartenenza (null per l'admin, trasversale);
 *                  ON DELETE RESTRICT: una scuola con utenti non è eliminabile.
 *   - `classi`   → scuola dell'aula;    ON DELETE CASCADE.
 *   - `compiti`  → scuola del compito;  ON DELETE CASCADE.
 *   - `messaggi` → scuola del messaggio; ON DELETE CASCADE.
 *   - `inviti`   → scuola di destinazione dell'invito; ON DELETE CASCADE.
 *
 * BACKFILL (deployment esistenti): se al momento della migrazione sono già
 * presenti utenti o aule, viene creata una scuola "Scuola Principale" e vi
 * vengono assegnati tutti i record preesistenti (gli admin restano `null`,
 * cioè trasversali). Così un'installazione mono-tenant diventa multi-tenant
 * SENZA cambi di comportamento (tutti nell'unica scuola). Su un DB vuoto non
 * viene creata alcuna scuola.
 *
 * NOTA: le colonne `scuola_id` sono nullable a livello DB per ospitare l'admin
 * (null) e non violare l'integrità sugli eventuali record legacy; l'applicazione
 * le valorizza SEMPRE per i record di nuova creazione (studenti/insegnanti,
 * aule, compiti, messaggi, inviti).
 */

const NOME_SCUOLA_DEFAULT = 'Scuola Principale';

const colonnaScuola = (onDelete) => ({
  type: DataTypes.UUID,
  allowNull: true,
  defaultValue: null,
  references: { model: 'scuole', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 1. Tabella scuole ──
    // Nota: le colonne JSON in MySQL non ammettono un DEFAULT a livello DB: il
    // valore di default ({}) è garantito dal modello Sequelize in fase di INSERT.
    await queryInterface.createTable('scuole', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      nome: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      impostazioni: {
        type: DataTypes.JSON,
        allowNull: false,
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

    await queryInterface.addIndex('scuole', ['nome'], { name: 'scuole_nome', unique: true });

    // ── 2. Colonne scuola_id + indici ──
    await queryInterface.addColumn('utenti', 'scuola_id', colonnaScuola('RESTRICT'));
    await queryInterface.addIndex('utenti', ['scuola_id'], { name: 'utenti_scuola_id' });

    await queryInterface.addColumn('classi', 'scuola_id', colonnaScuola('CASCADE'));
    await queryInterface.addIndex('classi', ['scuola_id'], { name: 'classi_scuola_id' });

    await queryInterface.addColumn('compiti', 'scuola_id', colonnaScuola('CASCADE'));
    await queryInterface.addIndex('compiti', ['scuola_id'], { name: 'compiti_scuola_id' });

    await queryInterface.addColumn('messaggi', 'scuola_id', colonnaScuola('CASCADE'));
    await queryInterface.addIndex('messaggi', ['scuola_id'], { name: 'messaggi_scuola_id' });

    await queryInterface.addColumn('inviti', 'scuola_id', colonnaScuola('CASCADE'));
    await queryInterface.addIndex('inviti', ['scuola_id'], { name: 'inviti_scuola_id' });

    // ── 3. Backfill dei dati preesistenti ──
    const conteggio = async (tabella) => {
      const [rows] = await sequelize.query(`SELECT COUNT(*) AS n FROM ${tabella}`);
      return Number(rows[0].n) || 0;
    };

    const numUtenti = await conteggio('utenti');
    const numClassi = await conteggio('classi');

    // Backfill solo se esiste già qualcosa da assegnare (installazione esistente).
    if (numUtenti > 0 || numClassi > 0) {
      // Riusa la scuola di default se già presente (idempotenza), altrimenti creala.
      const [esistenti] = await sequelize.query(
        'SELECT id FROM scuole WHERE nome = :nome LIMIT 1',
        { replacements: { nome: NOME_SCUOLA_DEFAULT } }
      );

      let scuolaId;
      if (esistenti.length) {
        scuolaId = esistenti[0].id;
      } else {
        scuolaId = crypto.randomUUID();
        await sequelize.query(
          'INSERT INTO scuole (id, nome, impostazioni, created_at, updated_at) ' +
            'VALUES (:id, :nome, :impostazioni, NOW(), NOW())',
          { replacements: { id: scuolaId, nome: NOME_SCUOLA_DEFAULT, impostazioni: '{}' } }
        );
      }

      // Utenti non-admin → scuola di default (gli admin restano null/trasversali).
      await sequelize.query(
        "UPDATE utenti SET scuola_id = :scuolaId WHERE scuola_id IS NULL AND ruolo <> 'admin'",
        { replacements: { scuolaId } }
      );
      // Aule / compiti / messaggi / inviti preesistenti → scuola di default.
      for (const tabella of ['classi', 'compiti', 'messaggi', 'inviti']) {
        await sequelize.query(
          `UPDATE ${tabella} SET scuola_id = :scuolaId WHERE scuola_id IS NULL`,
          { replacements: { scuolaId } }
        );
      }
    }
  },

  down: async ({ context: queryInterface }) => {
    // Rimozione in ordine inverso. removeColumn su MySQL/Sequelize v6 rimuove
    // anche il vincolo di foreign key associato alla colonna.
    await queryInterface.removeIndex('inviti', 'inviti_scuola_id');
    await queryInterface.removeColumn('inviti', 'scuola_id');

    await queryInterface.removeIndex('messaggi', 'messaggi_scuola_id');
    await queryInterface.removeColumn('messaggi', 'scuola_id');

    await queryInterface.removeIndex('compiti', 'compiti_scuola_id');
    await queryInterface.removeColumn('compiti', 'scuola_id');

    await queryInterface.removeIndex('classi', 'classi_scuola_id');
    await queryInterface.removeColumn('classi', 'scuola_id');

    await queryInterface.removeIndex('utenti', 'utenti_scuola_id');
    await queryInterface.removeColumn('utenti', 'scuola_id');

    await queryInterface.dropTable('scuole');
  },
};
