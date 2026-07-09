'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Quiz = require('./Quiz');
const Classe = require('./Classe');
const Utente = require('./Utente');

/**
 * QuizAula — ABILITAZIONE di un quiz presso un'aula (tabella ponte).
 *
 * Modella la relazione molti-a-molti tra `quiz` e `classi` (aule): un quiz può
 * essere abilitato per più aule e un'aula può avere più quiz attivi. Lo staff
 * sceglie, per ogni aula, quali quiz abilitare — anche quiz completamente
 * diversi tra loro (una prima abilita il quiz di hiragana, una terza il quiz di
 * grammatica avanzata, un'altra classe un quiz di matematica).
 *
 * Uno studente può giocare un quiz se e solo se:
 *   - il quiz è 'pubblicato', E
 *   - esiste una riga QuizAula che lo collega a un'aula di cui lo studente è
 *     membro-studente.
 *
 * ISOLAMENTO TRA SCUOLE: il service consente di creare una riga qui SOLO se il
 * quiz e l'aula appartengono alla STESSA scuola. Poiché gli studenti vedono i
 * quiz esclusivamente tramite le proprie aule (necessariamente della loro
 * scuola), un quiz non può in alcun modo diventare visibile a un'altra scuola.
 *
 * Il vincolo di unicità (quiz_id + classe_id) rende idempotente l'abilitazione
 * ed evita righe duplicate.
 */
class QuizAula extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      quizId: this.quiz_id,
      classeId: this.classe_id,
      abilitatoDa: this.abilitato_da,
      created_at: this.created_at,
    };
  }
}

QuizAula.init(
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

    classe_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'classe_id',
    },

    // Chi ha abilitato il quiz per l'aula (audit leggero). SET NULL se l'autore
    // viene rimosso.
    abilitato_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'abilitato_da',
    },
  },
  {
    sequelize,
    modelName: 'QuizAula',
    tableName: 'quiz_aule',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità: un quiz è abilitato per una data aula una sola volta.
      { unique: true, fields: ['quiz_id', 'classe_id'], name: 'quiz_aule_quiz_classe' },
      // Elenco delle aule in cui un quiz è abilitato.
      { fields: ['quiz_id'], name: 'quiz_aule_quiz' },
      // Elenco dei quiz abilitati per un'aula (vista studente).
      { fields: ['classe_id'], name: 'quiz_aule_classe' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni molti-a-molti (via ponte) + accesso diretto al ponte.
// ─────────────────────────────────────────────
Quiz.belongsToMany(Classe, {
  through: QuizAula,
  as: 'auleAbilitate',
  foreignKey: 'quiz_id',
  otherKey: 'classe_id',
  onDelete: 'CASCADE',
});
Classe.belongsToMany(Quiz, {
  through: QuizAula,
  as: 'quizAbilitati',
  foreignKey: 'classe_id',
  otherKey: 'quiz_id',
  onDelete: 'CASCADE',
});

QuizAula.belongsTo(Quiz, { as: 'quiz', foreignKey: 'quiz_id', onDelete: 'CASCADE' });
Quiz.hasMany(QuizAula, { as: 'abilitazioni', foreignKey: 'quiz_id', onDelete: 'CASCADE' });

QuizAula.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(QuizAula, { as: 'quizAbilitazioni', foreignKey: 'classe_id', onDelete: 'CASCADE' });

QuizAula.belongsTo(Utente, { as: 'autore', foreignKey: 'abilitato_da', onDelete: 'SET NULL' });

module.exports = QuizAula;
