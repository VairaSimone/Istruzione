'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

// Registra i modelli (e quindi le associazioni) prima di applicare le migrazioni.
require('../models/Utente');
require('../models/Classe');
require('../models/ClasseUtente');
require('../models/Compito');
require('../models/CompitoAssegnazione');
require('../models/CompitoConsegna');
require('../models/Messaggio');
require('../models/MessaggioDestinatario');
require('../models/Invito');
require('../models/ProgressoKana');
require('../models/ProgressoKanji');
require('../models/BadgeUtente');
require('../models/AttivitaGiornaliera');

/**
 * Runner delle migrazioni versionate basato su Umzug.
 *
 * Sostituisce `sequelize.sync({ alter: true })` (non sicuro in produzione)
 * con un sistema di migrazioni incrementali tracciate nella tabella
 * `SequelizeMeta`. Ogni file in `migrations/` espone `up` e `down`.
 *
 * Uso:
 *   node src/database/umzug.js up     # applica le migrazioni pendenti
 *   node src/database/umzug.js down   # annulla l'ultima migrazione
 *   npm run db:migrate
 */
const umzug = new Umzug({
  migrations: {
    glob: ['migrations/*.js', { cwd: __dirname }],
    resolve: ({ name, path: migrationPath, context }) => {
      const migration = require(migrationPath);
      return {
        name,
        up: async () => migration.up({ context }),
        down: async () => migration.down({ context }),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
  logger: {
    info: (msg) => logger.info(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    warn: (msg) => logger.warn(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    error: (msg) => logger.error(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    debug: () => {},
  },
});

module.exports = umzug;

// Esecuzione diretta da CLI
if (require.main === module) {
  const azione = process.argv[2] || 'up';

  (async () => {
    try {
      await sequelize.authenticate();
      if (azione === 'down') {
        await umzug.down();
      } else {
        await umzug.up();
      }
      logger.info('Migrazioni completate con successo.');
      await sequelize.close();
      process.exit(0);
    } catch (err) {
      logger.error(`Errore durante le migrazioni: ${err.message}`);
      process.exit(1);
    }
  })();
}
