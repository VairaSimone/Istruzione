'use strict';

const catchAsync = require('../utils/catchAsync');
const impostazioniService = require('../services/impostazioniService');
const { normalizzaDominio } = require('../utils/dominio');

/**
 * InternoController — endpoint di SERVIZIO per l'infrastruttura, non per il
 * frontend. Pubblici (nessun cookie/JWT) ma a bassissima sensibilità.
 */

/**
 * GET /api/interno/dominio-consentito?domain=<host>
 *
 * Endpoint «ask» per il TLS ON-DEMAND di Caddy. Caddy, prima di richiedere un
 * certificato Let's Encrypt per un host mai visto, interroga questo endpoint:
 *   - risposta 200 → il dominio è autorizzato, Caddy emette il certificato;
 *   - risposta ≠ 200 → Caddy NON emette nulla (protegge da richieste per host
 *     arbitrari che punterebbero alla VPS senza essere scuole reali).
 *
 * Autorizziamo un host SOLO se corrisponde a un dominio scuola VERIFICATO di una
 * scuola ATTIVA (la stessa logica con cui l'host risolve il tenant): così una
 * scuola bloccata/sospesa non ottiene nuovi certificati, e nessuno può farsi
 * emettere un certificato per un dominio che non è registrato in piattaforma.
 *
 * Caddy si aspetta il nome nel parametro `domain`.
 */
exports.dominioConsentito = catchAsync(async (req, res) => {
  const host = normalizzaDominio(req.query.domain);
  if (!host) {
    return res.status(400).json({ status: 'fail', message: 'Parametro domain mancante o non valido.' });
  }

  const scuola = await impostazioniService.perDominio(host);
  if (!scuola) {
    return res.status(403).json({ status: 'fail', message: 'Dominio non autorizzato.' });
  }

  return res.status(200).json({ status: 'success', scuola: scuola.slug || scuola.id });
});
