'use strict';

/**
 * Helper per i DOMINI PERSONALIZZATI delle scuole.
 *
 * Una scuola può essere raggiunta da un proprio dominio (`liceo-manzoni.it`)
 * su cui gira la stessa piattaforma: l'host della richiesta identifica il
 * tenant, senza bisogno di `?scuola=` o dell'header `X-Scuola`.
 *
 * La corrispondenza host → scuola deve essere DETERMINISTICA: per questo un
 * dominio viene sempre NORMALIZZATO prima di essere salvato o confrontato
 * (minuscole, senza schema/porta/percorso, senza punto finale). Così
 * `HTTPS://Liceo-Manzoni.IT:443/` e `liceo-manzoni.it` sono lo stesso tenant.
 */

// Un'etichetta DNS: 1–63 caratteri alfanumerici, trattini interni ammessi.
const ETICHETTA = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
// Hostname con almeno due etichette (deve esserci un punto): esclude gli host a
// etichetta singola come `localhost`, che non sono domini pubblici assegnabili.
const DOMINIO_REGEX = new RegExp(`^(?:${ETICHETTA}\\.)+${ETICHETTA}$`);

const DOMINIO_MAX = 253;

/**
 * Normalizza un host/dominio grezzo (o un URL completo incollato per errore).
 *
 *   - accetta anche `https://www.liceo.it/pagina?x=1` ed estrae `www.liceo.it`;
 *   - toglie schema, credenziali, porta, percorso, query e punto finale;
 *   - porta tutto in minuscolo.
 *
 * @param {*} grezzo
 * @returns {?string} dominio normalizzato, oppure `null` se non è valido.
 */
const normalizzaDominio = (grezzo) => {
  if (typeof grezzo !== 'string') return null;

  let host = grezzo.trim().toLowerCase();
  if (host === '') return null;

  // Se sembra un URL completo, estraine l'host in modo robusto.
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  } else {
    // Toglie eventuali credenziali, percorso e query anche senza schema.
    host = host.split('/')[0].split('?')[0].split('@').pop();
  }

  // Rimuove la porta (`liceo.it:8443`) e l'eventuale punto finale FQDN.
  host = host.split(':')[0].replace(/\.+$/, '');

  if (host === '' || host.length > DOMINIO_MAX) return null;
  if (!DOMINIO_REGEX.test(host)) return null;

  return host;
};

/** True se il valore, una volta normalizzato, è un dominio valido. */
const dominioValido = (grezzo) => normalizzaDominio(grezzo) !== null;

/**
 * Restituisce, per un host, l'elenco ordinato dei candidati con cui tentare la
 * corrispondenza in tabella: prima l'host esatto, poi — se presente — la sua
 * forma senza il prefisso `www.`. Copre il caso comune in cui la scuola
 * registra `liceo.it` ma i visitatori arrivano su `www.liceo.it`.
 *
 * @param {?string} host  già normalizzato (output di `normalizzaDominio`)
 * @returns {string[]}
 */
const candidatiDominio = (host) => {
  if (!host) return [];
  const candidati = [host];
  if (host.startsWith('www.')) {
    const senzaWww = host.slice(4);
    if (senzaWww && senzaWww !== host) candidati.push(senzaWww);
  }
  return candidati;
};

module.exports = {
  DOMINIO_REGEX,
  DOMINIO_MAX,
  normalizzaDominio,
  dominioValido,
  candidatiDominio,
};
