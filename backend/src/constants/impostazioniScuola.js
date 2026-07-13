'use strict';

const AppError = require('../utils/AppError');
const piattaforma = require('../config/piattaforma');
const {
  CHIAVI_FUNZIONALITA,
  CHIAVI_NUCLEO,
  esiste: funzionalitaEsiste,
  funzionalitaPredefinite,
  risolviFunzionalita,
} = require('./funzionalita');
const { CODICI_TIPO: TIPI_RICHIESTA_CONTATTO } = require('./tipiRichiestaContatto');

/**
 * SCHEMA DELLE IMPOSTAZIONI DI UNA SCUOLA (tenant).
 *
 * `scuole.impostazioni` è una colonna JSON: nessuna migrazione è necessaria per
 * aggiungere un settaggio. Perché il blob non degeneri in un sacco di chiavi
 * arbitrarie, la sua forma è descritta QUI in modo dichiarativo: ogni campo
 * dichiara tipo, default e vincoli, e da questa descrizione derivano
 *
 *   - la NORMALIZZAZIONE dell'input (scarto delle chiavi sconosciute);
 *   - la VALIDAZIONE (422 con messaggio in italiano sul campo colpevole);
 *   - i DEFAULT applicati in lettura (la scuola vede sempre un blob completo);
 *   - la vista PUBBLICA per il frontend non autenticato.
 *
 * Aggiungere un settaggio = aggiungere una voce allo schema. Nient'altro.
 *
 * ─────────────────────────────────────────────
 * SEZIONI
 * ─────────────────────────────────────────────
 *   identita     → nome visualizzato, descrizione, logo, favicon, immagini
 *   aspetto      → colori principali, tema chiaro/scuro
 *   contatti     → email, telefono, sito web
 *   indirizzo    → sede fisica
 *   social       → collegamenti ai profili social
 *   footer       → testo e link personalizzabili del piè di pagina
 *   homepage     → landing page pubblica della scuola servita sul suo dominio
 *   didattica    → vocabolari della scuola (classi, livelli, materie)
 *   funzionalita → sezioni abilitate/disabilitate (cfr. constants/funzionalita)
 *
 */

// ─────────────────────────────────────────────
// Limiti e pattern condivisi
// ─────────────────────────────────────────────
const LUNGHEZZA = {
  nome: 160,
  slogan: 200,
  descrizione: 2000,
  url: 2048,
  email: 255,
  telefono: 40,
  testoFooter: 1000,
  etichetta: 60,
  vocabolo: 80,
  // Corpo del certificato: testo con segnaposto ({{studente}}, {{corso}}…).
  testoCertificato: 1500,
  // Identificativo di un file caricato (UUID) usato come logo/firma del certificato.
  idFile: 36,
  // Homepage pubblica.
  titoloHomepage: 200,
  testoHomepage: 4000,
  etichettaAzione: 60,
  messaggioConferma: 500,
  seoTitolo: 70,
  seoDescrizione: 200,
};

// Numero massimo di voci nelle liste (difesa contro blob gonfiati).
const MAX_VOCI = {
  link: 12,
  social: 12,
  vocabolario: 60,
  sezioniHomepage: 12,
};

// Azione del pulsante principale (hero) della homepage pubblica.
//   iscriviti → apre il form con tipo "iscrizione"
//   contatti  → apre il form con tipo "contatto"
//   accedi    → rimanda alla pagina di login
//   nessuna   → nessun pulsante
const AZIONI_HERO = ['iscriviti', 'contatti', 'accedi', 'nessuna'];

// Colore esadecimale: #RGB oppure #RRGGBB.
const COLORE_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// URL assoluto http(s) OPPURE percorso relativo (`/assets/logo.svg`): così una
// scuola può servire i propri asset dal frontend senza CDN esterna.
const URL_REGEX = /^(?:https?:\/\/[^\s]+|\/[^\s]*)$/i;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Telefono: cifre, spazi e i separatori usuali. Nessun vincolo di prefisso
// nazionale: la piattaforma può essere usata ovunque.
const TELEFONO_REGEX = /^[+()\-.\s\d]{4,40}$/;

const TEMI = ['chiaro', 'scuro', 'sistema'];

// Orientamento del foglio del certificato PDF.
const ORIENTAMENTI_CERTIFICATO = ['orizzontale', 'verticale'];

// Corpo predefinito del certificato. I segnaposto ({{...}}) sono sostituiti al
// momento del rilascio con i dati dello studente/corso (cfr. certificatoService).
const CORPO_CERTIFICATO_PREDEFINITO =
  'si attesta che {{studente}} ha completato con successo il percorso "{{corso}}" ' +
  'in data {{data}}. Il presente certificato è rilasciato da {{scuola}}.';

