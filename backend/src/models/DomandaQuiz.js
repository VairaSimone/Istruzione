'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Quiz = require('./Quiz');

/**
 * Tipologie di domanda dei QUIZ PERSONALIZZATI.
 *
 *   - 'scelta_multipla' → 2..6 opzioni, ESATTAMENTE una corretta;
 *   - 'vero_falso'      → caso particolare della scelta multipla: esattamente 2
 *                          opzioni (una corretta). Il tipo serve al frontend per
 *                          rendere la domanda con la UI dedicata;
 *   - 'risposta_breve'  → nessuna opzione: la risposta viene confrontata con
 *                          `risposta_corretta` e con `risposte_alternative`.
 */
const TIPI_DOMANDA = ['scelta_multipla', 'vero_falso', 'risposta_breve'];

// Vincoli sul numero di opzioni (applicati nel service, dove si vede l'insieme).
const OPZIONI_MIN = 2;
const OPZIONI_MAX = 6;

const TESTO_MAX = 2000;
const RISPOSTA_MAX = 255;
const MAX_RISPOSTE_ALTERNATIVE = 10;

// URL di un media di supporto (immagine/audio ospitati esternamente).
const URL_MAX = 2048;
const URL_REGEX = /^https?:\/\/.+/i;

/**
 * DomandaQuiz — una domanda di un QUIZ PERSONALIZZATO.
 *
 * Esiste solo per i quiz senza template (`Quiz.template_codice === null`): i
 * quiz da template generano le domande a runtime dal proprio motore e NON hanno
 * righe qui. Il contenuto è completamente libero (qualsiasi materia).
 *
 * `ordine` definisce la sequenza di presentazione quando il quiz non mescola.
 *
 * La correzione avviene SEMPRE LATO SERVER (cfr. quizGestioneService): le
 * opzioni inviate allo studente non riportano il flag `corretta`, e la risposta
 * esatta delle domande aperte non lascia mai il backend prima della correzione.
 * È la differenza sostanziale rispetto ai quiz da template (kana/kanji), dove il
 * client conosce già la soluzione perché deriva da dizionari pubblici.
 */
class DomandaQuiz extends Model {
  /** Dati per lo STAFF: includono la soluzione. Le opzioni le aggiunge il service. */
  toPublicJSON() {
    return {
      id: this.id,
      quizId: this.quiz_id,
      tipo: this.tipo,
      testo: this.testo,
      spiegazione: this.spiegazione,
      mediaUrl: this.media_url,
      rispostaCorretta: this.risposta_corretta,
      risposteAlternative: this.risposte_alternative || [],
      caseSensitive: this.case_sensitive,
      ordine: this.ordine,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /** Dati per lo STUDENTE: nessuna soluzione. Le opzioni le aggiunge il service. */
  toStudenteJSON() {
    return {
      id: this.id,
      tipo: this.tipo,
      testo: this.testo,
      mediaUrl: this.media_url,
    };
  }
}

DomandaQuiz.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    quiz_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'quiz_id',
    },

    tipo: {
      type: DataTypes.ENUM(...TIPI_DOMANDA),
      allowNull: false,
      defaultValue: 'scelta_multipla',
      validate: {
        isIn: {
          args: [TIPI_DOMANDA],
          msg: `Il tipo di domanda deve essere uno di: ${TIPI_DOMANDA.join(', ')}`,
        },
      },
    },

    testo: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Il testo della domanda non può essere vuoto' },
        len: { args: [1, TESTO_MAX], msg: `Il testo della domanda non può superare i ${TESTO_MAX} caratteri` },
      },
    },

    // Spiegazione mostrata dopo la correzione (facoltativa).
    spiegazione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Media di supporto ospitato esternamente (immagine, audio…). Facoltativo.
    media_url: {
      type: DataTypes.STRING(URL_MAX),
      allowNull: true,
      defaultValue: null,
      field: 'media_url',
      validate: {
        is: {
          args: URL_REGEX,
          msg: "L'URL del media deve iniziare con http:// o https://",
        },
      },
    },

    // Solo per 'risposta_breve': la soluzione canonica.
    risposta_corretta: {
      type: DataTypes.STRING(RISPOSTA_MAX),
      allowNull: true,
      defaultValue: null,
      field: 'risposta_corretta',
    },

    // Solo per 'risposta_breve': altre forme accettate (array di stringhe).
    // In MySQL le colonne JSON non ammettono un DEFAULT a livello DB.
    risposte_alternative: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'risposte_alternative',
    },

    // Solo per 'risposta_breve': confronto sensibile alle maiuscole.
    case_sensitive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'case_sensitive',
    },

    // Posizione della domanda nel quiz (ordinamento crescente).
    ordine: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: "L'ordine non può essere negativo" },
      },
    },
  },
  {
    sequelize,
    modelName: 'DomandaQuiz',
    tableName: 'domande_quiz',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Elenco ordinato delle domande di un quiz.
      { fields: ['quiz_id', 'ordine'], name: 'domande_quiz_quiz_ordine' },
    ],
  }
);

// Una domanda appartiene a un quiz. CASCADE: eliminando il quiz spariscono le
// domande (e, a cascata, opzioni e progressi SRS collegati).
DomandaQuiz.belongsTo(Quiz, { as: 'quiz', foreignKey: 'quiz_id', onDelete: 'CASCADE' });
Quiz.hasMany(DomandaQuiz, { as: 'domande', foreignKey: 'quiz_id', onDelete: 'CASCADE' });

DomandaQuiz.TIPI_DOMANDA = TIPI_DOMANDA;
DomandaQuiz.OPZIONI_MIN = OPZIONI_MIN;
DomandaQuiz.OPZIONI_MAX = OPZIONI_MAX;
DomandaQuiz.TESTO_MAX = TESTO_MAX;
DomandaQuiz.RISPOSTA_MAX = RISPOSTA_MAX;
DomandaQuiz.MAX_RISPOSTE_ALTERNATIVE = MAX_RISPOSTE_ALTERNATIVE;
DomandaQuiz.URL_MAX = URL_MAX;
DomandaQuiz.URL_REGEX = URL_REGEX;

module.exports = DomandaQuiz;
