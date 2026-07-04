'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Utente = require('./Utente');

// Livelli JLPT ammessi per l'aula (allineati a ProgressoKanji, ma facoltativi:
// un'aula può essere trasversale e non avere un livello unico).
const LIVELLI_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'];

// Pattern esadecimale per il colore opzionale dell'aula (#RGB o #RRGGBB).
const COLORE_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Classe — AULA VIRTUALE.
 *
 * Rappresenta un gruppo di studio gestito da uno o più insegnanti e composto
 * da più studenti. La membership (sia degli insegnanti che degli studenti) è
 * modellata dalla tabella ponte `ClasseUtente`, così:
 *   - un'aula può avere più insegnanti E più studenti;
 *   - uno studente può appartenere a più aule (molti-a-molti puro);
 *   - non c'è duplicazione di dati anagrafici: l'aula referenzia gli `utenti`
 *     esistenti tramite il ponte, nessun campo copiato.
 *
 * `creata_da` traccia l'insegnante che ha creato l'aula (ownership debole:
 * se l'account viene rimosso l'aula sopravvive con creatore null, restando
 * gestibile dagli altri insegnanti membri o dall'admin).
 *
 * `archiviata` consente l'archiviazione soft (nascondere un'aula a fine anno
 * senza perderne lo storico) in alternativa all'eliminazione definitiva.
 */
class Classe extends Model {
  /** Dati esponibili al client (l'elenco membri è aggiunto dal service). */
  toPublicJSON() {
    return {
      id: this.id,
      nome: this.nome,
      descrizione: this.descrizione,
      annoScolastico: this.anno_scolastico,
      livelloJLPT: this.livello_jlpt,
      colore: this.colore,
      icona: this.icona,
      archiviata: this.archiviata,
      creataDa: this.creata_da,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

Classe.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    nome: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Il nome dell'aula non può essere vuoto" },
        len: { args: [2, 120], msg: "Il nome dell'aula deve avere tra 2 e 120 caratteri" },
      },
    },

    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },

    // Anno scolastico in formato libero ma vincolato (es. "2025/2026").
    anno_scolastico: {
      type: DataTypes.STRING(9),
      allowNull: true,
      defaultValue: null,
      field: 'anno_scolastico',
      validate: {
        is: {
          args: /^\d{4}\/\d{4}$/,
          msg: "L'anno scolastico deve essere nel formato AAAA/AAAA (es. 2025/2026)",
        },
      },
    },

    // Livello JLPT prevalente dell'aula (facoltativo).
    livello_jlpt: {
      type: DataTypes.ENUM(...LIVELLI_JLPT),
      allowNull: true,
      defaultValue: null,
      field: 'livello_jlpt',
      validate: {
        isIn: {
          args: [LIVELLI_JLPT],
          msg: `Il livello JLPT deve essere uno di: ${LIVELLI_JLPT.join(', ')}`,
        },
      },
    },

    // Colore identificativo opzionale (#RGB o #RRGGBB) per la UI.
    colore: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: null,
      validate: {
        is: {
          args: COLORE_REGEX,
          msg: 'Il colore deve essere un valore esadecimale valido (es. #4F46E5)',
        },
      },
    },

    // Nome dell'icona opzionale (chiave lato frontend, non un file).
    icona: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      validate: {
        len: { args: [0, 50], msg: "Il nome dell'icona non può superare i 50 caratteri" },
      },
    },

    // Insegnante creatore (ownership debole). SET NULL se l'account sparisce.
    creata_da: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: 'creata_da',
    },

    // Archiviazione soft: le aule archiviate restano nello storico ma sono
    // escluse dalle liste operative di default.
    archiviata: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Classe',
    tableName: 'classi',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Elenco delle aule create da un insegnante.
      { fields: ['creata_da'], name: 'classi_creata_da' },
      // Filtri comuni della lista aule.
      { fields: ['livello_jlpt'], name: 'classi_livello_jlpt' },
      { fields: ['anno_scolastico'], name: 'classi_anno_scolastico' },
      { fields: ['archiviata'], name: 'classi_archiviata' },
    ],
  }
);

// L'associazione col creatore usa una FK dedicata; la membership vera e propria
// (insegnanti + studenti) è gestita da ClasseUtente per non duplicare dati.
Classe.belongsTo(Utente, { as: 'creatore', foreignKey: 'creata_da', onDelete: 'SET NULL' });
Utente.hasMany(Classe, { as: 'classiCreate', foreignKey: 'creata_da', onDelete: 'SET NULL' });

Classe.LIVELLI_JLPT = LIVELLI_JLPT;
Classe.COLORE_REGEX = COLORE_REGEX;

module.exports = Classe;
