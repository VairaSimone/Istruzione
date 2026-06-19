'use strict';

const { Sequelize } = require('sequelize');

// Istanza Sequelize configurata con mysql2 come driver nativo
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',

    // Pool di connessioni: evita di aprire/chiudere una connessione per ogni query
    pool: {
      max: 10,         // connessioni simultanee massime
      min: 0,          // connessioni minime mantenute
      acquire: 30000,  // ms prima di errore "Unable to acquire connection"
      idle: 10000,     // ms di inattività prima di rilasciare la connessione
    },

    // Logging: in produzione disabilitato, in sviluppo mostra le query
    logging: process.env.NODE_ENV === 'development'
      ? (msg) => require('../utils/logger').debug(msg)
      : false,

    define: {
      // Usa snake_case nel DB (created_at, updated_at) invece di createdAt
      underscored: true,
      // Non aggiunge il suffisso "s" ai nomi delle tabelle
      freezeTableName: true,
      // Aggiunge automaticamente created_at e updated_at
      timestamps: true,
    },

    dialectOptions: {
      // Gestione corretta dei timezone
      dateStrings: true,
      typeCast: true,
    },

    timezone: '+01:00', // Europe/Rome
  }
);

module.exports = sequelize;