// Reti sociali riconosciute. `altri` accoglie qualunque altro collegamento
// senza toccare lo schema.
const RETI_SOCIAL = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'telegram'];

// ─────────────────────────────────────────────
// Errori
// ─────────────────────────────────────────────
const erroreImpostazione = (percorso, messaggio) =>
  new AppError(`Impostazioni: ${percorso} — ${messaggio}`, 422, 'INVALID_SETTINGS');

// ─────────────────────────────────────────────
// Homepage pubblica: forma di default.
//
// La sezione `homepage` è un CAMPO UNICO (blob coeso, come `social`): il
// frontend ne invia sempre l'oggetto completo e il validatore restituisce un
// blob normalizzato con tutti i sotto-campi valorizzati. Per questo il default
// deve essere una struttura completa e coerente, non un semplice `{}`.
// ─────────────────────────────────────────────
const homepagePredefinita = () => ({
  // Se false il dominio della scuola mostra comunque la pagina di login/branding
  // standard: la homepage personalizzata è un opt-in esplicito.
  attiva: false,
  hero: {
    titolo: null,
    sottotitolo: null,
    immagineUrl: null,
    testoAzione: null,
    tipoAzione: 'contatti',
  },
  sezioni: [],
  form: {
    abilitato: true,
    // Tutti i tipi di richiesta ammessi per default.
    tipiRichiesta: [...TIPI_RICHIESTA_CONTATTO],
    // Se nullo, il service ricade su `contatti.email` della scuola.
    emailDestinazione: null,
    messaggioConferma: null,
  },
  seo: {
    titolo: null,
    descrizione: null,
  },
});

// ─────────────────────────────────────────────
// Validatori elementari (tipo → funzione(valore, percorso, campo) → valore)
// Restituiscono `null` per i campi svuotati esplicitamente.
// ─────────────────────────────────────────────
const vuoto = (v) => v === undefined || v === null || v === '';

