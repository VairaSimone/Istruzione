'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');
const Classe = require('./Classe');

// Ruolo dell'utente ALL'INTERNO dell'aula. Distinto dal ruolo globale
// (`Utente.ruolo`): un insegnante può essere membro-insegnante di molte aule,
// uno studente membro-studente di molte aule.
const RUOLI_CLASSE = ['insegnante', 'studente'];

/**
 * ClasseUtente — tabella PONTE della relazione molti-a-molti tra `classi` e
 * `utenti`, arricchita dal ruolo nell'aula.
 *
 * Un'unica tabella modella sia gli insegnanti che gli studenti dell'aula
 * (discriminati da `ruolo_nella_classe`): niente tabelle separate, niente
 * ridondanza. Il vincolo di unicità (classe_id + utente_id) garantisce un
 * solo ruolo per utente in una data aula.
 *
 * Cancellazioni a cascata: eliminando un'aula o un utente spariscono le
 * relative righe di membership, senza lasciare record orfani.
 */
class ClasseUtente extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      classeId: this.classe_id,
      utenteId: this.utente_id,
      ruoloNellaClasse: this.ruolo_nella_classe,
      aggiuntoDa: this.aggiunto_da,
      created_at: this.created_at,
    };
  }
}

ClasseUtente.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    classe_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'classe_id',
    },

    utente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'utente_id',
    },

    ruolo_nella_classe: {
      type: DataTypes.ENUM(...RUOLI_CLASSE),
      allowNull: false,
      field: 'ruolo_nella_classe',
      validate: {
        isIn: {
          args: [RUOLI_CLASSE],
          msg: `Il ruolo nell'aula deve essere uno di: ${RUOLI_CLASSE.join(', ')}`,
        },
      },
    },

    // Chi ha aggiunto/invitato questo membro (audit leggero). SET NULL se
    // l'autore viene rimosso.
    aggiunto_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'aggiunto_da',
    },
  },
  {
    sequelize,
    modelName: 'ClasseUtente',
    tableName: 'classe_utenti',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Unicità: un utente ha un solo ruolo in una data aula. È anche la chiave
      // che rende idempotente l'aggiunta di un membro.
      { unique: true, fields: ['classe_id', 'utente_id'], name: 'classe_utenti_classe_utente' },
      // Elenco membri di un'aula filtrato per ruolo (insegnanti / studenti).
      { fields: ['classe_id', 'ruolo_nella_classe'], name: 'classe_utenti_classe_ruolo' },
      // Elenco delle aule di un utente (le "mie aule").
      { fields: ['utente_id'], name: 'classe_utenti_utente' },
    ],
  }
);

// ─────────────────────────────────────────────
// Associazioni molti-a-molti (via ponte) + accesso diretto al ponte.
// ─────────────────────────────────────────────
Classe.belongsToMany(Utente, {
  through: ClasseUtente,
  as: 'membri',
  foreignKey: 'classe_id',
  otherKey: 'utente_id',
  onDelete: 'CASCADE',
});
Utente.belongsToMany(Classe, {
  through: ClasseUtente,
  as: 'aule',
  foreignKey: 'utente_id',
  otherKey: 'classe_id',
  onDelete: 'CASCADE',
});

ClasseUtente.belongsTo(Classe, { as: 'classe', foreignKey: 'classe_id', onDelete: 'CASCADE' });
ClasseUtente.belongsTo(Utente, { as: 'utente', foreignKey: 'utente_id', onDelete: 'CASCADE' });
Classe.hasMany(ClasseUtente, { as: 'iscrizioni', foreignKey: 'classe_id', onDelete: 'CASCADE' });
Utente.hasMany(ClasseUtente, { as: 'iscrizioniClasse', foreignKey: 'utente_id', onDelete: 'CASCADE' });

ClasseUtente.RUOLI_CLASSE = RUOLI_CLASSE;

module.exports = ClasseUtente;
