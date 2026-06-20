'use strict';

const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * Anonimizza un indirizzo IP per ridurre l'esposizione di PII nei log (GDPR):
 * IPv4 -> ultimo ottetto azzerato; IPv6 -> ultimi gruppi rimossi.
 */
const anonymizeIp = (ip) => {
  if (!ip) return '-';
  let value = ip;
  // Normalizza il formato IPv4-mapped IPv6 (es. ::ffff:1.2.3.4)
  if (value.startsWith('::ffff:')) {
    value = value.substring(7);
  }
  if (value.includes('.')) {
    const parts = value.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
    return value;
  }
  if (value.includes(':')) {
    const segments = value.split(':');
    return segments.slice(0, Math.max(0, segments.length - 4)).join(':') + '::';
  }
  return value;
};

// URL senza query string: evita di loggare token presenti come ?token=...
morgan.token('safe-url', (req) => (req.originalUrl || req.url || '').split('?')[0]);
morgan.token('anon-ip', (req) => anonymizeIp(req.ip));

const morganFormat =
  ':method :safe-url :status :res[content-length] - :response-time ms - :anon-ip';

const requestLogger = morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim()),
  },
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = requestLogger;