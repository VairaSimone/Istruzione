'use strict';

const { DataTypes, QueryTypes } = require('sequelize');

/**
 * GENERALIZZAZIONE DELLA PIATTAFORMA.
 *
 * La piattaforma smette di essere specifica per l'insegnamento del giapponese e
 * diventa utilizzabile da qualsiasi scuola o centro di formazione, per qualsiasi
 * materia. Il contenuto giapponese non viene eliminato: sopravvive come
 * TEMPLATE DI ESEMPIO che ogni scuola sceglie se installare.
 *
 * ── Cosa cambia nel database ──
 *
 *  1. `scuole`   + `slug` (identificativo pubblico), `attiva`, `predefinita`.
 *                 Servono agli endpoint pubblici di configurazione, che il
 *                 frontend interroga PRIMA del login per personalizzarsi.
 *
 *  2. `scuole.impostazioni` viene normalizzato allo schema dichiarativo
 *                 (identita, aspetto, contatti, indirizzo, social, footer,
 *                 didattica, funzionalita). Le scuole esistenti ricevono i
 *                 vocabolari didattici storici (classi Prima…Quinta, livelli
 *                 N5…N1) e la funzionalità `praticaScrittura` ATTIVA, così il
 *                 comportamento pre-migrazione è preservato.
 *
 *  3. `classi.livello_jlpt` → `classi.livello` (ENUM N5…N1 → STRING).
 *  4. `corsi.livello_jlpt`  → `corsi.livello`  (ENUM N5…N1 → STRING)
 *                             + nuova colonna `corsi.materia`.
 *  5. `compiti.tipo_attivita` ENUM(quiz_kana, quiz_kanji, tracciamento,
 *                             vocabolario) → STRING, con traduzione dei valori
 *                             storici ai codici neutri del registro:
 *                               quiz_kana | quiz_kanji → quiz
 *                               tracciamento           → pratica_scrittura
 *                               vocabolario            → personalizzato
 *  6. `utenti.classe` e `inviti.classe` ENUM(Prima…Quinta) → STRING: il
 *                             vocabolario delle classi è ora un'impostazione
 *                             della scuola, non una costante di codice.
 *  7. `quiz` + `categoria`: ogni quiz appartiene a una materia e a una
 *                             categoria, per supportare quiz di lingue e materie
 *                             diverse senza altre modifiche allo schema.
 *
 * NESSUN DATO VIENE PERSO. I progressi kana/kanji, i badge, gli XP, i quiz e i
 * corsi esistenti restano invariati; cambiano solo tipo e nome di alcune colonne.
 *
 * REVERSIBILITÀ: `down` riporta le colonne ai tipi ENUM originali. La conversione
 * inversa dei valori è best-effort — i valori nuovi non rappresentabili nei
 * vecchi ENUM (es. una classe "A1", un tipo `corso`) vengono azzerati o mappati
 * al valore storico più vicino, perché l'ENUM non può accoglierli. È il prezzo
 * di un rollback verso uno schema meno espressivo, ed è documentato qui.
 */

// Vocabolari storici, usati SOLO per popolare le impostazioni delle scuole
// esistenti (retrocompatibilità) e per il rollback.
const CLASSI_STORICHE = ['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta'];
const LIVELLI_STORICI = ['N5', 'N4', 'N3', 'N2', 'N1'];
const TIPI_ATTIVITA_STORICI = ['quiz_kana', 'quiz_kanji', 'tracciamento', 'vocabolario'];
const TIPI_ATTIVITA_NUOVI = [
  'quiz',
  'corso',
  'pratica_scrittura',
  'lettura',
  'consegna',
  'personalizzato',
];

// Traduzione dei tipi di attività storici → codici neutri.
const MAPPA_TIPI = {
  quiz_kana: 'quiz',
  quiz_kanji: 'quiz',
  tracciamento: 'pratica_scrittura',
  vocabolario: 'personalizzato',
};

// Traduzione inversa (rollback best-effort).
const MAPPA_TIPI_INVERSA = {
  quiz: 'quiz_kana',
  corso: 'vocabolario',
  pratica_scrittura: 'tracciamento',
  lettura: 'vocabolario',
  consegna: 'vocabolario',
  personalizzato: 'vocabolario',
};

