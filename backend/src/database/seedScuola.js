'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const sequelize = require('../config/database');
const Scuola = require('../models/Scuola');
const logger = require('../utils/logger');
const piattaforma = require('../config/piattaforma');
const { normalizzaImpostazioni } = require('../constants/impostazioniScuola');

/**
 * Seed della SCUOLA PREDEFINITA.
 *
 * Su un database vuoto non esiste alcun tenant: `GET /api/config` ricade
 * sull'identità della piattaforma e nessun insegnante può essere invitato
 * (gli inviti richiedono una scuola di destinazione). Questo script crea una
 * scuola iniziale, marcata `predefinita`, che il frontend risolve senza dover
 * indicare alcun tenant.
 *
 * È volutamente NEUTRO: nome, slug e colori arrivano dalle variabili d'ambiente
 * o dai default dello schema. Nessun riferimento a una materia specifica.
 *
 *   SEED_SCUOLA_NOME   nome della scuola          (default: nome piattaforma)
 *   SEED_SCUOLA_SLUG   slug pubblico              (default: derivato dal nome)
 *   SEED_SCUOLA_EMAIL  email di contatto          (facoltativa)
 *
 * Idempotente: se esiste già una scuola con quello slug non fa nulla.
 * Se esistono scuole ma nessuna è predefinita, promuove la più vecchia.
 */
const seedScuola = async () => {
  try {
    await sequelize.authenticate();

    const nome = process.env.SEED_SCUOLA_NOME || piattaforma.NOME;
    const slug = process.env.SEED_SCUOLA_SLUG || Scuola.slugifica(nome);

    if (!slug) {
      logger.error('❌ Impossibile derivare uno slug: imposta SEED_SCUOLA_SLUG.');
      process.exit(1);
    }

    const esistente = await Scuola.findOne({ where: { slug } });
    if (esistente) {
      logger.info(`ℹ️  La scuola "${esistente.nome}" (slug: ${slug}) esiste già. Nessuna azione.`);
    } else {
      const impostazioni = normalizzaImpostazioni({
        identita: { nomeVisualizzato: nome, descrizione: piattaforma.DESCRIZIONE },
        ...(process.env.SEED_SCUOLA_EMAIL
          ? { contatti: { email: process.env.SEED_SCUOLA_EMAIL } }
          : {}),
      });

      const scuola = await Scuola.create({
        nome,
        slug,
        attiva: true,
        predefinita: true,
        impostazioni,
      });

      logger.info(`✅ Scuola predefinita creata: "${scuola.nome}" (slug: ${scuola.slug})`);
    }

    // Garantisce che esista sempre esattamente una scuola predefinita.
    const conPredefinita = await Scuola.count({ where: { predefinita: true } });
    if (conPredefinita === 0) {
      const piuVecchia = await Scuola.findOne({ order: [['created_at', 'ASC']] });
      if (piuVecchia) {
        piuVecchia.predefinita = true;
        await piuVecchia.save();
        logger.info(`✅ Promossa a scuola predefinita: "${piuVecchia.nome}"`);
      }
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    logger.error('❌ Seed della scuola fallito:', err);
    process.exit(1);
  }
};

seedScuola();
