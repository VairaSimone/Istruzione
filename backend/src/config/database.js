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
    // Timezone fisso a UTC: nessun offset hardcoded legato all'ora legale.
    // Tutte le date vengono persistite e lette in UTC; la conversione al
    // fuso orario locale è responsabilità del client.
    timezone: '+00:00',
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

    // ─────────────────────────────────────────────
    // NESSUN `dateStrings`, e non è una svista.
    //
    // Con `dateStrings: true` il driver restituiva i DATETIME come STRINGHE nel
    // formato di MySQL — '2026-07-14 20:33:36' — senza `Z` né offset. I vari
    // `toPublicJSON()` le rispedivano tali e quali al client, e nel browser
    //
    //     new Date('2026-07-14 20:33:36')
    //
    // interpreta quel valore come ORA LOCALE. Un istante persistito in UTC
    // tornava indietro sfasato di due ore in Italia d'estate: scadenze dei
    // compiti, eventi del calendario e scadenze degli inviti mostravano
    // un orario che non era quello salvato. Il codice applicativo lo aggirava
    // dove capitava (confrontando stringa-locale con locale, coerente per caso),
    // ma il contratto verso il client restava ambiguo.
    //
    // Senza l'opzione, Sequelize restituisce oggetti `Date` e `JSON.stringify`
    // li serializza in ISO-8601 con la `Z`: '2026-07-14T20:33:36.000Z'. Non
    // ambiguo, non interpretabile, uguale per tutti i fusi.
    //
    // Le colonne DATEONLY restano stringhe 'YYYY-MM-DD' — è il loro tipo, non
    // un istante — e `utils/dateUtils.js` le gestisce già così.
    // ─────────────────────────────────────────────

  }
);

module.exports = sequelize;
