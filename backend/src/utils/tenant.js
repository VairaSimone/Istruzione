'use strict';

const AppError = require('./AppError');

/**
 * Helper condivisi per il MULTI-TENANT (scuole).
 *
 * Regola generale della piattaforma:
 *   - l'admin (`ruolo === 'admin'`, `scuola_id === null`) è trasversale: vede
 *     e opera su tutte le scuole;
 *   - insegnanti e studenti appartengono a UNA scuola e possono vedere/operare
 *     SOLO entro di essa.
 *
 * Questi helper centralizzano il controllo, così la stessa regola non viene
 * ri-scritta (e sbagliata) in ogni service.
 */

/** True se il richiedente è admin (nessun vincolo di scuola). */
const isAdmin = (richiedente) => Boolean(richiedente) && richiedente.ruolo === 'admin';

/**
 * Verifica che il richiedente (se non admin) appartenga alla scuola `scuolaId`.
 * L'admin passa sempre. Lancia 403 se le scuole non coincidono o se una delle
 * due è indefinita (fail-closed).
 *
 * @param {{ruolo:string, scuola_id:?string}} richiedente
 * @param {?string} scuolaId  scuola della risorsa target
 * @param {string} [messaggio]
 */
const assicuraStessaScuola = (
  richiedente,
  scuolaId,
  messaggio = 'Questa risorsa non appartiene alla tua scuola.'
) => {
  if (isAdmin(richiedente)) return;
  if (
    !richiedente ||
    !richiedente.scuola_id ||
    !scuolaId ||
    String(richiedente.scuola_id) !== String(scuolaId)
  ) {
    throw new AppError(messaggio, 403, 'CROSS_SCUOLA_FORBIDDEN');
  }
};

/**
 * Risolve la scuola da assegnare a una risorsa creata dal richiedente:
 *   - insegnante → SEMPRE la propria scuola (un eventuale `scuolaIdRichiesta`
 *     viene ignorato per impedire la creazione fuori tenant);
 *   - admin      → la `scuolaIdRichiesta` indicata (obbligatoria per le risorse
 *     che devono appartenere a una scuola, es. le aule).
 *
 * @param {{ruolo:string, scuola_id:?string}} richiedente
 * @param {?string} scuolaIdRichiesta
 * @param {{scuolaObbligatoriaPerAdmin?:boolean}} [opzioni]
 * @returns {?string} lo scuola_id da persistire (può essere null per l'admin
 *   quando la scuola non è obbligatoria).
 */
const risolviScuolaCreazione = (richiedente, scuolaIdRichiesta, opzioni = {}) => {
  if (!isAdmin(richiedente)) {
    if (!richiedente || !richiedente.scuola_id) {
      throw new AppError(
        'Il tuo account non è associato ad alcuna scuola.',
        403,
        'NO_SCUOLA'
      );
    }
    return richiedente.scuola_id;
  }

  // Admin
  if (scuolaIdRichiesta) return scuolaIdRichiesta;
  if (opzioni.scuolaObbligatoriaPerAdmin) {
    throw new AppError(
      'Come amministratore devi indicare la scuola (scuolaId) per questa operazione.',
      422,
      'SCUOLA_REQUIRED'
    );
  }
  return null;
};

module.exports = {
  isAdmin,
  assicuraStessaScuola,
  risolviScuolaCreazione,
};
