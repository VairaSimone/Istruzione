'use strict';

/**
 * gameStats — utilità condivise per le statistiche di gioco (XP, livello,
 * serializzazione).
 *
 * Estratte qui da `quizService` per essere riusate sia dal Quiz Kana sia dal
 * nuovo `gamificationService` (badge + scrittura su canvas) SENZA introdurre
 * dipendenze circolari tra i due service.
 *
 * Il livello NON è mai persistito: è SEMPRE derivato dagli XP con la formula
 *   livello = Math.floor(sqrt(xp / 100)) + 1
 * così non può mai disallinearsi rispetto agli XP memorizzati.
 */

/** Livello derivato dagli XP: Math.floor(sqrt(xp / 100)) + 1. */
const calcolaLivello = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;

/**
 * Informazioni complete sul livello, utili al frontend per la barra di
 * avanzamento (XP di inizio livello, XP del livello successivo, % progresso).
 */
const infoLivello = (xp) => {
  const xpSicuro = Math.max(0, xp);
  const livello = calcolaLivello(xpSicuro);
  const xpInizioLivello = Math.pow(livello - 1, 2) * 100;
  const xpProssimoLivello = Math.pow(livello, 2) * 100;
  const intervallo = xpProssimoLivello - xpInizioLivello;
  const progressoLivello =
    intervallo > 0 ? Math.round(((xpSicuro - xpInizioLivello) / intervallo) * 100) : 0;

  return {
    livello,
    xpInizioLivello,
    xpProssimoLivello,
    progressoLivello: Math.max(0, Math.min(100, progressoLivello)),
  };
};

/**
 * Serializza le statistiche di gioco globali di un utente in un oggetto
 * pronto per il client (camelCase, livello incluso).
 *
 * Tollerante ai campi non caricati: se un'istanza Utente è stata letta con un
 * sottoinsieme di attributi, i contatori mancanti valgono 0.
 *
 * @param {import('../models/Utente')} utente
 */
const serializzaStatistiche = (utente) => {
  const xp = utente.xp || 0;
  return {
    xp,
    streak: utente.streak || 0,
    punteggioRecord: utente.punteggio_record || 0,
    ultimaDataStudio: utente.ultima_data_studio || null,
    quizCompletati: utente.quiz_completati || 0,
    trattiValidati: utente.tratti_validati || 0,
    righeSbloccate: utente.righe_sbloccate || 0,
    ...infoLivello(xp),
  };
};

module.exports = {
  calcolaLivello,
  infoLivello,
  serializzaStatistiche,
};
