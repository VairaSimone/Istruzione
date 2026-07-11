'use strict';

const { DataTypes } = require('sequelize');

/**
 * CERTIFICAZIONI — certificati di fine corso.
 *
 * Nuova tabella `certificati`: attestato rilasciato da un insegnante a uno
 * studente che ha completato il proprio percorso. Il PDF NON è persistito su
 * disco: viene rigenerato on-demand dallo snapshot congelato nella colonna JSON
 * `contenuto` (modello risolto + valori stampati), così un certificato già
 * emesso resta immutato anche se la scuola cambia in seguito il proprio modello.
 *
 * Il MODELLO del certificato (logo, colori, testi, firma) vive nelle impostazioni
 * del tenant (`scuole.impostazioni.certificato`, colonna JSON già esistente):
 * la sua personalizzazione NON richiede quindi migrazioni.
 *
 * `corso_id` è nullable (SET NULL): il percorso può non coincidere con un
 * singolo Corso; in tal caso `nome_corso` (testo libero) descrive il percorso.
 * `stato` è ENUM ('valido' | 'revocato'): coerente con lo stile del progetto per
 * gli stati chiusi (cfr. `corsi.stato`, `classe_utenti.ruolo_nella_classe`).
 */
module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    await queryInterface.createTable('certificati', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      codice: {
        type: DataTypes.STRING(19),
        allowNull: false,
      },
      utente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      corso_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'corsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      rilasciato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      scuola_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'scuole', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      titolo: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      nome_studente: {
        type: DataTypes.STRING(220),
        allowNull: false,
      },
      nome_corso: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      esito: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      data_completamento: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      contenuto: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      stato: {
        type: DataTypes.ENUM('valido', 'revocato'),
        allowNull: false,
        defaultValue: 'valido',
      },
      motivo_revoca: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      revocato_da: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'utenti', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      revocato_il: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('certificati', ['codice'], {
      name: 'certificati_codice_unico',
      unique: true,
    });
    await queryInterface.addIndex('certificati', ['scuola_id'], { name: 'certificati_scuola_id' });
    await queryInterface.addIndex('certificati', ['utente_id'], { name: 'certificati_utente_id' });
    await queryInterface.addIndex('certificati', ['corso_id'], { name: 'certificati_corso_id' });
    await queryInterface.addIndex('certificati', ['rilasciato_da'], { name: 'certificati_rilasciato_da' });
    await queryInterface.addIndex('certificati', ['stato'], { name: 'certificati_stato' });
  },

  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('certificati');
    // MySQL crea un tipo ENUM implicito per colonna: eliminando la tabella
    // sparisce con essa. Nessuna pulizia aggiuntiva necessaria.
  },
};
