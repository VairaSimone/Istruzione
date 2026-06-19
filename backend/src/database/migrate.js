'use strict';

// Carica le variabili d'ambiente PRIMA di tutto il resto
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const sequelize = require('../config/database');
const logger = require('../utils/logger');

// Import del modello per registrarlo su Sequelize
require('../models/Utente');

const migrate = async () => {
  try {
    logger.info('Connessione al database...');
    await sequelize.authenticate();
    logger.info('Connessione stabilita con successo.');

    logger.info('Sincronizzazione modelli con il database...');

    // alter: true → aggiorna le colonne esistenti senza distruggere i dati
    // force: true → DROP + ricrea (solo sviluppo!)
    await sequelize.sync({ alter: true });

    logger.info('Migrazione completata! Tutte le tabelle sono aggiornate.');
    process.exit(0);
  } catch (err) {
    logger.error('Errore durante la migrazione:', err);
    process.exit(1);
  }
};

migrate();
