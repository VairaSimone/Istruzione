'use strict';

/**
 * CONFIGURAZIONE CENTRALIZZATA DELLA PIATTAFORMA.
 *
 * Questo file è l'unico punto in cui vive l'identità "di prodotto" del backend.
 * Prima della generalizzazione, il nome della piattaforma era cablato nel codice
 * (es. il mittente delle email era la stringa letterale "Piattaforma Giapponese"):
 * ora è una configurazione, sovrascrivibile via variabili d'ambiente.
 *
 * ATTENZIONE alla differenza tra i due livelli di identità:
 *
 *   - PIATTAFORMA (questo file)  → il software, uguale per tutti i tenant.
 *     È ciò che compare quando NON esiste ancora un contesto di scuola
 *     (es. mittente SMTP, titolo dell'health check, fallback del branding).
 *
 *   - SCUOLA (`constants/impostazioniScuola.js`) → l'identità del singolo
 *     tenant: nome visualizzato, logo, colori, contatti, funzionalità attive.
 *     È ciò che il frontend usa per personalizzarsi. Sovrascrive sempre il
 *     livello di piattaforma quando disponibile.
 *
 * Nessun valore qui dentro deve essere legato a una materia specifica.
 */

const stringaEnv = (chiave, predefinito) => {
  const v = process.env[chiave];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : predefinito;
};

// Nome commerciale della piattaforma. Neutro rispetto alla materia insegnata.
const NOME = stringaEnv('PLATFORM_NAME', 'Piattaforma Didattica');

// Descrizione breve, usata come fallback quando la scuola non ne ha una.
const DESCRIZIONE = stringaEnv(
  'PLATFORM_DESCRIPTION',
  'Piattaforma di apprendimento per scuole e centri di formazione.'
);

// URL pubblico del frontend (link nelle email, redirect OAuth).
const FRONTEND_URL = stringaEnv('FRONTEND_URL', 'http://localhost:5173');

// Indirizzo mittente delle email transazionali.
const EMAIL_FROM = stringaEnv('EMAIL_FROM', 'no-reply@localhost');

// Nome visualizzato del mittente. Se una scuola ha un nome proprio, i servizi
// che ne hanno il contesto possono passarlo a `mittente(nomeScuola)`.
const mittente = (nomeVisualizzato) =>
  `"${(nomeVisualizzato && String(nomeVisualizzato).trim()) || NOME}" <${EMAIL_FROM}>`;

// Versione dell'API esposta dall'health check.
const VERSIONE = stringaEnv('PLATFORM_VERSION', '2.0.0');

/**
 * SLUG della scuola predefinita, usato dall'endpoint pubblico `/api/config`
 * quando la richiesta non indica alcun tenant. Serve ai deploy MONO-SCUOLA:
 * il frontend chiede `/api/config` e riceve il branding dell'unica scuola.
 * Se non impostato e la piattaforma ha una sola scuola, viene usata quella.
 */
const SCUOLA_PREDEFINITA_SLUG = stringaEnv('DEFAULT_SCHOOL_SLUG', null);

/**
 * Nome dell'header HTTP con cui il frontend può indicare esplicitamente il
 * tenant sulle richieste non autenticate (deploy multi-scuola su un solo host).
 * In alternativa si può usare il query param `?scuola=<slug>`.
 */
const HEADER_TENANT = 'x-scuola';

module.exports = {
  NOME,
  DESCRIZIONE,
  FRONTEND_URL,
  EMAIL_FROM,
  VERSIONE,
  SCUOLA_PREDEFINITA_SLUG,
  HEADER_TENANT,
  mittente,
};
