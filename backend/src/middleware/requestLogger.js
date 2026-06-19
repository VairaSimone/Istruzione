'use strict';

const morgan = require('morgan');
const logger = require('../utils/logger');

// Formato custom: metodo, URL, status, tempo di risposta, IP
// Compatibile con Winston via stream
const morganFormat =
  ':method :url :status :res[content-length] - :response-time ms - :remote-addr';

const requestLogger = morgan(morganFormat, {
  stream: {
    // Reindirizza morgan verso Winston al livello 'http'
    write: (message) => logger.http(message.trim()),
  },
  // Salta i log per i test automatizzati
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = requestLogger;