const validatori = {
  stringa: (v, percorso, campo) => {
    if (vuoto(v)) return null;
    if (typeof v !== 'string') throw erroreImpostazione(percorso, 'deve essere una stringa.');
    const s = v.trim();
    if (s.length > campo.max) {
      throw erroreImpostazione(percorso, `non può superare i ${campo.max} caratteri.`);
    }
    return s === '' ? null : s;
  },

  url: (v, percorso, campo) => {
    const s = validatori.stringa(v, percorso, { max: campo.max || LUNGHEZZA.url });
    if (s === null) return null;
    if (!URL_REGEX.test(s)) {
      throw erroreImpostazione(
        percorso,
        'deve essere un URL http(s) oppure un percorso relativo che inizia con "/".'
      );
    }
    return s;
  },

  email: (v, percorso) => {
    const s = validatori.stringa(v, percorso, { max: LUNGHEZZA.email });
    if (s === null) return null;
    if (!EMAIL_REGEX.test(s)) throw erroreImpostazione(percorso, 'non è un indirizzo email valido.');
    return s.toLowerCase();
  },

  telefono: (v, percorso) => {
    const s = validatori.stringa(v, percorso, { max: LUNGHEZZA.telefono });
    if (s === null) return null;
    if (!TELEFONO_REGEX.test(s)) throw erroreImpostazione(percorso, 'non è un numero di telefono valido.');
    return s;
  },

  colore: (v, percorso) => {
    const s = validatori.stringa(v, percorso, { max: 7 });
    if (s === null) return null;
    if (!COLORE_REGEX.test(s)) {
      throw erroreImpostazione(percorso, 'deve essere un colore esadecimale (es. #4F46E5).');
    }
    return s;
  },

  booleano: (v, percorso) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'boolean') throw erroreImpostazione(percorso, 'deve essere true o false.');
    return v;
  },

  enum: (v, percorso, campo) => {
    if (vuoto(v)) return null;
    if (!campo.valori.includes(v)) {
      throw erroreImpostazione(percorso, `deve essere uno di: ${campo.valori.join(', ')}.`);
    }
    return v;
  },

  /** Array di stringhe brevi, de-duplicato e ordinato come fornito. */
  vocabolario: (v, percorso, campo) => {
    if (v === undefined || v === null) return null;
    if (!Array.isArray(v)) throw erroreImpostazione(percorso, 'deve essere un array di stringhe.');
    if (v.length > MAX_VOCI.vocabolario) {
      throw erroreImpostazione(percorso, `non può contenere più di ${MAX_VOCI.vocabolario} voci.`);
    }
    const voci = [];
    for (const raw of v) {
      const s = validatori.stringa(raw, percorso, { max: campo.max || LUNGHEZZA.vocabolo });
      if (s === null) continue; // le voci vuote sono scartate, non sono un errore
      if (!voci.includes(s)) voci.push(s);
    }
    return voci;
  },

  /** Array di `{ etichetta, url }` (link del footer). */
  link: (v, percorso) => {
    if (v === undefined || v === null) return null;
    if (!Array.isArray(v)) throw erroreImpostazione(percorso, 'deve essere un array di collegamenti.');
    if (v.length > MAX_VOCI.link) {
      throw erroreImpostazione(percorso, `non può contenere più di ${MAX_VOCI.link} collegamenti.`);
    }
    return v.map((voce, i) => {
      const p = `${percorso}[${i}]`;
      if (!voce || typeof voce !== 'object' || Array.isArray(voce)) {
        throw erroreImpostazione(p, 'deve essere un oggetto { etichetta, url }.');
      }
      const etichetta = validatori.stringa(voce.etichetta, `${p}.etichetta`, { max: LUNGHEZZA.etichetta });
      const url = validatori.url(voce.url, `${p}.url`, {});
      if (!etichetta || !url) {
        throw erroreImpostazione(p, 'richiede sia "etichetta" che "url".');
      }
      return { etichetta, url };
    });
  },

  /** Collegamenti social: reti note + `altri` liberi. */
  social: (v, percorso) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'object' || Array.isArray(v)) {
      throw erroreImpostazione(percorso, 'deve essere un oggetto di collegamenti social.');
    }
    const risultato = {};
    for (const rete of RETI_SOCIAL) {
      const url = validatori.url(v[rete], `${percorso}.${rete}`, {});
      if (url) risultato[rete] = url;
    }
    if (v.altri !== undefined && v.altri !== null) {
      const altri = validatori.link(v.altri, `${percorso}.altri`);
      if (altri && altri.length) risultato.altri = altri;
    }
    return risultato;
  },

  /** Mappa chiave→booleano delle funzionalità, validata contro il registro. */
  funzionalita: (v, percorso) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'object' || Array.isArray(v)) {
      throw erroreImpostazione(percorso, 'deve essere un oggetto { funzionalita: booleano }.');
    }
    const parziali = {};
    for (const [chiave, valore] of Object.entries(v)) {
      if (!funzionalitaEsiste(chiave)) {
        throw erroreImpostazione(
          `${percorso}.${chiave}`,
          `funzionalità sconosciuta. Valori ammessi: ${CHIAVI_FUNZIONALITA.join(', ')}.`
        );
      }
      if (typeof valore !== 'boolean') {
        throw erroreImpostazione(`${percorso}.${chiave}`, 'deve essere true o false.');
      }
      if (CHIAVI_NUCLEO.includes(chiave) && valore === false) {
        throw erroreImpostazione(
          `${percorso}.${chiave}`,
          'è una funzionalità di nucleo e non può essere disattivata.'
        );
      }
      parziali[chiave] = valore;
    }
    // Applica default + dipendenze: il blob persistito è sempre coerente.
    return risolviFunzionalita(parziali);
  },

  /**
   * Homepage pubblica (campo unico): valida e NORMALIZZA in un blob completo,
   * fondendo l'input sui default. Un input `null`/assente lascia la homepage
   * invariata (in fase di merge). Le chiavi sconosciute vengono ignorate.
   */
  homepage: (v, percorso) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== 'object' || Array.isArray(v)) {
      throw erroreImpostazione(percorso, 'deve essere un oggetto.');
    }

    const out = homepagePredefinita();
    const stringa = (val, p, max) => validatori.stringa(val, p, { max });

    // attiva
    if (v.attiva !== undefined) {
      const b = validatori.booleano(v.attiva, `${percorso}.attiva`);
      out.attiva = b === null ? false : b;
    }

    // hero
    if (v.hero !== undefined && v.hero !== null) {
      if (typeof v.hero !== 'object' || Array.isArray(v.hero)) {
        throw erroreImpostazione(`${percorso}.hero`, 'deve essere un oggetto.');
      }
      const h = v.hero;
      out.hero.titolo = stringa(h.titolo, `${percorso}.hero.titolo`, LUNGHEZZA.titoloHomepage);
      out.hero.sottotitolo = stringa(h.sottotitolo, `${percorso}.hero.sottotitolo`, LUNGHEZZA.slogan);
      out.hero.immagineUrl = validatori.url(h.immagineUrl, `${percorso}.hero.immagineUrl`, {});
      out.hero.testoAzione = stringa(h.testoAzione, `${percorso}.hero.testoAzione`, LUNGHEZZA.etichettaAzione);
      const tipoAzione = validatori.enum(h.tipoAzione, `${percorso}.hero.tipoAzione`, { valori: AZIONI_HERO });
      if (tipoAzione !== null) out.hero.tipoAzione = tipoAzione;
    }

    // sezioni: array di { titolo, testo, immagineUrl }
    if (v.sezioni !== undefined && v.sezioni !== null) {
      if (!Array.isArray(v.sezioni)) {
        throw erroreImpostazione(`${percorso}.sezioni`, 'deve essere un array di sezioni.');
      }
      if (v.sezioni.length > MAX_VOCI.sezioniHomepage) {
        throw erroreImpostazione(
          `${percorso}.sezioni`,
          `non può contenere più di ${MAX_VOCI.sezioniHomepage} sezioni.`
        );
      }
      out.sezioni = v.sezioni.map((sez, i) => {
        const p = `${percorso}.sezioni[${i}]`;
        if (!sez || typeof sez !== 'object' || Array.isArray(sez)) {
          throw erroreImpostazione(p, 'deve essere un oggetto { titolo, testo, immagineUrl }.');
        }
        const titolo = stringa(sez.titolo, `${p}.titolo`, LUNGHEZZA.titoloHomepage);
        const testo = stringa(sez.testo, `${p}.testo`, LUNGHEZZA.testoHomepage);
        const immagineUrl = validatori.url(sez.immagineUrl, `${p}.immagineUrl`, {});
        if (!titolo && !testo && !immagineUrl) {
          throw erroreImpostazione(p, 'deve contenere almeno un titolo, un testo o un\'immagine.');
        }
        return { titolo, testo, immagineUrl };
      });
    }

    // form
    if (v.form !== undefined && v.form !== null) {
      if (typeof v.form !== 'object' || Array.isArray(v.form)) {
        throw erroreImpostazione(`${percorso}.form`, 'deve essere un oggetto.');
      }
      const f = v.form;
      if (f.abilitato !== undefined) {
        const b = validatori.booleano(f.abilitato, `${percorso}.form.abilitato`);
        out.form.abilitato = b === null ? true : b;
      }
      if (f.tipiRichiesta !== undefined && f.tipiRichiesta !== null) {
        if (!Array.isArray(f.tipiRichiesta)) {
          throw erroreImpostazione(`${percorso}.form.tipiRichiesta`, 'deve essere un array di tipi.');
        }
        const tipi = [];
        for (const t of f.tipiRichiesta) {
          if (!TIPI_RICHIESTA_CONTATTO.includes(t)) {
            throw erroreImpostazione(
              `${percorso}.form.tipiRichiesta`,
              `tipo di richiesta sconosciuto. Valori ammessi: ${TIPI_RICHIESTA_CONTATTO.join(', ')}.`
            );
          }
          if (!tipi.includes(t)) tipi.push(t);
        }
        // Un form abilitato senza alcun tipo sarebbe inutilizzabile: si ricade
        // sull'insieme completo dei tipi.
        out.form.tipiRichiesta = tipi.length ? tipi : [...TIPI_RICHIESTA_CONTATTO];
      }
      out.form.emailDestinazione = validatori.email(f.emailDestinazione, `${percorso}.form.emailDestinazione`);
      out.form.messaggioConferma = stringa(
        f.messaggioConferma,
        `${percorso}.form.messaggioConferma`,
        LUNGHEZZA.messaggioConferma
      );
    }

    // seo
    if (v.seo !== undefined && v.seo !== null) {
      if (typeof v.seo !== 'object' || Array.isArray(v.seo)) {
        throw erroreImpostazione(`${percorso}.seo`, 'deve essere un oggetto.');
      }
      out.seo.titolo = stringa(v.seo.titolo, `${percorso}.seo.titolo`, LUNGHEZZA.seoTitolo);
      out.seo.descrizione = stringa(v.seo.descrizione, `${percorso}.seo.descrizione`, LUNGHEZZA.seoDescrizione);
    }

    return out;
  },
};

