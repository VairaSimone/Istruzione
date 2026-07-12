'use strict';

/**
 * VERSIONI DEI DOCUMENTI LEGALI.
 *
 * Fonte di verità unica per la versione corrente dei documenti a cui l'utente
 * presta consenso. Quando cambia il testo dei Termini o dell'informativa sul
 * recapito email, si incrementa la relativa versione qui: da quel momento il
 * consenso registrato con la versione precedente risulta "vecchio" e il
 * frontend può richiedere una nuova accettazione.
 *
 * Il valore è persistito sull'utente (`versione_termini`,
 * `versione_consenso_email`) insieme all'istante del consenso: questo permette
 * di PROVARE cosa l'utente ha accettato e quando (art. 7 GDPR — dimostrabilità
 * del consenso).
 *
 * Formato: stringa breve tipo 'AAAA-MM-GG' (data di entrata in vigore) oppure
 * 'v1', 'v2'. Deve restare allineato al valore usato dal frontend nelle pagine
 * legali (mantenere sincronizzati i due lati quando si aggiorna un documento).
 */

const stringaEnv = (chiave, predefinito) => {
  const v = process.env[chiave];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : predefinito;
};

// Versione corrente dei Termini e Condizioni + Privacy accettati alla
// registrazione. Incrementare quando il testo cambia in modo sostanziale.
const VERSIONE_TERMINI = stringaEnv('VERSIONE_TERMINI', '2026-07-01');

// Versione corrente dell'informativa sul recapito delle notifiche via email.
const VERSIONE_CONSENSO_EMAIL = stringaEnv('VERSIONE_CONSENSO_EMAIL', '2026-07-01');

module.exports = {
  VERSIONE_TERMINI,
  VERSIONE_CONSENSO_EMAIL,
};
