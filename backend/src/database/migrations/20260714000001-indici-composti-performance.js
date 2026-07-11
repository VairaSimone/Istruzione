'use strict';

/**
 * INDICI COMPOSITI per le query più frequenti (performance DB).
 *
 * Due indici che coprono contemporaneamente il FILTRO e l'ORDINAMENTO delle
 * viste più calde, evitando che MySQL debba ordinare in memoria (filesort) o
 * usare solo l'indice a colonna singola:
 *
 *   - `messaggi (mittente_id, created_at)`
 *       → messaggiService.elencoInviati: WHERE mittente_id = ? ORDER BY created_at DESC
 *
 *   - `compiti (creato_da, data_scadenza)`
 *       → calendarioService / compitiService: WHERE creato_da = ?
 *         ORDER BY data_scadenza ASC (ed eventuale range sulla scadenza)
 *
 * Gli indici a colonna singola preesistenti (`messaggi_mittente`,
 * `compiti_creato_da`) restano invariati: qui si AGGIUNGE soltanto. I nomi
 * coincidono con quelli dichiarati nei modelli Sequelize, così `sync` e
 * migrazioni convergono sullo stesso schema.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.addIndex('messaggi', ['mittente_id', 'created_at'], {
      name: 'messaggi_mittente_created',
    });
    await queryInterface.addIndex('compiti', ['creato_da', 'data_scadenza'], {
      name: 'compiti_creato_da_scadenza',
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.removeIndex('compiti', 'compiti_creato_da_scadenza');
    await queryInterface.removeIndex('messaggi', 'messaggi_mittente_created');
  },
};