// ─────────────────────────────────────────────
// SCHEMA
//   tipo      → chiave di `validatori`
//   default   → valore usato quando il campo non è impostato
//   pubblico  → esposto anche a `GET /api/config` (senza autenticazione)
// ─────────────────────────────────────────────
const SCHEMA = {
  identita: {
    pubblica: true,
    campi: {
      nomeVisualizzato: { tipo: 'stringa', max: LUNGHEZZA.nome, default: null, pubblico: true },
      slogan: { tipo: 'stringa', max: LUNGHEZZA.slogan, default: null, pubblico: true },
      descrizione: { tipo: 'stringa', max: LUNGHEZZA.descrizione, default: null, pubblico: true },
      logoUrl: { tipo: 'url', default: null, pubblico: true },
      logoScuroUrl: { tipo: 'url', default: null, pubblico: true },
      faviconUrl: { tipo: 'url', default: null, pubblico: true },
      immagineHeroUrl: { tipo: 'url', default: null, pubblico: true },
      immagineCopertinaUrl: { tipo: 'url', default: null, pubblico: true },
    },
  },

  aspetto: {
    pubblica: true,
    campi: {
      colorePrimario: { tipo: 'colore', default: '#4F46E5', pubblico: true },
      coloreSecondario: { tipo: 'colore', default: '#0EA5E9', pubblico: true },
      coloreAccento: { tipo: 'colore', default: '#F59E0B', pubblico: true },
      temaPredefinito: { tipo: 'enum', valori: TEMI, default: 'sistema', pubblico: true },
      // Se false il frontend non mostra l'interruttore chiaro/scuro.
      temaSelezionabile: { tipo: 'booleano', default: true, pubblico: true },
    },
  },

  contatti: {
    pubblica: true,
    campi: {
      email: { tipo: 'email', default: null, pubblico: true },
      telefono: { tipo: 'telefono', default: null, pubblico: true },
      sitoWeb: { tipo: 'url', default: null, pubblico: true },
    },
  },

  indirizzo: {
    pubblica: true,
    campi: {
      via: { tipo: 'stringa', max: LUNGHEZZA.nome, default: null, pubblico: true },
      citta: { tipo: 'stringa', max: LUNGHEZZA.etichetta, default: null, pubblico: true },
      cap: { tipo: 'stringa', max: 16, default: null, pubblico: true },
      provincia: { tipo: 'stringa', max: LUNGHEZZA.etichetta, default: null, pubblico: true },
      paese: { tipo: 'stringa', max: LUNGHEZZA.etichetta, default: null, pubblico: true },
    },
  },

  social: {
    pubblica: true,
    // Sezione a campo unico: l'intero oggetto è validato da `validatori.social`.
    campoUnico: { tipo: 'social', default: {}, pubblico: true },
  },

  footer: {
    pubblica: true,
    campi: {
      testo: { tipo: 'stringa', max: LUNGHEZZA.testoFooter, default: null, pubblico: true },
      link: { tipo: 'link', default: [], pubblico: true },
      mostraCredits: { tipo: 'booleano', default: true, pubblico: true },
    },
  },

  // HOMEPAGE PUBBLICA della scuola, servita sul suo dominio personalizzato a un
  // visitatore NON autenticato. Contenuto interamente curato dalla scuola:
  // titolo/sottotitolo, immagine, sezioni descrittive, form di contatto e SEO.
  // È PUBBLICA (esposta a `GET /api/config`): il frontend la usa per costruire
  // la landing page senza dati cablati. Campo unico: il frontend invia sempre
  // l'oggetto completo (come `social`), il validatore lo normalizza.
  homepage: {
    pubblica: true,
    campoUnico: { tipo: 'homepage', default: homepagePredefinita(), pubblico: true },
    // Blueprint della struttura, esposto da `descrizioneSchema()` per generare
    // l'editor lato admin senza duplicare i campi nel frontend.
    forma: {
      attiva: { tipo: 'booleano', default: false },
      hero: {
        titolo: { tipo: 'stringa', max: LUNGHEZZA.titoloHomepage },
        sottotitolo: { tipo: 'stringa', max: LUNGHEZZA.slogan },
        immagineUrl: { tipo: 'url' },
        testoAzione: { tipo: 'stringa', max: LUNGHEZZA.etichettaAzione },
        tipoAzione: { tipo: 'enum', valori: AZIONI_HERO, default: 'contatti' },
      },
      sezioni: {
        tipo: 'lista',
        max: MAX_VOCI.sezioniHomepage,
        voce: {
          titolo: { tipo: 'stringa', max: LUNGHEZZA.titoloHomepage },
          testo: { tipo: 'stringa', max: LUNGHEZZA.testoHomepage },
          immagineUrl: { tipo: 'url' },
        },
      },
      form: {
        abilitato: { tipo: 'booleano', default: true },
        tipiRichiesta: { tipo: 'multiselezione', valori: [...TIPI_RICHIESTA_CONTATTO] },
        emailDestinazione: { tipo: 'email' },
        messaggioConferma: { tipo: 'stringa', max: LUNGHEZZA.messaggioConferma },
      },
      seo: {
        titolo: { tipo: 'stringa', max: LUNGHEZZA.seoTitolo },
        descrizione: { tipo: 'stringa', max: LUNGHEZZA.seoDescrizione },
      },
    },
  },

  didattica: {
    // Vocabolari della scuola: sostituiscono le costanti che erano cablate nel
    // codice (le classi "Prima…Quinta", i livelli "N5…N1"). Ogni scuola definisce
    // i propri. Liste vuote ⇒ nessun vincolo, il campo resta a testo libero.
    pubblica: false,
    campi: {
      classiDisponibili: {
        tipo: 'vocabolario',
        max: LUNGHEZZA.vocabolo,
        default: ['Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta'],
        pubblico: false,
      },
      livelliDisponibili: {
        tipo: 'vocabolario',
        max: LUNGHEZZA.vocabolo,
        default: [],
        pubblico: false,
      },
      materieDisponibili: {
        tipo: 'vocabolario',
        max: LUNGHEZZA.vocabolo,
        default: [],
        pubblico: false,
      },
      // Se true (default) gli studenti possono giocare i TEMPLATE di piattaforma
      // in modalità libera, senza che un insegnante abbia installato un quiz.
      // Se false, l'accesso passa esclusivamente dai quiz pubblicati e abilitati
      // per una loro aula. Sostituisce la vecchia chiave ad-hoc di primo livello
      // `impostazioni.quizTemplateLibero`, che era fuori schema.
      accessoLiberoTemplate: { tipo: 'booleano', default: true, pubblico: false },
    },
  },

  // MODELLO DEL CERTIFICATO DI FINE CORSO.
  // Interamente personalizzabile dalla scuola: intestazione, testo con
  // segnaposto, colori, orientamento del foglio, logo e firma (immagini
  // caricate e referenziate per id). Config riservata allo staff: non è esposta
  // a `GET /api/config` (pubblica: false). I valori vengono "congelati" in uno
  // snapshot al momento del rilascio, così i certificati già emessi non cambiano
  // se in seguito la scuola modifica il modello (cfr. certificatoService).
  certificato: {
    pubblica: false,
    campi: {
      // Intestazione grande in cima al certificato.
      titolo: { tipo: 'stringa', max: LUNGHEZZA.nome, default: 'Certificato di Fine Corso', pubblico: false },
      // Riga introduttiva sopra il nome dello studente.
      sottotitolo: { tipo: 'stringa', max: LUNGHEZZA.slogan, default: 'Si conferisce il presente attestato a', pubblico: false },
      // Corpo con segnaposto: {{studente}}, {{corso}}, {{scuola}}, {{data}},
      // {{esito}}, {{firmatario}}.
      testoCorpo: {
        tipo: 'stringa',
        max: LUNGHEZZA.testoCertificato,
        default: CORPO_CERTIFICATO_PREDEFINITO,
        pubblico: false,
      },
      // Blocco firma (nome + qualifica di chi firma per la scuola).
      firmatarioNome: { tipo: 'stringa', max: LUNGHEZZA.nome, default: null, pubblico: false },
      firmatarioTitolo: { tipo: 'stringa', max: LUNGHEZZA.etichetta, default: null, pubblico: false },
      // Nota a piè di pagina (es. riferimenti legali, sede).
      piePagina: { tipo: 'stringa', max: LUNGHEZZA.testoFooter, default: null, pubblico: false },
      // Logo e firma: id di file immagine caricati (PNG/JPEG) e serviti in
      // locale. Sono validati come stringa qui; l'appartenenza alla scuola è
      // verificata al momento del rendering del PDF (difesa in profondità).
      logoFileId: { tipo: 'stringa', max: LUNGHEZZA.idFile, default: null, pubblico: false },
      firmaFileId: { tipo: 'stringa', max: LUNGHEZZA.idFile, default: null, pubblico: false },
      // Palette del certificato.
      coloreTitolo: { tipo: 'colore', default: '#1F2937', pubblico: false },
      coloreTesto: { tipo: 'colore', default: '#374151', pubblico: false },
      coloreBordo: { tipo: 'colore', default: '#4F46E5', pubblico: false },
      coloreSfondo: { tipo: 'colore', default: '#FFFFFF', pubblico: false },
      // Orientamento del foglio A4.
      orientamento: { tipo: 'enum', valori: ORIENTAMENTI_CERTIFICATO, default: 'orizzontale', pubblico: false },
      // Se true, stampa il codice di verifica pubblico sul certificato.
      mostraCodiceVerifica: { tipo: 'booleano', default: true, pubblico: false },
    },
  },

  funzionalita: {
    pubblica: true,
    campoUnico: { tipo: 'funzionalita', default: null, pubblico: true },
  },
};

