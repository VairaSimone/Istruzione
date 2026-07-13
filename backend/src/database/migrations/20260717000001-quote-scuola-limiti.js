'use strict';

const { DataTypes } = require('sequelize');

/**
 * QUOTE DELLA SCUOLA — limiti di STORAGE, UTENTI e INSEGNANTI.
 *
 * L'admin, che è trasversale ai tenant, può dimensionare ogni scuola:
 *
 *   - `limite_storage_byte`  → spazio massimo occupabile dai file caricati
 *                              (video, immagini, documenti). NULL = illimitato.
 *   - `limite_utenti`        → numero massimo di utenti (studenti + insegnanti)
 *                              appartenenti alla scuola. NULL = illimitato.
 *   - `limite_insegnanti`    → sotto-limite: numero massimo di insegnanti.
 *                              NULL = illimitato.
 *
 * Perché COLONNE DEDICATE e non chiavi del blob JSON `impostazioni`?
 * Perché le impostazioni sono modificabili anche dagli INSEGNANTI della scuola
 * (`PATCH /api/scuole/mia/impostazioni`): mettere lì una quota significherebbe
 * lasciare che una scuola alzi da sé i propri limiti. Le quote sono invece un
 * atto dell'ADMIN e restano fuori dalla portata dello staff (colonne scrivibili
 * solo dagli endpoint admin). Inoltre il conteggio dell'occupazione richiede
 * aggregazioni indicizzate (SUM su `file_caricati`, COUNT su `utenti`): colonne
 * numeriche si prestano meglio di un blob.
 *
 * Tutte le colonne sono NULLABLE con default NULL: le scuole esistenti nascono
 * SENZA limiti (comportamento invariato). L'admin li imposta quando vuole.
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.addColumn('scuole', 'limite_storage_byte', {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('scuole', 'limite_utenti', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('scuole', 'limite_insegnanti', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.removeColumn('scuole', 'limite_insegnanti');
    await queryInterface.removeColumn('scuole', 'limite_utenti');
    await queryInterface.removeColumn('scuole', 'limite_storage_byte');
  },
};
