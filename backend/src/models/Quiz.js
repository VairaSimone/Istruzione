'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Scuola = require('./Scuola');
const { CODICI_TEMPLATE } = require('../constants/quizTemplates');

// Stato di pubblicazione del quiz (allineato a corsi e compiti):
//   - 'bozza'      → visibile solo allo staff della scuola;
//   - 'pubblicato' → giocabile dagli studenti delle aule abilitate;
//   - 'archiviato' → concluso/nascosto, resta nello storico.
const STATI_QUIZ = ['bozza', 'pubblicato', 'archiviato'];

// Numero di domande per partita: limiti difensivi (il default storico è 20).
const DIMENSIONE_ROUND_MIN = 1;
const DIMENSIONE_ROUND_MAX = 50;
const DIMENSIONE_ROUND_DEFAULT = 20;

// Lunghezza massima di materia e categoria (campi liberi: \"Inglese\",
// \"Matematica\", \"Sicurezza sul lavoro\"…). Sono i due assi di classificazione
// dei quiz: la MATERIA dice di che disciplina si tratta, la CATEGORIA raggruppa
// i quiz dentro la materia (\"Grammatica\", \"Algebra\", \"Modulo 1\").
const MATERIA_MAX = 80;
const CATEGORIA_MAX = 80;

/**
 * Quiz — un quiz DI UNA SCUOLA.
 *
 * Il quiz è l'unità che gli insegnanti creano e gestiscono. Ne esistono due
 * specie, distinte da `template_codice`:
 *
 *   1. QUIZ DA TEMPLATE (`template_codice` valorizzato, es. 'kana' | 'kanji')
 *      La scuola INSTALLA un template di piattaforma: un quiz \"di esempio\" con
 *      un motore di generazione scritto in codice. Le domande non stanno in
 *      database: le genera il motore del template. La `configurazione` JSON
 *      fissa i parametri della partita; i campi lasciati liberi restano scelti
 *      dallo studente. La stessa scuola può installare lo stesso template più
 *      volte con configurazioni diverse. I template di giapponese forniti con
 *      la piattaforma vivono qui: una scuola può installarli o ignorarli, e
 *      in futuro se ne aggiungeranno per altre lingue e materie.
 *
 *   2. QUIZ PERSONALIZZATO (`template_codice` null)
 *      Le domande sono righe di `domande_quiz` scritte dagli insegnanti, su
 *      qualsiasi materia (inglese, francese, matematica, informatica…).
 *
 * ISOLAMENTO TRA SCUOLE: `scuola_id` timbra il tenant. Un quiz è abilitabile
 * SOLO ad aule della stessa scuola (cfr. QuizAula) e gli studenti raggiungono i
 * quiz esclusivamente tramite le proprie aule: un quiz non è quindi mai
 * visibile a un'altra scuola.
 *
 * `creato_da` traccia l'autore (ownership debole: SET NULL se l'account sparisce;
 * il quiz resta gestibile dagli altri insegnanti della scuola e dall'admin).
 * Ogni insegnante della scuola può modificare TUTTI i quiz della propria scuola.
 */
class Quiz extends Model {
  /**
   * Motore EFFETTIVO del quiz (kana/kanji/banca/domande), non il codice del
   * template. Più template distinti (banca-webdev, banca-chimica…) condividono
   * lo stesso motore `banca`: il motore va risolto dal registro, non dedotto dal
   * codice. Per i quiz personalizzati (senza template) è 'domande'. Se il codice
   * non è (più) nel catalogo, si ripiega sul codice stesso (comportamento
   * storico), così un quiz orfano non genera un motore nullo.
   */
  get motore() {
    if (!this.template_codice) return 'domande';
    // require locale per evitare qualunque ciclo a livello di modulo.
    const { motoreDelTemplate } = require('../constants/quizTemplates');
    return motoreDelTemplate(this.template_codice) || this.template_codice;
  }

  /** True se il quiz è un'installazione di un template di piattaforma. */
  get daTemplate() {
    return Boolean(this.template_codice);
  }

