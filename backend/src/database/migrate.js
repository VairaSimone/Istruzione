'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const sequelize = require('../config/database');
const logger = require('../utils/logger');

require('../models/Utente');
require('../models/Invito');
require('../models/FileCaricato');
require('../models/Corso');
require('../models/Capitolo');
require('../models/DocumentoCapitolo');
require('../models/CorsoAula');
require('../models/ProgressoKana');
require('../models/ProgressoKanji');
require('../models/AttivitaGiornaliera');
require('../models/Certificato');

const migrate = async () => {
  try {
    logger.info('Connessione al database...');
    await sequelize.authenticate();
    logger.info('Connessione stabilita con successo.');

    logger.info('Sincronizzazione modelli con il database...');

    await sequelize.sync({ alter: true });

    logger.info('Migrazione completata! Tutte le tabelle sono aggiornate.');
    process.exit(0);
  } catch (err) {
    logger.error('Errore durante la migrazione:', err);
    process.exit(1);
  }
};

migrate();
