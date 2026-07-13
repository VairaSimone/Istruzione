'use strict';

/**
 * BANCA DATI — Programmazione Web.
 *
 * Fonti dei contenuti (dati verificabili, NON inventati):
 *   - Codici di stato e metodi HTTP → RFC 9110 (HTTP Semantics);
 *   - Tag HTML e proprietà CSS → specifiche WHATWG HTML e W3C/MDN.
 *
 * Struttura (cfr. bancaData/index.js):
 *   ogni `voce` ha i campi { termine, significato }. Il motore genera domande a
 *   scelta multipla in entrambe le direzioni (vedi `modalita`), pescando i
 *   distrattori dalle altre voci della STESSA sezione (così le opzioni restano
 *   coerenti: a un codice HTTP non si oppone mai una proprietà CSS).
 */

module.exports = {
  codice: 'webdev',
  materia: 'Informatica',
  categoria: 'Programmazione Web',
  nome: { it: 'Programmazione Web', en: 'Web Development' },
  descrizione: {
    it: 'Codici di stato HTTP, metodi HTTP, tag HTML e proprietà CSS.',
    en: 'HTTP status codes, HTTP methods, HTML tags and CSS properties.',
  },
  // Etichette dei due campi di ogni voce (usate dalla UI durante la partita).
  campi: {
    termine: { it: 'Elemento', en: 'Item' },
    significato: { it: 'Significato', en: 'Meaning' },
  },
  modalita: [
    {
      codice: 'termine-significato',
      promptCampo: 'termine',
      rispostaCampo: 'significato',
      nome: { it: 'Elemento → Significato', en: 'Item → Meaning' },
      istruzione: { it: 'Scegli il significato corretto.', en: 'Choose the correct meaning.' },
    },
    {
      codice: 'significato-termine',
      promptCampo: 'significato',
      rispostaCampo: 'termine',
      nome: { it: 'Significato → Elemento', en: 'Meaning → Item' },
      istruzione: { it: "Scegli l'elemento corretto.", en: 'Choose the correct item.' },
    },
  ],
  sezioni: [
    { codice: 'http-status', nome: { it: 'Codici di stato HTTP', en: 'HTTP status codes' } },
    { codice: 'http-metodi', nome: { it: 'Metodi HTTP', en: 'HTTP methods' } },
    { codice: 'html-tag', nome: { it: 'Tag HTML', en: 'HTML tags' } },
    { codice: 'css-proprieta', nome: { it: 'Proprietà CSS', en: 'CSS properties' } },
  ],
  voci: [
    // ── Codici di stato HTTP (reason phrase canonica, RFC 9110) ──
    { id: 'webdev.http-200', sezione: 'http-status', campi: { termine: '200', significato: 'OK' }, spiegazione: { it: 'Richiesta andata a buon fine.', en: 'The request succeeded.' } },
    { id: 'webdev.http-201', sezione: 'http-status', campi: { termine: '201', significato: 'Created' }, spiegazione: { it: 'Risorsa creata con successo.', en: 'A new resource was created.' } },
    { id: 'webdev.http-202', sezione: 'http-status', campi: { termine: '202', significato: 'Accepted' }, spiegazione: { it: 'Richiesta accettata ma non ancora elaborata.', en: 'Request accepted, not yet processed.' } },
    { id: 'webdev.http-204', sezione: 'http-status', campi: { termine: '204', significato: 'No Content' }, spiegazione: { it: 'Successo, nessun corpo di risposta.', en: 'Success, no response body.' } },
    { id: 'webdev.http-301', sezione: 'http-status', campi: { termine: '301', significato: 'Moved Permanently' }, spiegazione: { it: 'Risorsa spostata in modo permanente.', en: 'Resource permanently moved.' } },
    { id: 'webdev.http-302', sezione: 'http-status', campi: { termine: '302', significato: 'Found' }, spiegazione: { it: 'Reindirizzamento temporaneo.', en: 'Temporary redirect (historically).' } },
    { id: 'webdev.http-304', sezione: 'http-status', campi: { termine: '304', significato: 'Not Modified' }, spiegazione: { it: 'La cache del client è ancora valida.', en: 'Client cache is still valid.' } },
    { id: 'webdev.http-307', sezione: 'http-status', campi: { termine: '307', significato: 'Temporary Redirect' }, spiegazione: { it: 'Reindirizzamento temporaneo (metodo invariato).', en: 'Temporary redirect, method preserved.' } },
    { id: 'webdev.http-308', sezione: 'http-status', campi: { termine: '308', significato: 'Permanent Redirect' }, spiegazione: { it: 'Reindirizzamento permanente (metodo invariato).', en: 'Permanent redirect, method preserved.' } },
    { id: 'webdev.http-400', sezione: 'http-status', campi: { termine: '400', significato: 'Bad Request' }, spiegazione: { it: 'Richiesta malformata.', en: 'Malformed request.' } },
    { id: 'webdev.http-401', sezione: 'http-status', campi: { termine: '401', significato: 'Unauthorized' }, spiegazione: { it: 'Autenticazione richiesta o fallita.', en: 'Authentication required or failed.' } },
    { id: 'webdev.http-403', sezione: 'http-status', campi: { termine: '403', significato: 'Forbidden' }, spiegazione: { it: 'Accesso negato pur autenticati.', en: 'Access denied even if authenticated.' } },
    { id: 'webdev.http-404', sezione: 'http-status', campi: { termine: '404', significato: 'Not Found' }, spiegazione: { it: 'Risorsa non trovata.', en: 'Resource not found.' } },
    { id: 'webdev.http-405', sezione: 'http-status', campi: { termine: '405', significato: 'Method Not Allowed' }, spiegazione: { it: 'Metodo HTTP non consentito su questa risorsa.', en: 'HTTP method not allowed for this resource.' } },
    { id: 'webdev.http-409', sezione: 'http-status', campi: { termine: '409', significato: 'Conflict' }, spiegazione: { it: 'Conflitto con lo stato attuale della risorsa.', en: 'Conflict with the current resource state.' } },
    { id: 'webdev.http-410', sezione: 'http-status', campi: { termine: '410', significato: 'Gone' }, spiegazione: { it: 'Risorsa rimossa in modo permanente.', en: 'Resource permanently removed.' } },
    { id: 'webdev.http-422', sezione: 'http-status', campi: { termine: '422', significato: 'Unprocessable Content' }, spiegazione: { it: 'Sintassi valida ma semantica non elaborabile.', en: 'Well-formed but semantically invalid.' } },
    { id: 'webdev.http-429', sezione: 'http-status', campi: { termine: '429', significato: 'Too Many Requests' }, spiegazione: { it: 'Troppe richieste (rate limiting).', en: 'Too many requests (rate limiting).' } },
    { id: 'webdev.http-500', sezione: 'http-status', campi: { termine: '500', significato: 'Internal Server Error' }, spiegazione: { it: 'Errore generico del server.', en: 'Generic server error.' } },
    { id: 'webdev.http-501', sezione: 'http-status', campi: { termine: '501', significato: 'Not Implemented' }, spiegazione: { it: 'Funzionalità non implementata dal server.', en: 'Functionality not implemented.' } },
    { id: 'webdev.http-502', sezione: 'http-status', campi: { termine: '502', significato: 'Bad Gateway' }, spiegazione: { it: 'Risposta non valida da un server upstream.', en: 'Invalid response from an upstream server.' } },
    { id: 'webdev.http-503', sezione: 'http-status', campi: { termine: '503', significato: 'Service Unavailable' }, spiegazione: { it: 'Servizio momentaneamente non disponibile.', en: 'Service temporarily unavailable.' } },
    { id: 'webdev.http-504', sezione: 'http-status', campi: { termine: '504', significato: 'Gateway Timeout' }, spiegazione: { it: 'Timeout in attesa di un server upstream.', en: 'Timeout waiting for an upstream server.' } },

    // ── Metodi HTTP (RFC 9110) ──
    { id: 'webdev.met-get', sezione: 'http-metodi', campi: { termine: 'GET', significato: 'Recupera una risorsa senza modificarla' }, spiegazione: { it: 'Metodo sicuro e idempotente.', en: 'Safe and idempotent method.' } },
    { id: 'webdev.met-post', sezione: 'http-metodi', campi: { termine: 'POST', significato: 'Invia dati per creare o elaborare una risorsa' }, spiegazione: { it: 'Non idempotente.', en: 'Not idempotent.' } },
    { id: 'webdev.met-put', sezione: 'http-metodi', campi: { termine: 'PUT', significato: "Sostituisce integralmente la risorsa all'URI indicato" }, spiegazione: { it: 'Idempotente.', en: 'Idempotent.' } },
    { id: 'webdev.met-patch', sezione: 'http-metodi', campi: { termine: 'PATCH', significato: 'Applica una modifica parziale alla risorsa' }, spiegazione: { it: 'Aggiornamento parziale.', en: 'Partial update.' } },
    { id: 'webdev.met-delete', sezione: 'http-metodi', campi: { termine: 'DELETE', significato: 'Elimina la risorsa indicata' }, spiegazione: { it: 'Idempotente.', en: 'Idempotent.' } },
    { id: 'webdev.met-head', sezione: 'http-metodi', campi: { termine: 'HEAD', significato: 'Come GET ma senza corpo di risposta' }, spiegazione: { it: 'Restituisce solo gli header.', en: 'Returns headers only.' } },
    { id: 'webdev.met-options', sezione: 'http-metodi', campi: { termine: 'OPTIONS', significato: 'Descrive le opzioni di comunicazione della risorsa' }, spiegazione: { it: 'Usato anche nel preflight CORS.', en: 'Used in CORS preflight.' } },

    // ── Tag HTML (WHATWG HTML) ──
    { id: 'webdev.tag-a', sezione: 'html-tag', campi: { termine: '<a>', significato: 'Collegamento ipertestuale (link)' } },
    { id: 'webdev.tag-img', sezione: 'html-tag', campi: { termine: '<img>', significato: 'Immagine' } },
    { id: 'webdev.tag-p', sezione: 'html-tag', campi: { termine: '<p>', significato: 'Paragrafo' } },
    { id: 'webdev.tag-h1', sezione: 'html-tag', campi: { termine: '<h1>', significato: 'Intestazione di primo livello' } },
    { id: 'webdev.tag-ul', sezione: 'html-tag', campi: { termine: '<ul>', significato: 'Elenco non ordinato (puntato)' } },
    { id: 'webdev.tag-ol', sezione: 'html-tag', campi: { termine: '<ol>', significato: 'Elenco ordinato (numerato)' } },
    { id: 'webdev.tag-li', sezione: 'html-tag', campi: { termine: '<li>', significato: 'Elemento di una lista' } },
    { id: 'webdev.tag-table', sezione: 'html-tag', campi: { termine: '<table>', significato: 'Tabella' } },
    { id: 'webdev.tag-form', sezione: 'html-tag', campi: { termine: '<form>', significato: 'Modulo di inserimento dati' } },
    { id: 'webdev.tag-input', sezione: 'html-tag', campi: { termine: '<input>', significato: 'Campo di inserimento dati' } },
    { id: 'webdev.tag-div', sezione: 'html-tag', campi: { termine: '<div>', significato: 'Contenitore generico a blocco' } },
    { id: 'webdev.tag-span', sezione: 'html-tag', campi: { termine: '<span>', significato: 'Contenitore generico in linea' } },
    { id: 'webdev.tag-button', sezione: 'html-tag', campi: { termine: '<button>', significato: 'Pulsante' } },
    { id: 'webdev.tag-nav', sezione: 'html-tag', campi: { termine: '<nav>', significato: 'Sezione di navigazione' } },
    { id: 'webdev.tag-header', sezione: 'html-tag', campi: { termine: '<header>', significato: 'Intestazione di pagina o sezione' } },
    { id: 'webdev.tag-footer', sezione: 'html-tag', campi: { termine: '<footer>', significato: 'Piè di pagina' } },
    { id: 'webdev.tag-section', sezione: 'html-tag', campi: { termine: '<section>', significato: 'Sezione tematica del documento' } },
    { id: 'webdev.tag-label', sezione: 'html-tag', campi: { termine: '<label>', significato: 'Etichetta di un campo di un form' } },

    // ── Proprietà CSS (W3C/MDN) ──
    { id: 'webdev.css-color', sezione: 'css-proprieta', campi: { termine: 'color', significato: 'Colore del testo' } },
    { id: 'webdev.css-bgcolor', sezione: 'css-proprieta', campi: { termine: 'background-color', significato: 'Colore di sfondo' } },
    { id: 'webdev.css-fontsize', sezione: 'css-proprieta', campi: { termine: 'font-size', significato: 'Dimensione del carattere' } },
    { id: 'webdev.css-fontweight', sezione: 'css-proprieta', campi: { termine: 'font-weight', significato: 'Spessore (peso) del carattere' } },
    { id: 'webdev.css-margin', sezione: 'css-proprieta', campi: { termine: 'margin', significato: "Spazio esterno all'elemento" } },
    { id: 'webdev.css-padding', sezione: 'css-proprieta', campi: { termine: 'padding', significato: "Spazio interno all'elemento" } },
    { id: 'webdev.css-border', sezione: 'css-proprieta', campi: { termine: 'border', significato: "Bordo dell'elemento" } },
    { id: 'webdev.css-display', sezione: 'css-proprieta', campi: { termine: 'display', significato: "Tipo di box (block, inline, flex...)" } },
    { id: 'webdev.css-position', sezione: 'css-proprieta', campi: { termine: 'position', significato: 'Metodo di posizionamento' } },
    { id: 'webdev.css-width', sezione: 'css-proprieta', campi: { termine: 'width', significato: "Larghezza dell'elemento" } },
    { id: 'webdev.css-height', sezione: 'css-proprieta', campi: { termine: 'height', significato: "Altezza dell'elemento" } },
    { id: 'webdev.css-textalign', sezione: 'css-proprieta', campi: { termine: 'text-align', significato: 'Allineamento orizzontale del testo' } },
    { id: 'webdev.css-flexdir', sezione: 'css-proprieta', campi: { termine: 'flex-direction', significato: "Direzione dell'asse principale in flexbox" } },
    { id: 'webdev.css-justify', sezione: 'css-proprieta', campi: { termine: 'justify-content', significato: "Allineamento lungo l'asse principale (flex)" } },
    { id: 'webdev.css-align', sezione: 'css-proprieta', campi: { termine: 'align-items', significato: "Allineamento lungo l'asse trasversale (flex)" } },
    { id: 'webdev.css-opacity', sezione: 'css-proprieta', campi: { termine: 'opacity', significato: 'Opacità (trasparenza)' } },
    { id: 'webdev.css-zindex', sezione: 'css-proprieta', campi: { termine: 'z-index', significato: 'Ordine di sovrapposizione degli elementi' } },
    { id: 'webdev.css-overflow', sezione: 'css-proprieta', campi: { termine: 'overflow', significato: 'Gestione del contenuto in eccesso' } },
    { id: 'webdev.css-radius', sezione: 'css-proprieta', campi: { termine: 'border-radius', significato: 'Arrotondamento degli angoli' } },
    { id: 'webdev.css-shadow', sezione: 'css-proprieta', campi: { termine: 'box-shadow', significato: "Ombra dell'elemento" } },
  ],
};
