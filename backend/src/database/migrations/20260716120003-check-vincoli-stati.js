'use strict';

/**
 * Vincolo CHECK su `pagamenti.stato`.
 *
 * ─────────────────────────────────────────────
 * LA CONVENZIONE, E IL SUO BUCO
 * ─────────────────────────────────────────────
 * Il progetto dichiara «STRING, non ENUM, per non richiedere ALTER» sui campi di
 * tipo/stato, con una ragione buona: allargare un ENUM riscrive la tabella, e su
 * tabelle grosse è un fermo macchina.
 *
 * Il prezzo è che l'UNICA difesa diventa `validate.isIn` di Sequelize, che vive
 * nel modello e viene saltato da tutto ciò che non passa dall'istanza:
 * `bulkUpdate`, `queryInterface`, le query dirette, le migrazioni stesse, e
 * qualunque accesso al database che non sia questa applicazione. Un valore fuori
 * vocabolario entrato per una di queste vie non lo rifiuta nessuno: resta lì, e
 * lo scopre il primo `switch` che non lo contempla.
 *
 * Su MySQL 8 un CHECK chiude il buco senza pagare il prezzo dell'ENUM: stessa
 * garanzia (è il database a rifiutare, chiunque scriva), ma allargarlo è DROP +
 * ADD del vincolo — metadati, non una riscrittura.
 *
 * ─────────────────────────────────────────────
 * PERCHÉ SOLO `pagamenti.stato`
 * ─────────────────────────────────────────────
 * Le colonne STRING di tipo/stato scoperte sono sei. Cinque NON prendono il
 * vincolo, e non per dimenticanza:
 *
 *   compiti.tipo_attivita        → registro `tipiAttivita`
 *   eventi_calendario.tipo       → registro `tipiEvento`
 *   notifiche_email.tipo         → registro `tipiNotifica`
 *   richieste_contatto.tipo      → registro `tipiRichiestaContatto`
 *   richieste_contatto.stato     → registro `tipiRichiestaContatto`
 *
 * Sono tutte governate da REGISTRI DICHIARATIVI che promettono, per iscritto,
 * «aggiungere un tipo non richiede alcuna migrazione». Metterci un CHECK
 * significherebbe rimangiarsi quella promessa e reintrodurre esattamente il
 * costo per cui la convenzione STRING è nata: aggiungere una voce a un registro
 * tornerebbe a richiedere una migrazione. Il vincolo peggiorerebbe il progetto,
 * non lo migliorerebbe.
 *
 * `pagamenti.stato` è di un'altra natura. Non è un registro estendibile: è un
 * ciclo di vita CHIUSO, dettato dal flusso di Stripe e non dalle nostre voglie —
 * `in_attesa` → `completato` | `fallito` | `annullato` | `rimborsato`, e basta.
 * È anche l'unica di queste colonne su cui poggia un dato CONTABILE: un valore
 * spurio qui non è una voce di menu sbagliata, è un ordine in uno stato che
 * nessun codice sa gestire e che nessuna riconciliazione ritroverà.
 *
 * Per completezza: `inviti.stato`, `inviti.ruolo`, `utenti.stato`,
 * `notifiche_email.stato`, `corsi.stato`, `compiti.stato` e le altre colonne
 * di stato del progetto sono ENUM — il database le vincola già. Non serve nulla.
 *
 * ─────────────────────────────────────────────
 * ALLINEAMENTO
 * ─────────────────────────────────────────────
 * Il vocabolario qui sotto DEVE combaciare con `STATI_PAGAMENTO` in
 * `models/Pagamento.js`. Aggiungere uno stato richiede una migrazione che
 * ricrei il vincolo: è il prezzo, ed è consapevole — su un ciclo di vita che
 * cambia una volta ogni mai, vale la garanzia che compra.
 */

const TABELLA = 'pagamenti';
const COLONNA = 'stato';
const VINCOLO = 'chk_pagamenti_stato';

// Deve restare identico a `STATI_PAGAMENTO` di models/Pagamento.js.
const STATI = ['in_attesa', 'completato', 'fallito', 'annullato', 'rimborsato'];

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // Un CHECK non si aggiunge se i dati esistenti lo violano già. Fallire con
    // l'errore di vincolo grezzo di MySQL non direbbe a nessuno cosa sistemare:
    // meglio dirlo prima, e per nome.
    const [righe] = await sequelize.query(
      `SELECT DISTINCT \`${COLONNA}\` AS v FROM \`${TABELLA}\` WHERE \`${COLONNA}\` IS NOT NULL`
    );
    const fuoriVocabolario = righe.map((r) => r.v).filter((v) => !STATI.includes(v));
    if (fuoriVocabolario.length) {
      throw new Error(
        `Impossibile applicare il CHECK su ${TABELLA}.${COLONNA}: nel database esistono già i valori ` +
          `${fuoriVocabolario.map((v) => `"${v}"`).join(', ')}, fuori dal vocabolario ` +
          `[${STATI.join(', ')}]. Correggi quelle righe, poi rilancia la migrazione.`
      );
    }

    const elenco = STATI.map((v) => `'${v}'`).join(', ');
    await sequelize.query(
      `ALTER TABLE \`${TABELLA}\`
         ADD CONSTRAINT \`${VINCOLO}\`
         CHECK (\`${COLONNA}\` IN (${elenco}))`
    );
  },

  down: async ({ context: queryInterface }) => {
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${TABELLA}\` DROP CONSTRAINT \`${VINCOLO}\``
      );
    } catch (_) {
      /* già assente */
    }
  },
};
