'use strict';

const { DataTypes } = require('sequelize');

/**
 * Quiz gestiti dalle scuole: TEMPLATE INSTALLABILI + QUIZ PERSONALIZZATI.
 *
 * Nuove tabelle:
 *   - `quiz`                → il quiz di una scuola. Se `template_codice` è
 *                             valorizzato è l'INSTALLAZIONE di un template di
 *                             piattaforma (oggi 'kana' e 'kanji', il quiz di
 *                             giapponese storico), con `configurazione` JSON che
 *                             ne fissa i parametri. Se è null è un quiz
 *                             PERSONALIZZATO, le cui domande stanno in
 *                             `domande_quiz` e possono riguardare qualsiasi
 *                             materia;
 *   - `domande_quiz`        → le domande dei quiz personalizzati (scelta
 *                             multipla, vero/falso, risposta breve);
 *   - `opzioni_quiz`        → le risposte possibili di una domanda a scelta;
 *   - `quiz_aule`           → ponte molti-a-molti quiz↔aula: abilita un quiz per
 *                             un'aula (con vincolo di unicità);
 *   - `progressi_domanda`   → SRS per utente/domanda, gemello di
 *                             `progressi_kana` e `progressi_kanji`.
 *
 * ISOLAMENTO TRA SCUOLE: `quiz.scuola_id` (FK → scuole, ON DELETE CASCADE)
 * timbra il tenant del quiz; l'abilitazione presso un'aula (quiz_aule) è
 * ammessa dall'applicazione solo tra quiz e aula della STESSA scuola, così un
 * quiz non è mai raggiungibile da studenti di altre scuole.
 *
 * NESSUN DATO ESISTENTE VIENE TOCCATO: i progressi kana/kanji, i badge, gli XP e
 * le statistiche restano invariati. I template si limitano a incapsulare la
 * configurazione dei quiz di giapponese già presenti.
 *
 * RETROCOMPATIBILITÀ: finché una scuola non imposta
 * `impostazioni.quizTemplateLibero = false`, gli endpoint storici del quiz di
 * giapponese continuano a funzionare per tutti i suoi studenti anche senza
 * installare alcun template. Nessuna migrazione dati necessaria.
 */

const STATI_QUIZ = ['bozza', 'pubblicato', 'archiviato'];
const TIPI_DOMANDA = ['scelta_multipla', 'vero_falso', 'risposta_breve'];
const URL_MAX = 2048;

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 1. Tabella quiz ──
    // Nota: le colonne JSON in MySQL non ammettono un DEFAULT a livello DB: il
    // valore di default ({}) è garantito dal modello Sequelize in fase di INSERT.
    await queryInterface.createTable('quiz', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      titolo: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      descrizione: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      materia: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      template_codice: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      configurazione: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      stato: {
        type: DataTypes.ENUM(...STATI_QUIZ),
        allowNull: false,
        defaultValue: 'bozza',
      },
      dimensione_round: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
      },
      mescola_domande: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      creato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('quiz', ['scuola_id'], { name: 'quiz_scuola_id' });
    await queryInterface.addIndex('quiz', ['creato_da'], { name: 'quiz_creato_da' });
    await queryInterface.addIndex('quiz', ['stato'], { name: 'quiz_stato' });
    await queryInterface.addIndex('quiz', ['scuola_id', 'template_codice'], {
      name: 'quiz_scuola_template',
    });

    // ── 2. Tabella domande_quiz ──
    await queryInterface.createTable('domande_quiz', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      quiz_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'quiz', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo: {
        type: DataTypes.ENUM(...TIPI_DOMANDA),
        allowNull: false,
        defaultValue: 'scelta_multipla',
      },
      testo: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      spiegazione: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      media_url: {
        type: DataTypes.STRING(URL_MAX),
        allowNull: true,
      },
      risposta_corretta: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      risposte_alternative: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      case_sensitive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ordine: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('domande_quiz', ['quiz_id', 'ordine'], {
      name: 'domande_quiz_quiz_ordine',
    });

    // ── 3. Tabella opzioni_quiz ──
    await queryInterface.createTable('opzioni_quiz', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      domanda_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'domande_quiz', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      testo: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      corretta: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      ordine: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('opzioni_quiz', ['domanda_id', 'ordine'], {
      name: 'opzioni_quiz_domanda_ordine',
    });

    // ── 4. Tabella ponte quiz_aule (abilitazione per aula) ──
    await queryInterface.createTable('quiz_aule', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      quiz_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'quiz', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classe_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'classi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      abilitato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('quiz_aule', ['quiz_id', 'classe_id'], {
      name: 'quiz_aule_quiz_classe',
      unique: true,
    });
    await queryInterface.addIndex('quiz_aule', ['quiz_id'], { name: 'quiz_aule_quiz' });
    await queryInterface.addIndex('quiz_aule', ['classe_id'], { name: 'quiz_aule_classe' });

    // ── 5. Tabella progressi_domanda (SRS dei quiz personalizzati) ──
    await queryInterface.createTable('progressi_domanda', {
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
      domanda_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'domande_quiz', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      punteggio: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      tentativi: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errori: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('progressi_domanda', ['utente_id', 'domanda_id'], {
      name: 'progressi_domanda_utente_domanda',
      unique: true,
    });
    await queryInterface.addIndex('progressi_domanda', ['utente_id'], {
      name: 'progressi_domanda_utente_id',
    });
    await queryInterface.addIndex('progressi_domanda', ['utente_id', 'punteggio'], {
      name: 'progressi_domanda_utente_punteggio',
    });
    await queryInterface.addIndex('progressi_domanda', ['domanda_id'], {
      name: 'progressi_domanda_domanda_id',
    });
  },

  down: async ({ context: queryInterface }) => {
    // Rimozione in ordine inverso rispetto alle dipendenze.
    await queryInterface.dropTable('progressi_domanda');
    await queryInterface.dropTable('quiz_aule');
    await queryInterface.dropTable('opzioni_quiz');
    await queryInterface.dropTable('domande_quiz');
    await queryInterface.dropTable('quiz');

    // Rimuove i tipi ENUM orfani creati da Postgres (no-op su MySQL).
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_quiz_stato";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_domande_quiz_tipo";');
    }
  },
};
