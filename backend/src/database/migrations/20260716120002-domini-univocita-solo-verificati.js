'use strict';

/**
 * L'univocità di `domini_scuola.dominio` passa da GLOBALE a «solo tra i VERIFICATI».
 *
 * ─────────────────────────────────────────────
 * IL PROBLEMA: SQUATTING
 * ─────────────────────────────────────────────
 * `aggiungiDominio` permette a un INSEGNANTE di registrare qualunque host sulla
 * propria scuola. Il dominio nasce NON verificato, quindi è inerte: non risolve
 * il tenant, non ottiene certificati, non fa nulla. Ma l'indice UNIQUE era
 * globale, e quindi bastava a BLOCCARE l'host per tutti gli altri:
 *
 *     l'insegnante della scuola A registra "liceo-concorrente.it"
 *     → la scuola B, legittima proprietaria, riceve 409 DOMINIO_TAKEN
 *     → e solo un admin di piattaforma può sbloccarla
 *
 * Una riga inerte che nega un diritto reale a un altro tenant. Il vincolo stava
 * proteggendo la cosa sbagliata: non c'è alcun bisogno che due scuole non
 * possano *chiedere* lo stesso host — c'è bisogno che non lo *ottengano* in due.
 *
 * ─────────────────────────────────────────────
 * LA REGOLA GIUSTA
 * ─────────────────────────────────────────────
 * Più richieste NON verificate per lo stesso host possono coesistere: sono
 * candidature, e una candidatura non toglie nulla a nessuno. Al più UNA può
 * essere verificata, perché la verifica è ciò che fa risolvere il tenant, ed è
 * riservata all'admin — che è la persona che controlla davvero a chi appartiene
 * quell'host.
 *
 * ─────────────────────────────────────────────
 * COME SI IMPONE A LIVELLO DI DATABASE
 * ─────────────────────────────────────────────
 * Non basta spostare il controllo nel service: fra la SELECT e la INSERT c'è
 * sempre una finestra, e due admin che verificano lo stesso host nello stesso
 * istante produrrebbero due domini verificati identici — cioè un tenant che
 * risolve a caso.
 *
 * Su MySQL 8 la si esprime con una COLONNA GENERATA:
 *
 *     dominio_verificato = IF(verificato, dominio, NULL)
 *
 * più un indice UNIQUE su di essa. In SQL i NULL non confliggono mai tra loro:
 * tutte le righe non verificate finiscono a NULL e convivono; le verificate
 * portano il dominio e si escludono a vicenda. Nessun trigger, nessun lock,
 * nessuna logica applicativa da ricordarsi.
 *
 * Su PostgreSQL la stessa cosa si ottiene con un indice parziale
 * (`... WHERE verificato`). Il progetto gira su MySQL 8; il ramo Postgres c'è
 * per coerenza con le altre migrazioni, che lo prevedono.
 *
 * ─────────────────────────────────────────────
 * DATI ESISTENTI
 * ─────────────────────────────────────────────
 * Nessuna perdita: l'indice vecchio era più stretto di quello nuovo, quindi
 * tutte le righe attuali soddisfano già il vincolo. Il `down` invece può
 * fallire, ed è giusto così: se nel frattempo sono nati due host uguali non
 * verificati, tornare all'univocità globale richiede una decisione umana su
 * quale tenere.
 */

const NOME_COLONNA = 'dominio_verificato';
const NOME_INDICE = 'domini_scuola_dominio_verificato_unico';

/** Rimuove un indice ignorando l'assenza (le `down` altrui fanno lo stesso). */
const rimuoviIndiceSePresente = async (queryInterface, tabella, nome) => {
  try {
    await queryInterface.removeIndex(tabella, nome);
  } catch (_) {
    /* già assente */
  }
};

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();

    // 1. Via l'univocità GLOBALE, che è ciò che rendeva possibile lo squatting.
    await rimuoviIndiceSePresente(queryInterface, 'domini_scuola', 'domini_scuola_dominio');

    // 2. L'indice di lookup resta, ma NON univoco: `perDominio` continua a
    //    risolvere l'host con una lettura indicizzata, come prima.
    await queryInterface.addIndex('domini_scuola', ['dominio'], {
      name: 'domini_scuola_dominio',
    });

    // 3. Univocità ristretta ai soli VERIFICATI.
    if (dialect === 'mysql' || dialect === 'mariadb') {
      await sequelize.query(
        `ALTER TABLE domini_scuola
           ADD COLUMN ${NOME_COLONNA} VARCHAR(255)
           GENERATED ALWAYS AS (IF(verificato = 1, dominio, NULL)) VIRTUAL`
      );
      await sequelize.query(
        `CREATE UNIQUE INDEX ${NOME_INDICE} ON domini_scuola (${NOME_COLONNA})`
      );
    } else if (dialect === 'postgres') {
      await sequelize.query(
        `CREATE UNIQUE INDEX ${NOME_INDICE} ON domini_scuola (dominio) WHERE verificato`
      );
    }
  },

  down: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();

    await rimuoviIndiceSePresente(queryInterface, 'domini_scuola', NOME_INDICE);
    if (dialect === 'mysql' || dialect === 'mariadb') {
      await sequelize.query(`ALTER TABLE domini_scuola DROP COLUMN ${NOME_COLONNA}`);
    }

    await rimuoviIndiceSePresente(queryInterface, 'domini_scuola', 'domini_scuola_dominio');

    // Può fallire se nel frattempo esistono host duplicati non verificati: è
    // voluto. Sceglierne uno d'ufficio significherebbe cancellare la richiesta
    // di una scuola senza dirglielo.
    await queryInterface.addIndex('domini_scuola', ['dominio'], {
      name: 'domini_scuola_dominio',
      unique: true,
    });
  },
};
