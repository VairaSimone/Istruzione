'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Corso = require('./Corso');
const Classe = require('./Classe');
const Utente = require('./Utente');

/**
 * CorsoAula — DISPONIBILITÀ di un corso presso un'aula (tabella ponte).
 *
 * Modella la relazione molti-a-molti tra `corsi` e `classi` (aule): un corso
 * può essere reso disponibile a più aule e un'aula può avere più corsi. Lo
 * staff sceglie, per ogni aula, quali corsi rendere disponibili.
 *
 * Uno studente può guardare un corso (quando vuole) se e solo se:
 *   - il corso è 'pubblicato', E
 *   - esiste una riga CorsoAula che lo collega a un'aula di cui lo studente è
 *     membro-studente.
 *
 * ISOLAMENTO TRA SCUOLE: il service consente di creare una riga qui SOLO se il
 * corso e l'aula appartengono alla STESSA scuola. Poiché gli studenti vedono i
 * corsi esclusivamente tramite le proprie aule (necessariamente della loro
 * scuola), un corso non può in alcun modo diventare visibile a un'altra scuola.
 *
 * Il vincolo di unicità (corso_id + classe_id) rende idempotente la messa a
 * disposizione ed evita righe duplicate.
 */
class CorsoAula extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      corsoId: this.corso_id,
      classeId: this.classe_id,
      resoDisponibileDa: this.reso_disponibile_da,
      created_at: this.created_at,
    };
  }
}

CorsoAula.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    corso_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'corso_id',
    },

    classe_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'classe_id',
    },

    // Chi ha reso disponibile il corso all'aula (audit leggero). SET NULL se
    // l'autore viene rimosso.
    reso_disponibile_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'reso_disponibile_da',
    },
  },
  {
    sequelize,
    modelName: 'CorsoAula',
    tableName: 'corso_aule',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità: un corso è reso disponibile a una data aula una sola volta.
      { unique: true, fields: ['corso_id', 'classe_id'], name: 'corso_aule_corso_classe' },
      // Elenco delle aule a cui un corso è disponibile.
      { fields: ['corso_id'], name: 'corso_aule_corso' },
      // Elenco dei corsi disponibili a un'aula (vista studente).
      { fields: ['classe_id'], name: 'corso_aule_classe' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni molti-a-molti (via ponte) + accesso diretto al ponte.
// ─────────────────────────────────────────────
Corso.belongsToMany(Classe, {
  through: CorsoAula,
  as: 'auleDisponibili',
  foreignKey: 'corso_id',
  otherKey: 'classe_id',
  onDelete: 'CASCADE',
});
Classe.belongsToMany(Corso, {
  through: CorsoAula,
  as: 'corsiDisponibili',
  foreignKey: 'classe_id',
  otherKey: 'corso_id',
  onDelete: 'CASCADE',
});

CorsoAula.belongsTo(Corso, { as: 'corso', foreignKey: 'corso_id', onDelete: 'CASCADE' });
Corso.hasMany(CorsoAula, { as: 'disponibilita', foreignKey: 'corso_id', onDelete: 'CASCADE' });

CorsoAula.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Classe.hasMany(CorsoAula, { as: 'corsiDisponibilita', foreignKey: 'classe_id', onDelete: 'CASCADE' });

CorsoAula.belongsTo(Utente, { as: 'autore', foreignKey: 'reso_disponibile_da', onDelete: 'SET NULL' });

module.exports = CorsoAula;