  /** Dati esponibili al client (domande/aule sono aggiunte dal service). */
  toPublicJSON() {
    return {
      id: this.id,
      titolo: this.titolo,
      descrizione: this.descrizione,
      materia: this.materia,
      categoria: this.categoria,
      templateCodice: this.template_codice,
      motore: this.motore,
      configurazione: this.configurazione || {},
      stato: this.stato,
      dimensioneRound: this.dimensione_round,
      mescolaDomande: this.mescola_domande,
      scuolaId: this.scuola_id,
      creatoDa: this.creato_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Quiz.init(
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
        notEmpty: { msg: 'Il titolo del quiz non può essere vuoto' },
        len: { args: [2, 160], msg: 'Il titolo del quiz deve avere tra 2 e 160 caratteri' },
      },
    },

    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Materia libera: la piattaforma è generica, il quiz può riguardare
    // qualunque disciplina. Il vocabolario delle materie è una impostazione
    // della scuola (`impostazioni.didattica.materieDisponibili`), non una
    // costante di codice: vuoto ⇒ testo libero.
    materia: {
      type: DataTypes.STRING(MATERIA_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, MATERIA_MAX], msg: `La materia non può superare i ${MATERIA_MAX} caratteri` },
      },
    },

    // Categoria/argomento libero, per raggruppare i quiz dentro una materia.
    categoria: {
      type: DataTypes.STRING(CATEGORIA_MAX),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: {
          args: [0, CATEGORIA_MAX],
          msg: `La categoria non può superare i ${CATEGORIA_MAX} caratteri`,
        },
      },
    },

    // Codice del template installato; null per i quiz personalizzati.
    template_codice: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: 'template_codice',
      validate: {
        isIn: {
          args: [[...CODICI_TEMPLATE, null]],
          msg: `Il template deve essere uno di: ${CODICI_TEMPLATE.join(', ')}`,
        },
      },
    },

    // Configurazione del template (blob JSON libero, validato dal registro).
    // Vuoto {} per i quiz personalizzati. In MySQL le colonne JSON non ammettono
    // un DEFAULT a livello DB: il valore di default è garantito da Sequelize.
    configurazione: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    stato: {
      type: DataTypes.ENUM(...STATI_QUIZ),
      allowNull: false,
      defaultValue: 'bozza',
      validate: {
        isIn: {
          args: [STATI_QUIZ],
          msg: `Lo stato deve essere uno di: ${STATI_QUIZ.join(', ')}`,
        },
      },
    },

    // Numero massimo di domande estratte per partita.
    dimensione_round: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: DIMENSIONE_ROUND_DEFAULT,
      field: 'dimensione_round',
      validate: {
        min: { args: [DIMENSIONE_ROUND_MIN], msg: `Il round minimo è di ${DIMENSIONE_ROUND_MIN} domanda` },
        max: { args: [DIMENSIONE_ROUND_MAX], msg: `Il round massimo è di ${DIMENSIONE_ROUND_MAX} domande` },
        isInt: { msg: 'La dimensione del round deve essere un numero intero' },
      },
    },

    // Se true le opzioni di risposta vengono mescolate a ogni partita.
    mescola_domande: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'mescola_domande',
    },

    // Scuola (tenant) del quiz: timbrata alla creazione dalla scuola dell'autore.
    // Nullable a livello DB solo per compatibilità: l'applicazione la valorizza
    // SEMPRE (per l'admin è obbligatorio indicare `scuolaId`).
    scuola_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'scuola_id',
    },

    // Autore del quiz (ownership debole). SET NULL se l'account sparisce.
    creato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'creato_da',
    },
  },
  {
    sequelize,
    modelName: 'Quiz',
    tableName: 'quiz',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Scope per tenant (scuola): elenco quiz di una scuola.
      { fields: ['scuola_id'], name: 'quiz_scuola_id' },
      { fields: ['creato_da'], name: 'quiz_creato_da' },
      { fields: ['stato'], name: 'quiz_stato' },
      // Filtro/raggruppamento dei quiz per materia e categoria.
      { fields: ['scuola_id', 'materia'], name: 'quiz_scuola_materia' },
      { fields: ['scuola_id', 'categoria'], name: 'quiz_scuola_categoria' },
      // Verifica rapida \"questa scuola ha installato il template X?\".
      { fields: ['scuola_id', 'template_codice'], name: 'quiz_scuola_template' },
    ],
  }
);

// Autore (ownership debole).
Quiz.belongsTo(Utente, { as: 'autore', foreignKey: 'creato_da', onDelete: 'SET NULL' });
Utente.hasMany(Quiz, { as: 'quizCreati', foreignKey: 'creato_da', onDelete: 'SET NULL' });

// Tenant del quiz. CASCADE con la scuola (coerente con aule, compiti e corsi).
Quiz.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(Quiz, { as: 'quiz', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

Quiz.STATI_QUIZ = STATI_QUIZ;
Quiz.DIMENSIONE_ROUND_MIN = DIMENSIONE_ROUND_MIN;
Quiz.DIMENSIONE_ROUND_MAX = DIMENSIONE_ROUND_MAX;
Quiz.DIMENSIONE_ROUND_DEFAULT = DIMENSIONE_ROUND_DEFAULT;
Quiz.MATERIA_MAX = MATERIA_MAX;
Quiz.CATEGORIA_MAX = CATEGORIA_MAX;

module.exports = Quiz;
