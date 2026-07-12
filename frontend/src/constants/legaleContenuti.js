/**
 * CONTENUTI LEGALI VERSIONATI (Privacy, Cookie, Termini, Accessibilità).
 *
 * I testi legali sono lunghi e cambiano di rado: tenerli qui — e NON in
 * `locales/translation.json` — mantiene i file i18n snelli e concentra il testo
 * legale in un unico punto con una VERSIONE esplicita.
 *
 * ⚠️ IMPORTANTE — Da adattare prima della pubblicazione:
 *  - In una piattaforma multi-tenant il TITOLARE del trattamento è, di norma, la
 *    singola SCUOLA; la piattaforma agisce come RESPONSABILE (art. 28 GDPR). I
 *    testi qui sotto usano il segnaposto «[la Scuola]» e vanno rivisti da un
 *    legale/DPO, integrando i dati identificativi reali (denominazione, sede,
 *    P.IVA, contatti del titolare/DPO) e l'elenco dei sub-responsabili.
 *  - Le VERSIONI devono restare ALLINEATE ai valori del backend
 *    (`backend/src/constants/legale.js`): quando si aggiorna un testo in modo
 *    sostanziale si incrementa la versione corrispondente qui e lì.
 */

// Allineare a backend/src/constants/legale.js (VERSIONE_TERMINI / VERSIONE_CONSENSO_EMAIL).
export const VERSIONE_TERMINI = '2026-07-01';
export const VERSIONE_PRIVACY = '2026-07-01';
export const VERSIONE_CONSENSO_EMAIL = '2026-07-01';
export const VERSIONE_CONSENSO_COOKIE = '2026-07-01';

