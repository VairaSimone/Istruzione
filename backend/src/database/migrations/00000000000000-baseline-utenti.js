'use strict';

const { DataTypes } = require('sequelize');

/**
 * BASELINE — creazione della tabella `utenti`.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ ESISTE QUESTO FILE
 * ─────────────────────────────────────────────
 * `utenti` è la tabella RADICE dello schema: `inviti`, `classe_utenti`,
 * `messaggi`, `certificati`, `pagamenti`… la referenziano tutte in chiave
 * esterna. Nessuna migrazione la creava: la più antica
 * (`20260625000001-refresh-token-optimization`) la dà già per esistente e fa
 * `changeColumn('utenti', 'refresh_token', ...)`. Su un database vergine
 * `npm run db:migrate` falliva quindi alla PRIMA migrazione con
 *
 *     Error: Table '<db>.utenti' doesn't exist
 *
 * rendendo impossibile qualunque installazione pulita per il percorso
 * documentato. La tabella nasceva solo da `sequelize.sync()`, che non è più
 * il sistema di schema del progetto (cfr. rimozione di `db:sync` e di
 * `sync({ alter: true })` da `server.js`).
 *
 * ─────────────────────────────────────────────
 * QUALE SCHEMA RICOSTRUISCE
 * ─────────────────────────────────────────────
 * NON quello del modello odierno, ma quello *precedente* a
 * `20260625000001`: è l'unico che rende applicabili in ordine tutte le
 * migrazioni successive, ognuna delle quali aggiunge il proprio pezzo. In
 * particolare qui:
 *
 *   - `refresh_token` è TEXT e SENZA indice   → `20260625000001` lo porta a
 *                                                STRING(64) e lo indicizza;
 *   - `eta` e `classe` sono NOT NULL           → `20260625000002` li rende
 *                                                opzionali (login Google);
 *   - `classe` è l'ENUM storico                → `20260710000001` lo converte
 *                                                in STRING(60) (vocabolario
 *                                                della scuola);
 *   - `ruolo` non contiene ancora 'admin'      → `20260627000001` estende l'ENUM
 *                                                e aggiunge `stato`;
 *   - non esistono `google_id`, `profilo_completo`, `scuola_id`, gli XP, i
 *     consensi legali, le preferenze notifiche: li aggiungono, nell'ordine, le
 *     rispettive migrazioni.
 *
 * Ricostruire lo stato storico invece dello stato finale è la sola scelta
 * corretta: uno schema "già completo" farebbe fallire ogni `addColumn`
 * successivo con «Duplicate column».
 *
 * ─────────────────────────────────────────────
 * IDEMPOTENZA
 * ─────────────────────────────────────────────
 * Se `utenti` esiste già la migrazione NON fa nulla: si limita a marcarsi come
 * applicata. È una baseline, non una trasformazione, e non deve mai distruggere
 * dati esistenti.
 *
 * ATTENZIONE: un database nato da `sequelize.sync()` ha `utenti` nella forma
 * ATTUALE, non in quella storica. Su di esso la baseline è un no-op corretto,
 * ma le migrazioni SUCCESSIVE fallirebbero comunque («Duplicate column» su
 * `google_id`, `stato`, `scuola_id`…): quelle colonne ci sono già. Per un
 * database preesistente la via è marcare a mano l'intera catena come applicata
 * (INSERT in `SequelizeMeta`) — la procedura è in `CHANGES.md`. Da qui in avanti
 * ogni installazione nasce e cresce SOLO per migrazioni.
 */

// Vocabolario delle classi vigente prima della generalizzazione della
// piattaforma (`20260710000001` lo sostituisce con una STRING libera).
const CLASSI_STORICHE = ['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta'];

/** True se la tabella esiste già nel database. */
const tabellaEsiste = async (queryInterface, nome) => {
  try {
    await queryInterface.describeTable(nome);
    return true;
  } catch (_) {
    return false;
  }
};

module.exports = {
  up: async ({ context: queryInterface }) => {
    // Database già popolato (nato da `sync`): la baseline è un no-op.
    if (await tabellaEsiste(queryInterface, 'utenti')) return;

    await queryInterface.createTable('utenti', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      nome: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      cognome: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      // Resa opzionale da `20260625000002` (registrazione via Google).
      eta: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },

      // Hash bcrypt: la lunghezza è fissa, ma STRING(255) lascia margine a
      // eventuali cambi di algoritmo.
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      // 'admin' viene aggiunto da `20260627000001` insieme alla colonna `stato`.
      ruolo: {
        type: DataTypes.ENUM('studente', 'insegnante'),
        allowNull: false,
        defaultValue: 'studente',
      },

      // ENUM storico → STRING(60) in `20260710000001`.
      classe: {
        type: DataTypes.ENUM(...CLASSI_STORICHE),
        allowNull: false,
      },

      email_verificata: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // TEXT senza indice: `20260625000001` lo converte in STRING(64) (lunghezza
      // fissa di un hash SHA-256 in hex) e lo indicizza.
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },

      reset_password_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },

      reset_password_expire: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },

      email_verification_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },

      email_verification_expire: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },

      nuova_email_pendente: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },

      // Invalidazione di massa delle sessioni: incrementando questo contatore
      // ogni JWT già emesso per l'utente diventa inutilizzabile.
      token_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      tentativi_falliti: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      bloccato_fino_al: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },

      lingua: {
        type: DataTypes.ENUM('it', 'en'),
        allowNull: false,
        defaultValue: 'it',
      },

      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('CURRENT_TIMESTAMP'),
      },

      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Indici presenti fin dall'origine. Quelli su `refresh_token`, `google_id`,
    // `stato`, `scuola_id` e `cancellazione_richiesta_at` arrivano dalle
    // migrazioni che introducono le rispettive colonne.
    await queryInterface.addIndex('utenti', ['email'], {
      name: 'unique_email',
      unique: true,
    });
    await queryInterface.addIndex('utenti', ['reset_password_token'], {
      name: 'utenti_reset_password_token',
    });
    await queryInterface.addIndex('utenti', ['email_verification_token'], {
      name: 'utenti_email_verification_token',
    });
    await queryInterface.addIndex('utenti', ['ruolo'], { name: 'utenti_ruolo' });
  },

  down: async ({ context: queryInterface }) => {
    // Distruttivo per definizione: elimina la radice dello schema. Le tabelle
    // che la referenziano vanno già rimosse dalle rispettive `down`, eseguite
    // prima di questa (umzug annulla in ordine inverso).
    await queryInterface.dropTable('utenti');

    // Tipi ENUM orfani (no-op su MySQL).
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_utenti_ruolo";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_utenti_classe";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_utenti_lingua";');
    }
  },
};
