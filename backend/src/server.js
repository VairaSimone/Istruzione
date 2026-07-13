'use strict';

require('dotenv').config();

const app = require('./app');
const sequelize = require('./config/database');
const logger = require('./utils/logger');

// L'ordine dei require conta: i modelli registrano le proprie associazioni al
// momento del caricamento. `Scuola` (tenant) è la radice e va caricata per prima.
require('./models/Scuola');
require('./models/DominioScuola');
require('./models/RichiestaContatto');
require('./models/Utente');
require('./models/Classe');
require('./models/ClasseUtente');
require('./models/Compito');
require('./models/CompitoAssegnazione');
require('./models/CompitoConsegna');
require('./models/Messaggio');
require('./models/MessaggioDestinatario');
require('./models/Invito');
require('./models/Quiz');
require('./models/QuizAula');
require('./models/DomandaQuiz');
require('./models/OpzioneQuiz');
require('./models/ProgressoDomanda');
require('./models/Corso');
require('./models/Capitolo');
require('./models/DocumentoCapitolo');
require('./models/CorsoAula');
require('./models/FileCaricato');
require('./models/BadgeUtente');
require('./models/ProgressoKana');
require('./models/ProgressoKanji');
require('./models/AttivitaGiornaliera');
require('./models/NotificaEmail');
require('./models/EventoCalendario');
require('./models/EventoDestinatario');
require('./models/Certificato');

const schedulerService = require('./services/schedulerService');

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

    // 4. Avvia i job periodici (digest notifiche + scansione scadenze compiti).
    //    Spegnibile con NOTIFICHE_SCHEDULER_ATTIVO=false.
    schedulerService.avvia();

    // ─────────────────────────────────────────
    // GRACEFUL SHUTDOWN
    // Gestisce SIGTERM (es. da Docker/Kubernetes/PM2)
    // per chiudere le connessioni in modo pulito
    // ─────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      logger.info(`\n⚠️  Segnale ${signal} ricevuto. Avvio graceful shutdown...`);

      // Ferma i job periodici prima di chiudere le connessioni.
      schedulerService.arresta();

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