const NOMI_SEZIONI = Object.keys(SCHEMA);

// ─────────────────────────────────────────────
// Default
// ─────────────────────────────────────────────

/** Clona in profondità un valore JSON (evita default condivisi per riferimento). */
const clona = (v) => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Blob completo con tutti i default dello schema. */
const impostazioniPredefinite = () => {
  const out = {};
  for (const [nomeSezione, sezione] of Object.entries(SCHEMA)) {
    if (sezione.campoUnico) {
      out[nomeSezione] =
        nomeSezione === 'funzionalita' ? funzionalitaPredefinite() : clona(sezione.campoUnico.default);
      continue;
    }
    out[nomeSezione] = Object.fromEntries(
      Object.entries(sezione.campi).map(([campo, descr]) => [campo, clona(descr.default)])
    );
  }
  return out;
};

// ─────────────────────────────────────────────
// Normalizzazione / validazione
// ─────────────────────────────────────────────

/**
 * Normalizza un blob (parziale o completo) rispetto allo schema.
 *
 *   - le chiavi/sezioni sconosciute sono SCARTATE (nessun errore: un blob
 *     scritto da una versione futura non rompe una versione precedente);
 *   - i valori presenti sono validati; un valore non conforme genera 422;
 *   - i campi assenti NON vengono riempiti con i default: questa funzione
 *     restituisce solo ciò che è stato effettivamente fornito, così da poterne
 *     fare un merge chirurgico. Usare `applicaDefault` per la vista completa.
 *
 * @param {object} input
 * @returns {object} blob normalizzato (solo le chiavi fornite e valide)
 */