const it = {
  privacy: {
    titolo: 'Informativa sulla privacy',
    aggiornamento: VERSIONE_PRIVACY,
    sezioni: [
      {
        titolo: '1. Titolare del trattamento',
        paragrafi: [
          'Il Titolare del trattamento dei dati personali è [la Scuola], con sede in [indirizzo], contattabile all\'indirizzo [email del titolare]. Ove nominato, il Responsabile della protezione dei dati (DPO) è contattabile all\'indirizzo [email del DPO].',
          'La piattaforma che eroga il servizio agisce in qualità di Responsabile del trattamento per conto del Titolare, sulla base di un accordo ai sensi dell\'art. 28 del Regolamento (UE) 2016/679 (GDPR).',
        ],
      },
      {
        titolo: '2. Dati trattati',
        paragrafi: [
          'Trattiamo: dati anagrafici e di contatto (nome, cognome, età, email), dati dell\'account (ruolo, classe, scuola di appartenenza, lingua), dati generati dall\'uso del servizio (consegne dei compiti, risultati dei quiz, progressi, messaggi, notifiche, certificati) e dati tecnici minimi necessari alla sicurezza (log di accesso e di audit).',
        ],
      },
      {
        titolo: '3. Finalità e basi giuridiche',
        paragrafi: [
          'I dati sono trattati per erogare il servizio didattico e gestire l\'account (esecuzione del contratto/servizio), per adempiere agli obblighi di legge e per garantire la sicurezza della piattaforma (legittimo interesse). L\'invio delle notifiche via email avviene sulla base di un consenso revocabile in ogni momento dalle impostazioni del profilo.',
        ],
      },
      {
        titolo: '4. Minori',
        paragrafi: [
          'Il servizio può essere utilizzato da minori nel contesto scolastico. In Italia l\'età per il consenso digitale è fissata a 14 anni: per gli utenti di età inferiore è necessario il consenso verificabile di chi esercita la responsabilità genitoriale, gestito dal Titolare (la Scuola).',
        ],
      },
      {
        titolo: '5. Conservazione',
        paragrafi: [
          'I dati sono conservati per il tempo necessario alle finalità indicate e secondo la politica di conservazione del Titolare. Su richiesta di cancellazione dell\'account, i dati vengono eliminati in via definitiva al termine di un breve periodo di grazia; alcune categorie tecniche (es. notifiche già inviate) sono purgate periodicamente.',
        ],
      },
      {
        titolo: '6. Destinatari e trasferimenti',
        paragrafi: [
          'I dati possono essere trattati da fornitori che agiscono come sub-responsabili (es. servizio di hosting, provider email, autenticazione Google), nei limiti necessari all\'erogazione del servizio. Eventuali trasferimenti verso Paesi terzi avvengono in presenza di garanzie adeguate (es. clausole contrattuali standard).',
        ],
      },
      {
        titolo: '7. I tuoi diritti',
        paragrafi: [
          'Puoi esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione e portabilità (artt. 15-22 GDPR). Dalla sezione «I tuoi dati» del profilo puoi esportare i tuoi dati in formato leggibile e richiedere la cancellazione dell\'account. Hai inoltre il diritto di proporre reclamo all\'autorità di controllo (in Italia, il Garante per la protezione dei dati personali).',
        ],
      },
    ],
  },

  cookie: {
    titolo: 'Cookie Policy',
    aggiornamento: VERSIONE_CONSENSO_COOKIE,
    sezioni: [
      {
        titolo: '1. Cosa sono i cookie',
        paragrafi: [
          'I cookie sono piccoli file di testo che i siti salvano sul dispositivo per far funzionare le pagine o per raccogliere informazioni sull\'uso.',
        ],
      },
      {
        titolo: '2. Cookie necessari',
        paragrafi: [
          'Utilizziamo cookie tecnici indispensabili al funzionamento e alla sicurezza (autenticazione tramite cookie httpOnly, protezione CSRF, preferenza di lingua e tema). Non richiedono consenso e non possono essere disattivati.',
        ],
      },
      {
        titolo: '3. Cookie di preferenze, statistici e di marketing',
        paragrafi: [
          'Le categorie di preferenze, statistiche e marketing sono facoltative e restano disattivate finché non presti un consenso esplicito. Puoi scegliere quali attivare dal banner o dal link «Gestisci cookie» nel piè di pagina.',
        ],
      },
      {
        titolo: '4. Gestione del consenso',
        paragrafi: [
          'Puoi accettare tutto, rifiutare tutto (con la stessa facilità con cui accetti) o personalizzare le tue scelte in qualsiasi momento. La revoca è sempre possibile e non pregiudica l\'uso delle funzioni essenziali.',
        ],
      },
    ],
  },

  termini: {
    titolo: 'Termini e Condizioni d\'uso',
    aggiornamento: VERSIONE_TERMINI,
    sezioni: [
      {
        titolo: '1. Oggetto',
        paragrafi: [
          'I presenti Termini regolano l\'uso della piattaforma didattica. L\'accesso avviene esclusivamente su invito della scuola: non è prevista una registrazione pubblica.',
        ],
      },
      {
        titolo: '2. Account e sicurezza',
        paragrafi: [
          'Sei responsabile della riservatezza delle tue credenziali e delle attività svolte con il tuo account. Segnala tempestivamente ogni uso non autorizzato.',
        ],
      },
      {
        titolo: '3. Uso corretto',
        paragrafi: [
          'Ti impegni a usare il servizio nel rispetto della legge e dei regolamenti della scuola, senza caricare contenuti illeciti, offensivi o lesivi dei diritti altrui, e senza compromettere la sicurezza o l\'integrità della piattaforma.',
        ],
      },
      {
        titolo: '4. Contenuti',
        paragrafi: [
          'I contenuti didattici caricati restano di titolarità dei rispettivi autori/della scuola. Concedi le autorizzazioni necessarie affinché la piattaforma possa erogare il servizio (archiviazione e visualizzazione dei contenuti nell\'ambito del corso).',
        ],
      },
      {
        titolo: '5. Limitazione di responsabilità',
        paragrafi: [
          'Il servizio è fornito «così com\'è». Nei limiti consentiti dalla legge, non rispondiamo di danni indiretti derivanti da un uso non conforme del servizio. Restano impregiudicati i diritti inderogabili riconosciuti agli utenti.',
        ],
      },
      {
        titolo: '6. Modifiche',
        paragrafi: [
          'I Termini possono essere aggiornati. In caso di modifiche sostanziali potrà esserti richiesta una nuova accettazione. La versione vigente è indicata in cima a questa pagina.',
        ],
      },
    ],
  },

  accessibilita: {
    titolo: 'Dichiarazione di accessibilità',
    aggiornamento: VERSIONE_PRIVACY,
    sezioni: [
      {
        titolo: 'Impegno',
        paragrafi: [
          'Ci impegniamo a rendere la piattaforma accessibile al maggior numero possibile di persone, in linea con le Web Content Accessibility Guidelines (WCAG) 2.1 di livello AA e con la normativa europea sull\'accessibilità (Direttiva UE 2019/882 — European Accessibility Act).',
        ],
      },
      {
        titolo: 'Stato di conformità',
        paragrafi: [
          'La piattaforma è progettata per garantire navigazione da tastiera, contrasti adeguati, etichette sui campi dei moduli, focus visibile e compatibilità con le tecnologie assistive. Alcune sezioni potrebbero non essere ancora pienamente conformi: lavoriamo per migliorarle in modo continuativo.',
        ],
      },
    ],
  },
};

