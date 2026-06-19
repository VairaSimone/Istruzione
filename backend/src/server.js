'use strict';

// Carica variabili d'ambiente come PRIMA cosa
require('dotenv').config();

const app = require('./app');
const sequelize = require('./config/database');
const logger = require('./utils/logger');

// Import modelli per registrarli su Sequelize prima della sync
require('./models/Utente');

const PORT = parseInt(process.env.PORT) || 3000;

// ─────────────────────────────────────────────
// AVVIO SERVER
// ─────────────────────────────────────────────
const avviaServer = async () => {
  try {
    // 1. Verifica connessione al DB
    await sequelize.authenticate();
    logger.info('✅ Connessione al database MySQL stabilita.');

    // 2. Sincronizza i modelli con il DB (solo in sviluppo)
    // In produzione usa migrate.js invece
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('✅ Modelli sincronizzati con il database (alter: true).');
    }

    // 3. Avvia il server HTTP
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server avviato su http://localhost:${PORT}`);
      logger.info(`📍 Ambiente: ${process.env.NODE_ENV}`);
    });

    // ─────────────────────────────────────────
    // GRACEFUL SHUTDOWN
    // Gestisce SIGTERM (es. da Docker/Kubernetes/PM2)
    // per chiudere le connessioni in modo pulito
    // ─────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      logger.info(`\n⚠️  Segnale ${signal} ricevuto. Avvio graceful shutdown...`);

      server.close(async () => {
        logger.info('🔌 Server HTTP chiuso.');

        try {
          await sequelize.close();
          logger.info('🔌 Connessione al database chiusa.');
          process.exit(0);
        } catch (err) {
          logger.error('Errore durante la chiusura del database:', err);
          process.exit(1);
        }
      });

      // Forza chiusura dopo 10 secondi se il graceful shutdown si blocca
      setTimeout(() => {
        logger.error('Graceful shutdown timeout. Forzo la chiusura.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // ─────────────────────────────────────────
    // GESTIONE ERRORI NON CATTURATI
    // ─────────────────────────────────────────
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', { reason, promise });
      // In produzione: notifica il servizio di monitoring, poi chiudi
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      server.close(() => process.exit(1));
    });

  } catch (err) {
    logger.error('❌ Impossibile avviare il server:', err);
    process.exit(1);
  }
};

avviaServer();