const normalizzaImpostazioni = (input) => {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(
      'Le impostazioni devono essere un oggetto JSON (coppie chiave/valore).',
      422,
      'INVALID_SETTINGS'
    );
  }

  const out = {};

  for (const [nomeSezione, valoreSezione] of Object.entries(input)) {
    const sezione = SCHEMA[nomeSezione];
    if (!sezione) continue; // sezione sconosciuta ⇒ ignorata

    if (sezione.campoUnico) {
      const valore = validatori[sezione.campoUnico.tipo](valoreSezione, nomeSezione, sezione.campoUnico);
      if (valore !== null) out[nomeSezione] = valore;
      continue;
    }

    if (valoreSezione === null || typeof valoreSezione !== 'object' || Array.isArray(valoreSezione)) {
      throw erroreImpostazione(nomeSezione, 'deve essere un oggetto.');
    }

    const sezioneOut = {};
    for (const [nomeCampo, valoreCampo] of Object.entries(valoreSezione)) {
      const descr = sezione.campi[nomeCampo];
      if (!descr) continue; // campo sconosciuto ⇒ ignorato
      const valore = validatori[descr.tipo](valoreCampo, `${nomeSezione}.${nomeCampo}`, descr);
      // `null` è un valore legittimo: significa "svuota il campo".
      sezioneOut[nomeCampo] = valore;
    }
    if (Object.keys(sezioneOut).length) out[nomeSezione] = sezioneOut;
  }

  return out;
};