const en = {
  privacy: {
    titolo: 'Privacy Policy',
    aggiornamento: VERSIONE_PRIVACY,
    sezioni: [
      {
        titolo: '1. Data controller',
        paragrafi: [
          'The controller of personal data is [the School], with registered office at [address], reachable at [controller email]. Where appointed, the Data Protection Officer (DPO) can be reached at [DPO email].',
          'The platform providing the service acts as a data processor on behalf of the controller, under an agreement pursuant to Article 28 of Regulation (EU) 2016/679 (GDPR).',
        ],
      },
      {
        titolo: '2. Data we process',
        paragrafi: [
          'We process: identity and contact data (first name, last name, age, email), account data (role, class, school, language), data generated by using the service (assignment submissions, quiz results, progress, messages, notifications, certificates) and minimal technical data required for security (access and audit logs).',
        ],
      },
      {
        titolo: '3. Purposes and legal bases',
        paragrafi: [
          'Data is processed to deliver the educational service and manage the account (performance of the contract/service), to comply with legal obligations, and to ensure platform security (legitimate interest). Email notifications are sent based on consent, which can be withdrawn at any time from the profile settings.',
        ],
      },
      {
        titolo: '4. Minors',
        paragrafi: [
          'The service may be used by minors in a school context. In Italy the age for digital consent is 14: for younger users, verifiable consent from the holder of parental responsibility is required and is managed by the controller (the School).',
        ],
      },
      {
        titolo: '5. Retention',
        paragrafi: [
          'Data is kept for as long as necessary for the stated purposes and according to the controller\'s retention policy. Upon an account deletion request, data is permanently erased after a short grace period; some technical categories (e.g. already-sent notifications) are purged periodically.',
        ],
      },
      {
        titolo: '6. Recipients and transfers',
        paragrafi: [
          'Data may be processed by providers acting as sub-processors (e.g. hosting, email provider, Google authentication), only as needed to deliver the service. Any transfers to third countries take place with adequate safeguards (e.g. standard contractual clauses).',
        ],
      },
      {
        titolo: '7. Your rights',
        paragrafi: [
          'You may exercise the rights of access, rectification, erasure, restriction, objection and portability (Articles 15-22 GDPR). From the "Your data" section of your profile you can export your data in a readable format and request account deletion. You also have the right to lodge a complaint with the supervisory authority (in Italy, the Garante per la protezione dei dati personali).',
        ],
      },
    ],
  },

  cookie: {
    titolo: 'Cookie Policy',
    aggiornamento: VERSIONE_CONSENSO_COOKIE,
    sezioni: [
      {
        titolo: '1. What cookies are',
        paragrafi: [
          'Cookies are small text files that websites store on your device to make pages work or to collect information about usage.',
        ],
      },
      {
        titolo: '2. Necessary cookies',
        paragrafi: [
          'We use technical cookies essential for operation and security (httpOnly authentication, CSRF protection, language and theme preferences). They do not require consent and cannot be disabled.',
        ],
      },
      {
        titolo: '3. Preference, statistics and marketing cookies',
        paragrafi: [
          'The preference, statistics and marketing categories are optional and remain disabled until you give explicit consent. You can choose which to enable from the banner or the "Manage cookies" link in the footer.',
        ],
      },
      {
        titolo: '4. Managing consent',
        paragrafi: [
          'You can accept all, reject all (as easily as you accept), or customise your choices at any time. Withdrawal is always possible and does not affect the use of essential features.',
        ],
      },
    ],
  },

  termini: {
    titolo: 'Terms and Conditions',
    aggiornamento: VERSIONE_TERMINI,
    sezioni: [
      {
        titolo: '1. Purpose',
        paragrafi: [
          'These Terms govern the use of the learning platform. Access is by school invitation only: there is no public sign-up.',
        ],
      },
      {
        titolo: '2. Account and security',
        paragrafi: [
          'You are responsible for keeping your credentials confidential and for activity carried out with your account. Report any unauthorised use promptly.',
        ],
      },
      {
        titolo: '3. Acceptable use',
        paragrafi: [
          'You agree to use the service in compliance with the law and the school\'s rules, without uploading unlawful, offensive or infringing content, and without compromising the platform\'s security or integrity.',
        ],
      },
      {
        titolo: '4. Content',
        paragrafi: [
          'Uploaded educational content remains owned by its respective authors/the school. You grant the permissions needed for the platform to deliver the service (storing and displaying content within the course).',
        ],
      },
      {
        titolo: '5. Limitation of liability',
        paragrafi: [
          'The service is provided "as is". To the extent permitted by law, we are not liable for indirect damages arising from non-compliant use of the service. Mandatory user rights remain unaffected.',
        ],
      },
      {
        titolo: '6. Changes',
        paragrafi: [
          'These Terms may be updated. In the event of material changes you may be asked to accept them again. The version in force is shown at the top of this page.',
        ],
      },
    ],
  },

  accessibilita: {
    titolo: 'Accessibility statement',
    aggiornamento: VERSIONE_PRIVACY,
    sezioni: [
      {
        titolo: 'Commitment',
        paragrafi: [
          'We are committed to making the platform accessible to as many people as possible, in line with the Web Content Accessibility Guidelines (WCAG) 2.1 level AA and with European accessibility law (Directive (EU) 2019/882 — European Accessibility Act).',
        ],
      },
      {
        titolo: 'Conformance status',
        paragrafi: [
          'The platform is designed to support keyboard navigation, adequate contrast, form field labels, visible focus and compatibility with assistive technologies. Some sections may not yet be fully conformant: we work to improve them on an ongoing basis.',
        ],
      },
    ],
  },
};

export const contenutiLegali = { it, en };

/**
 * Restituisce il contenuto di una pagina legale nella lingua indicata, con
 * fallback all\'italiano se la lingua non è disponibile.
 * @param {'privacy'|'cookie'|'termini'|'accessibilita'} chiave
 * @param {string} lingua
 */
export const contenutoLegale = (chiave, lingua) => {
  const risorsa = contenutiLegali[lingua] || contenutiLegali.it;
  return risorsa[chiave] || contenutiLegali.it[chiave];
};
