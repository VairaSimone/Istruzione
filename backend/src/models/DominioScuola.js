'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Scuola = require('./Scuola');
const { DOMINIO_MAX, DOMINIO_REGEX, normalizzaDominio } = require('../utils/dominio');

/**
 * DominioScuola — DOMINIO PERSONALIZZATO di un tenant.
 *
 * Ogni scuola può essere raggiunta da uno o più domini propri
 * (`liceo-manzoni.it`, `www.liceo-manzoni.it`) su cui gira la stessa
 * piattaforma. L'host della richiesta diventa così il modo per riconoscere il
 * tenant PRIMA del login e servire la homepage pubblica della scuola.
 *
 * Perché una tabella dedicata (e non una chiave nel blob `impostazioni`)?
 * Perché la risoluzione host → scuola deve essere una SELECT indicizzata sul
 * dominio, eseguita a ogni richiesta pubblica: cercarla dentro il JSON di ogni
 * scuola richiederebbe una scansione. La colonna `dominio` è UNIQUE: un dominio
 * appartiene a una sola scuola.
 *
 * SICUREZZA — `verificato` (fail-closed):
 *   un dominio risolve il tenant SOLO se `verificato = true`. Così un utente non
 *   può dirottare il traffico di un host che non controlla semplicemente
 *   registrandolo. I domini aggiunti dall'ADMIN (trasversale e fidato) nascono
 *   già verificati; quelli aggiunti dallo STAFF della scuola restano in attesa
 *   finché un admin non li verifica (dopo aver accertato il puntamento DNS).
 *
 * `principale` marca il dominio canonico della scuola: è quello usato per
 * costruire gli URL assoluti (es. link nelle email) quando la scuola ha un
 * proprio dominio. Al più uno per scuola (garantito dal service).
 */
class DominioScuola extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      scuolaId: this.scuola_id,
      dominio: this.dominio,
      verificato: this.verificato,
      principale: this.principale,
      note: this.note,
      verificato_il: this.verificato_il,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

DominioScuola.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    scuola_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'scuole', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },

    // Host normalizzato (minuscolo, senza schema/porta/percorso). Univoco su
    // tutta la piattaforma: un dominio identifica una sola scuola.
    dominio: {
      type: DataTypes.STRING(DOMINIO_MAX),
      allowNull: false,
      // NESSUNA univocità globale: più scuole possono CHIEDERE lo stesso host
      // (richieste non verificate, inerti). Al più una può averlo VERIFICATO, e
      // quel vincolo vive sull'indice univoco della colonna generata
      // `dominio_verificato` (cfr. migrazione 20260716120002). Dichiararlo qui
      // rimetterebbe l'univocità globale e riaprirebbe lo squatting.
      set(value) {
        // Normalizzazione difensiva: qualunque via di scrittura passa da qui.
        const norm = normalizzaDominio(value);
        this.setDataValue('dominio', norm || (value == null ? value : String(value).trim().toLowerCase()));
      },
      validate: {
        is: {
          args: DOMINIO_REGEX,
          msg: 'Il dominio non è valido (es. liceo-manzoni.it).',
        },
      },
    },

    // Gate di risoluzione: un dominio non verificato non risolve alcun tenant.
    verificato: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Dominio canonico della scuola (al più uno, garantito dal service).
    principale: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Annotazione libera per lo staff (es. "dominio provvisorio open day").
    note: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },

    verificato_il: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'DominioScuola',
    tableName: 'domini_scuola',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      // Lookup dell'host: indicizzato ma NON univoco (cfr. sopra).
      { fields: ['dominio'], name: 'domini_scuola_dominio' },
      { fields: ['scuola_id'], name: 'domini_scuola_scuola_id' },
      // Risoluzione pubblica: host verificato → scuola, in una lettura indicizzata.
      { fields: ['dominio', 'verificato'], name: 'domini_scuola_dominio_verificato' },
    ],
  }
);

DominioScuola.belongsTo(Scuola, { as: 'scuola', foreignKey: 'scuola_id', onDelete: 'CASCADE' });
Scuola.hasMany(DominioScuola, { as: 'domini', foreignKey: 'scuola_id', onDelete: 'CASCADE' });

module.exports = DominioScuola;