/**
 * MERGE per sezione: le sezioni non citate nel patch restano invariate, i campi
 * non citati dentro una sezione citata restano invariati. È il comportamento
 * atteso da un pannello di configurazione che salva una scheda per volta.
 *
 * Le sezioni a campo unico (`social`, `funzionalita`) sono sostituite per
 * intero, perché il loro valore è già un oggetto coeso.
 */
const mergeImpostazioni = (correnti, patch) => {
  const base = correnti && typeof correnti === 'object' && !Array.isArray(correnti) ? correnti : {};
  const delta = normalizzaImpostazioni(patch);
  const out = clona(base);

  for (const [nomeSezione, valoreSezione] of Object.entries(delta)) {
    if (SCHEMA[nomeSezione].campoUnico) {
      out[nomeSezione] = valoreSezione;
      continue;
    }
    out[nomeSezione] = { ...(out[nomeSezione] || {}), ...valoreSezione };
  }

  return out;
};

/**
 * Vista COMPLETA: blob persistito + default per ogni chiave mancante.
 * È ciò che ricevono staff e frontend autenticato.
 *
 * @param {object} persistite  blob della colonna `scuole.impostazioni`
 * @param {string} [nomeScuola] usato come fallback di `identita.nomeVisualizzato`
 */
const applicaDefault = (persistite, nomeScuola = null) => {
  const base = impostazioniPredefinite();
  const salvate = persistite && typeof persistite === 'object' && !Array.isArray(persistite) ? persistite : {};

  const out = {};
  for (const nomeSezione of NOMI_SEZIONI) {
    const sezione = SCHEMA[nomeSezione];

    if (sezione.campoUnico) {
      if (nomeSezione === 'funzionalita') {
        out[nomeSezione] = risolviFunzionalita(salvate[nomeSezione] || {});
      } else {
        out[nomeSezione] =
          salvate[nomeSezione] !== undefined && salvate[nomeSezione] !== null
            ? clona(salvate[nomeSezione])
            : base[nomeSezione];
      }
      continue;
    }

    out[nomeSezione] = { ...base[nomeSezione] };
    const salvataSezione = salvate[nomeSezione];
    if (salvataSezione && typeof salvataSezione === 'object' && !Array.isArray(salvataSezione)) {
      for (const nomeCampo of Object.keys(sezione.campi)) {
        if (salvataSezione[nomeCampo] !== undefined) {
          out[nomeSezione][nomeCampo] = clona(salvataSezione[nomeCampo]);
        }
      }
    }
  }

  // Fallback a cascata dell'identità: nome scuola → nome piattaforma.
  if (!out.identita.nomeVisualizzato) {
    out.identita.nomeVisualizzato = nomeScuola || piattaforma.NOME;
  }
  if (!out.identita.descrizione) {
    out.identita.descrizione = piattaforma.DESCRIZIONE;
  }

  return out;
};

