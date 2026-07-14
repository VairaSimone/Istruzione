'use strict';

/**
 * HELPER MONETARI condivisi dal modulo pagamenti.
 *
 * REGOLA D'ORO: gli importi si PERSISTONO e si TRASPORTANO in CENTESIMI (interi),
 * mai in euro con la virgola. Il floating point non è adatto al denaro
 * (0.1 + 0.2 !== 0.3): tenere tutto in centesimi elimina gli arrotondamenti
 * insidiosi. La conversione a valore decimale avviene solo per la UI, all'ultimo
 * momento. Stripe stesso ragiona in "unità minime" (centesimi per EUR/USD), quindi
 * il valore che salviamo è esattamente quello che passiamo all'API.
 */

// Limite di sicurezza sul prezzo di un corso: 1.000.000,00 nella valuta scelta
// (100 milioni di centesimi). Evita overflow e prezzi palesemente errati.
const MASSIMO_CENTESIMI = 100000000;

/**
 * Normalizza un input a numero INTERO di centesimi ≥ 0, oppure `null`.
 * Accetta numeri e stringhe numeriche. Vuoto/non numerico/negativo ⇒ `null`.
 *
 * @param {number|string|null|undefined} valore
 * @returns {number|null}
 */
const aCentesimi = (valore) => {
  if (valore === null || valore === undefined || valore === '') return null;
  const n = Number(valore);
  if (!Number.isFinite(n) || n < 0) return null;
  const intero = Math.round(n);
  if (intero > MASSIMO_CENTESIMI) return null;
  return intero;
};

/**
 * Centesimi → valore decimale (numero) per la vista. `null` resta `null`.
 * Es. 1999 → 19.99.
 *
 * @param {number|null|undefined} centesimi
 * @returns {number|null}
 */
const aDecimale = (centesimi) => {
  if (centesimi === null || centesimi === undefined) return null;
  const n = Number(centesimi);
  if (!Number.isFinite(n)) return null;
  return Math.round(n) / 100;
};

/**
 * Normalizza una percentuale di commissione a un numero con 2 decimali nel
 * range [0, 100], oppure `null` (nessuna commissione). Usata per la percentuale
 * che la PIATTAFORMA trattiene su ogni incasso della scuola.
 *
 * @param {number|string|null|undefined} valore
 * @returns {number|null}
 */
const aPercentuale = (valore) => {
  if (valore === null || valore === undefined || valore === '') return null;
  const n = Number(valore);
  if (!Number.isFinite(n) || n < 0) return null;
  const arrotondata = Math.round(n * 100) / 100;
  if (arrotondata > 100) return null;
  return arrotondata;
};

/**
 * Calcola la commissione della piattaforma (in centesimi) su un importo, data
 * la percentuale. Arrotondamento commerciale al centesimo. Una percentuale
 * nulla/zero ⇒ 0. Il risultato è sempre limitato all'importo stesso (non può
 * superare il totale addebitato).
 *
 * @param {number} importoCentesimi  importo totale addebitato all'acquirente
 * @param {number|null} percentuale  percentuale trattenuta dalla piattaforma
 * @returns {number} commissione in centesimi (intero, ≥ 0)
 */
const commissionePiattaforma = (importoCentesimi, percentuale) => {
  const importo = aCentesimi(importoCentesimi) || 0;
  const perc = aPercentuale(percentuale);
  if (!perc) return 0;
  const commissione = Math.round((importo * perc) / 100);
  return Math.min(Math.max(commissione, 0), importo);
};

/**
 * Formatta un importo in centesimi come stringa localizzata (es. "€ 19,99").
 * Best effort: se `Intl` non conosce la valuta, ripiega su "<valore> <VALUTA>".
 *
 * @param {number|null} centesimi
 * @param {string} valuta  codice ISO-4217 (es. "EUR")
 * @param {string} [locale='it-IT']
 * @returns {string}
 */
const formatta = (centesimi, valuta = 'EUR', locale = 'it-IT') => {
  const decimale = aDecimale(centesimi);
  if (decimale === null) return '';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: valuta }).format(decimale);
  } catch (_) {
    return `${decimale.toFixed(2)} ${valuta}`;
  }
};

module.exports = {
  MASSIMO_CENTESIMI,
  aCentesimi,
  aDecimale,
  aPercentuale,
  commissionePiattaforma,
  formatta,
};