/** Slug leggibile a partire da un nome libero (identico a `Scuola.slugifica`). */
const slugifica = (testo) => {
  if (typeof testo !== 'string') return null;
  const s = testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s === '' ? null : s;
};

/** Rimuove un indice ignorando l'errore "non esiste" (idempotenza). */
const rimuoviIndiceSePresente = async (queryInterface, tabella, nome) => {
  try {
    await queryInterface.removeIndex(tabella, nome);
  } catch (err) {
    // L'indice potrebbe non esistere (installazioni parziali): non è un errore.
  }
};

module.exports = {
  up: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ─────────────────────────────────────────────
    // 1. scuole: slug, attiva, predefinita
    // ─────────────────────────────────────────────
    await queryInterface.addColumn('scuole', 'slug', {
      type: DataTypes.STRING(80),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('scuole', 'attiva', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('scuole', 'predefinita', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Backfill degli slug a partire dal nome, con suffisso in caso di collisione.
    const scuole = await sequelize.query(
      'SELECT id, nome, impostazioni FROM scuole ORDER BY created_at ASC',
      { type: QueryTypes.SELECT }
    );

    const slugUsati = new Set();
    for (const [indice, scuola] of scuole.entries()) {
      let slug = slugifica(scuola.nome) || `scuola-${indice + 1}`;
      let candidato = slug;
      let n = 2;
      while (slugUsati.has(candidato)) {
        candidato = `${slug}-${n}`;
        n += 1;
      }
      slugUsati.add(candidato);

      // La PRIMA scuola creata diventa quella predefinita: nei deploy
      // mono-scuola il frontend non deve indicare alcun tenant.
      await sequelize.query('UPDATE scuole SET slug = :slug, predefinita = :pred WHERE id = :id', {
        replacements: { slug: candidato, pred: indice === 0, id: scuola.id },
        type: QueryTypes.UPDATE,
      });
    }

    await queryInterface.changeColumn('scuole', 'slug', {
      type: DataTypes.STRING(80),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addIndex('scuole', {
      fields: ['slug'],
      unique: true,
      name: 'scuole_slug',
    });
    await queryInterface.addIndex('scuole', { fields: ['predefinita'], name: 'scuole_predefinita' });
    await queryInterface.addIndex('scuole', { fields: ['attiva'], name: 'scuole_attiva' });

    // ─────────────────────────────────────────────
    // 2. scuole.impostazioni: normalizzazione allo schema + retrocompatibilità
    //    Le scuole esistenti mantengono i vocabolari storici e la pratica di
    //    scrittura attiva (era sempre disponibile prima della migrazione).
    // ─────────────────────────────────────────────
    for (const scuola of scuole) {
      let correnti = {};
      if (scuola.impostazioni) {
        correnti =
          typeof scuola.impostazioni === 'string'
            ? JSON.parse(scuola.impostazioni)
            : scuola.impostazioni;
      }

      const nuove = {
        ...correnti,
        identita: {
          nomeVisualizzato: scuola.nome,
          ...(correnti.identita || {}),
        },
        didattica: {
          classiDisponibili: CLASSI_STORICHE,
          livelliDisponibili: LIVELLI_STORICI,
          materieDisponibili: [],
          ...(correnti.didattica || {}),
        },
        funzionalita: {
          profilo: true,
          aule: true,
          quiz: true,
          corsi: true,
          compiti: true,
          messaggi: true,
          statistiche: true,
          gamification: true,
          // Attiva per le scuole esistenti: prima della generalizzazione il
          // canvas dei tratti era sempre raggiungibile.
          praticaScrittura: true,
          ...(correnti.funzionalita || {}),
        },
      };

      await sequelize.query('UPDATE scuole SET impostazioni = :imp WHERE id = :id', {
        replacements: { imp: JSON.stringify(nuove), id: scuola.id },
        type: QueryTypes.UPDATE,
      });
    }

    // ─────────────────────────────────────────────
    // 3. classi.livello_jlpt → classi.livello (ENUM → STRING)
    //    L'indice sulla vecchia colonna va rimosso prima del rename, altrimenti
    //    MySQL lo trascina con un nome fuorviante.
    // ─────────────────────────────────────────────
    await rimuoviIndiceSePresente(queryInterface, 'classi', 'classi_livello_jlpt');

    await queryInterface.addColumn('classi', 'livello', {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
    });
    await sequelize.query('UPDATE classi SET livello = livello_jlpt WHERE livello_jlpt IS NOT NULL', {
      type: QueryTypes.UPDATE,
    });
    await queryInterface.removeColumn('classi', 'livello_jlpt');
    await queryInterface.addIndex('classi', { fields: ['livello'], name: 'classi_livello' });

    // ─────────────────────────────────────────────
    // 4. corsi: livello_jlpt → livello (ENUM → STRING) + materia
    // ─────────────────────────────────────────────
    await rimuoviIndiceSePresente(queryInterface, 'corsi', 'corsi_livello_jlpt');

    await queryInterface.addColumn('corsi', 'livello', {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
    });
    await sequelize.query('UPDATE corsi SET livello = livello_jlpt WHERE livello_jlpt IS NOT NULL', {
      type: QueryTypes.UPDATE,
    });
    await queryInterface.removeColumn('corsi', 'livello_jlpt');

    await queryInterface.addColumn('corsi', 'materia', {
      type: DataTypes.STRING(80),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addIndex('corsi', { fields: ['livello'], name: 'corsi_livello' });
    await queryInterface.addIndex('corsi', { fields: ['materia'], name: 'corsi_materia' });

    // ─────────────────────────────────────────────
    // 5. compiti.tipo_attivita: ENUM → STRING + traduzione dei valori storici
    //    Si passa da ENUM a STRING PRIMA di riscrivere i valori: altrimenti
    //    MySQL rifiuterebbe i codici nuovi, non presenti nell'ENUM.
    // ─────────────────────────────────────────────
    await rimuoviIndiceSePresente(queryInterface, 'compiti', 'compiti_tipo_attivita');

    await queryInterface.changeColumn('compiti', 'tipo_attivita', {
      type: DataTypes.STRING(50),
      allowNull: false,
    });

    for (const [storico, nuovo] of Object.entries(MAPPA_TIPI)) {
      await sequelize.query(
        'UPDATE compiti SET tipo_attivita = :nuovo WHERE tipo_attivita = :storico',
        { replacements: { nuovo, storico }, type: QueryTypes.UPDATE }
      );
    }

    await queryInterface.addIndex('compiti', {
      fields: ['tipo_attivita'],
      name: 'compiti_tipo_attivita',
    });

    // ─────────────────────────────────────────────
    // 6. utenti.classe e inviti.classe: ENUM → STRING
    //    Il vocabolario delle classi diventa un'impostazione della scuola.
    // ─────────────────────────────────────────────
    await queryInterface.changeColumn('utenti', 'classe', {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.changeColumn('inviti', 'classe', {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: null,
    });

    // ─────────────────────────────────────────────
    // 7. quiz.categoria + indici di raggruppamento
    // ─────────────────────────────────────────────
    await queryInterface.addColumn('quiz', 'categoria', {
      type: DataTypes.STRING(80),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addIndex('quiz', {
      fields: ['scuola_id', 'materia'],
      name: 'quiz_scuola_materia',
    });
    await queryInterface.addIndex('quiz', {
      fields: ['scuola_id', 'categoria'],
      name: 'quiz_scuola_categoria',
    });
  },

  down: async ({ context: queryInterface }) => {
    const sequelize = queryInterface.sequelize;

    // ── 7. quiz.categoria ──
    await rimuoviIndiceSePresente(queryInterface, 'quiz', 'quiz_scuola_categoria');
    await rimuoviIndiceSePresente(queryInterface, 'quiz', 'quiz_scuola_materia');
    await queryInterface.removeColumn('quiz', 'categoria');

    // ── 6. classe: STRING → ENUM ──
    // I valori fuori dal vecchio vocabolario non sono rappresentabili: azzerati.
    await sequelize.query(
      `UPDATE utenti SET classe = NULL WHERE classe IS NOT NULL AND classe NOT IN (:classi)`,
      { replacements: { classi: CLASSI_STORICHE }, type: QueryTypes.UPDATE }
    );
    await sequelize.query(
      `UPDATE inviti SET classe = NULL WHERE classe IS NOT NULL AND classe NOT IN (:classi)`,
      { replacements: { classi: CLASSI_STORICHE }, type: QueryTypes.UPDATE }
    );

    await queryInterface.changeColumn('utenti', 'classe', {
      type: DataTypes.ENUM(...CLASSI_STORICHE),
      allowNull: true,
    });
    await queryInterface.changeColumn('inviti', 'classe', {
      type: DataTypes.ENUM(...CLASSI_STORICHE),
      allowNull: true,
    });

    // ── 5. compiti.tipo_attivita: STRING → ENUM (traduzione inversa) ──
    await rimuoviIndiceSePresente(queryInterface, 'compiti', 'compiti_tipo_attivita');

    for (const [nuovo, storico] of Object.entries(MAPPA_TIPI_INVERSA)) {
      await sequelize.query(
        'UPDATE compiti SET tipo_attivita = :storico WHERE tipo_attivita = :nuovo',
        { replacements: { storico, nuovo }, type: QueryTypes.UPDATE }
      );
    }
    // Rete di sicurezza per eventuali codici introdotti dopo questa migrazione.
    await sequelize.query(
      `UPDATE compiti SET tipo_attivita = 'vocabolario' WHERE tipo_attivita NOT IN (:tipi)`,
      { replacements: { tipi: TIPI_ATTIVITA_STORICI }, type: QueryTypes.UPDATE }
    );

    await queryInterface.changeColumn('compiti', 'tipo_attivita', {
      type: DataTypes.ENUM(...TIPI_ATTIVITA_STORICI),
      allowNull: false,
    });
    await queryInterface.addIndex('compiti', {
      fields: ['tipo_attivita'],
      name: 'compiti_tipo_attivita',
    });

    // ── 4. corsi ──
    await rimuoviIndiceSePresente(queryInterface, 'corsi', 'corsi_materia');
    await rimuoviIndiceSePresente(queryInterface, 'corsi', 'corsi_livello');
    await queryInterface.removeColumn('corsi', 'materia');

    await queryInterface.addColumn('corsi', 'livello_jlpt', {
      type: DataTypes.ENUM(...LIVELLI_STORICI),
      allowNull: true,
      defaultValue: null,
    });
    await sequelize.query(
      `UPDATE corsi SET livello_jlpt = livello WHERE livello IN (:livelli)`,
      { replacements: { livelli: LIVELLI_STORICI }, type: QueryTypes.UPDATE }
    );
    await queryInterface.removeColumn('corsi', 'livello');
    await queryInterface.addIndex('corsi', { fields: ['livello_jlpt'], name: 'corsi_livello_jlpt' });

    // ── 3. classi ──
    await rimuoviIndiceSePresente(queryInterface, 'classi', 'classi_livello');
    await queryInterface.addColumn('classi', 'livello_jlpt', {
      type: DataTypes.ENUM(...LIVELLI_STORICI),
      allowNull: true,
      defaultValue: null,
    });
    await sequelize.query(
      `UPDATE classi SET livello_jlpt = livello WHERE livello IN (:livelli)`,
      { replacements: { livelli: LIVELLI_STORICI }, type: QueryTypes.UPDATE }
    );
    await queryInterface.removeColumn('classi', 'livello');
    await queryInterface.addIndex('classi', {
      fields: ['livello_jlpt'],
      name: 'classi_livello_jlpt',
    });

    // ── 1/2. scuole ──
    await rimuoviIndiceSePresente(queryInterface, 'scuole', 'scuole_attiva');
    await rimuoviIndiceSePresente(queryInterface, 'scuole', 'scuole_predefinita');
    await rimuoviIndiceSePresente(queryInterface, 'scuole', 'scuole_slug');
    await queryInterface.removeColumn('scuole', 'predefinita');
    await queryInterface.removeColumn('scuole', 'attiva');
    await queryInterface.removeColumn('scuole', 'slug');

    // Le impostazioni restano nella forma nuova: sono un blob JSON e la versione
    // precedente del codice le ignorava comunque (schema aperto). Nessuna perdita.
  },
};

module.exports.TIPI_ATTIVITA_NUOVI = TIPI_ATTIVITA_NUOVI;