/**
 * Vista PUBBLICA: solo le sezioni/campi marcati `pubblico`. Nessun dato
 * riservato (vocabolari didattici, note interne) lascia il backend senza
 * autenticazione.
 */
const impostazioniPubbliche = (persistite, nomeScuola = null) => {
  const complete = applicaDefault(persistite, nomeScuola);

  const out = {};
  for (const nomeSezione of NOMI_SEZIONI) {
    const sezione = SCHEMA[nomeSezione];
    if (!sezione.pubblica) continue;

    if (sezione.campoUnico) {
      if (sezione.campoUnico.pubblico) out[nomeSezione] = complete[nomeSezione];
      continue;
    }

    const campiPubblici = Object.entries(sezione.campi).filter(([, d]) => d.pubblico);
    if (!campiPubblici.length) continue;
    out[nomeSezione] = Object.fromEntries(
      campiPubblici.map(([nomeCampo]) => [nomeCampo, complete[nomeSezione][nomeCampo]])
    );
  }

  return out;
};

/**
 * Descrizione dello schema per il frontend: consente a un pannello di
 * amministrazione di generare il form senza conoscere i campi a priori.
 */
const descrizioneSchema = () =>
  Object.fromEntries(
    NOMI_SEZIONI.map((nomeSezione) => {
      const sezione = SCHEMA[nomeSezione];
      if (sezione.campoUnico) {
        return [
          nomeSezione,
          {
            campoUnico: true,
            tipo: sezione.campoUnico.tipo,
            pubblica: sezione.pubblica,
            // Blueprint della struttura per i campi unici complessi (es. homepage),
            // così l'editor lato admin può generarne il form.
            ...(sezione.forma ? { forma: clona(sezione.forma) } : {}),
            ...(sezione.campoUnico.default !== undefined && sezione.campoUnico.default !== null
              ? { default: clona(sezione.campoUnico.default) }
              : {}),
          },
        ];
      }
      return [
        nomeSezione,
        {
          campoUnico: false,
          pubblica: sezione.pubblica,
          campi: Object.fromEntries(
            Object.entries(sezione.campi).map(([nomeCampo, d]) => [
              nomeCampo,
              {
                tipo: d.tipo,
                ...(d.valori ? { valori: d.valori } : {}),
                ...(d.max ? { max: d.max } : {}),
                default: clona(d.default),
                pubblico: Boolean(d.pubblico),
              },
            ])
          ),
        },
      ];
    })
  );

/**
 * Estrae la mappa risolta delle funzionalità da un blob persistito.
 * Scorciatoia usata dal middleware di gate, che non ha bisogno del resto.
 */
const funzionalitaDi = (persistite) =>
  risolviFunzionalita((persistite && persistite.funzionalita) || {});

/**
 * Estrae un vocabolario didattico (classi/livelli/materie) applicando il default.
 * Un vocabolario VUOTO significa «nessun vincolo»: il campo è a testo libero.
 */
const vocabolario = (persistite, nome) => {
  const complete = applicaDefault(persistite);
  const voci = complete.didattica[nome];
  return Array.isArray(voci) ? voci : [];
};

/**
 * Estrae il MODELLO DEL CERTIFICATO risolto (default applicati) da un blob
 * persistito. È lo snapshot che il certificatoService congela al rilascio.
 */
const modelloCertificato = (persistite, nomeScuola = null) => {
  const complete = applicaDefault(persistite, nomeScuola);
  return { ...complete.certificato };
};

module.exports = {
  SCHEMA,
  NOMI_SEZIONI,
  TEMI,
  RETI_SOCIAL,
  AZIONI_HERO,
  homepagePredefinita,
  ORIENTAMENTI_CERTIFICATO,
  CORPO_CERTIFICATO_PREDEFINITO,
  COLORE_REGEX,
  URL_REGEX,
  impostazioniPredefinite,
  normalizzaImpostazioni,
  mergeImpostazioni,
  applicaDefault,
  impostazioniPubbliche,
  descrizioneSchema,
  funzionalitaDi,
  vocabolario,
  modelloCertificato,
};
