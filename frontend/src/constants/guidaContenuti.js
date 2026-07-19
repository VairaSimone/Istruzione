/**
 * CONTENUTO DELLA GUIDA PER LE SCUOLE (consultabile in-app dallo staff).
 *
 * Come i contenuti legali (`legaleContenuti.js`), la guida è un testo lungo e
 * che cambia di rado: tenerlo qui — e NON in `locales/translation.json` —
 * mantiene i file i18n snelli e concentra la guida in un unico punto, con
 * PARITÀ IT/EN.
 *
 * La struttura è quella attesa da `components/shared/PaginaLegale`:
 *   { titolo, sezioni: [ { titolo, paragrafi: [ ... ] } ] }
 *
 * Il documento sorgente completo (formattato) vive in `GUIDA-SCUOLE.md` nella
 * radice del repository; questo modulo ne è la versione impaginata per l'app.
 */

const it = {
  titolo: 'Guida per le scuole',
  sezioni: [
    {
      titolo: 'Introduzione',
      paragrafi: [
        'Questa guida spiega come usare la piattaforma dall’inizio alla fine: cosa vedi, cosa puoi configurare e come far funzionare ogni sezione, dai primi accessi fino alle iscrizioni a pagamento.',
        'È pensata per lo staff della scuola (insegnanti e amministrazione) e, dove serve, distingue ciò che spetta all’amministratore di piattaforma, la figura tecnica che crea le scuole e ne fissa i limiti.',
        'Gli argomenti puramente infrastrutturali (DNS, VPS e certificati per i domini personalizzati) sono trattati a parte nel documento “Guida ai domini personalizzati”. Qui ci occupiamo dell’uso della piattaforma.',
      ],
    },
    {
      titolo: '1. Concetti di base: ruoli e tenant',
      paragrafi: [
        'La piattaforma è multi-tenant: più scuole convivono sulla stessa installazione, ma ciascuna vede solo i propri dati. Ogni scuola è un tenant isolato.',
        'Studente — segue aule, corsi, compiti e quiz, riceve certificati e paga le iscrizioni a pagamento. È legato a una sola scuola.',
        'Insegnante (lo staff) — crea e gestisce i contenuti della propria scuola, invita gli utenti, configura le impostazioni e i pagamenti. Opera solo entro la propria scuola.',
        'Amministratore (admin) — figura trasversale alla piattaforma, non legata a una scuola. Crea le scuole, ne fissa i limiti e la commissione, può bloccarle e sbloccarle ed eliminarle.',
        'In breve: l’admin fa nascere e regola la scuola; l’insegnante la usa e la personalizza; lo studente la vive.',
      ],
    },
    {
      titolo: '2. Nascita di una scuola (compito dell’admin)',
      paragrafi: [
        'Prima che una scuola possa essere usata, l’admin la crea dal pannello di gestione scuole. In fase di creazione stabilisce il nome e lo slug (l’identificativo breve e stabile usato negli URL e nel riconoscimento del tenant).',
        'Fissa inoltre i limiti della scuola: spazio di archiviazione, numero massimo di utenti e di insegnanti.',
        'Definisce infine la commissione di piattaforma, ossia la percentuale trattenuta dalla piattaforma su ogni iscrizione a pagamento. La decide l’admin e la scuola non può modificarla.',
        'Fatto questo, l’admin comunica alla scuola le credenziali del primo account insegnante o invia un invito. Da lì in avanti la scuola è autonoma.',
      ],
    },
    {
      titolo: '3. Primo accesso e invito degli utenti',
      paragrafi: [
        'Si accede dalla pagina di login con email e password (è supportato anche l’accesso con account esterno, se configurato dalla piattaforma). Al primo accesso conviene completare subito il profilo e le impostazioni della scuola.',
        'Gli utenti non si registrano liberamente: entrano su invito. Per invitare uno studente si indica l’email e, facoltativamente, la classe (testo libero: es. “Prima”, “A1”, “Gruppo serale”). Lo studente riceve un’email con un link e completa la registrazione.',
        'Per invitare un insegnante si indica l’email: l’invitato diventa parte dello staff della scuola.',
        'Ogni invito ha un token con scadenza; finché non viene accettato resta in stato “in attesa” e può essere revocato. Gli inviti si consultano e filtrano per stato, ruolo ed email dal pannello inviti.',
        'Gli utenti aggiunti tramite invito vengono conteggiati nelle quote della scuola, sia quelli attivi sia quelli ancora in attesa.',
      ],
    },
    {
      titolo: '4. Il pannello Impostazioni',
      paragrafi: [
        'Le impostazioni della scuola sono guidate da schema: il pannello mostra i campi con il tipo giusto (testo, colore, URL, email, immagine) e li valida. Il salvataggio è per sezione: modificare una sezione non tocca le altre.',
        'Identità — nome visualizzato, nome breve, slogan, descrizione e le immagini: logo (anche una variante per il tema scuro), favicon, immagine hero e immagine di copertina.',
        'Aspetto — colore primario, secondario e d’accento; tema predefinito (chiaro, scuro o di sistema) e se lasciare l’utente libero di cambiarlo; se mostrare il nome accanto al logo. I colori sono applicati a runtime a tutta l’interfaccia.',
        'Contatti — email, email della segreteria, telefono (e un secondo numero), sito web e orari di apertura.',
        'Indirizzo — la sede fisica: via, città, CAP, provincia, paese.',
        'Social — i collegamenti ai profili social (Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Telegram e altri).',
        'Footer — testo e link del piè di pagina, testo di copyright e l’opzione per mostrare o meno i credit della piattaforma.',
        'Comunicazioni — un avviso pubblico (banner) mostrato in cima al sito e all’app: puoi attivarlo, scriverne il testo, sceglierne il tono (informazione, attenzione, successo) e aggiungere un link con etichetta.',
        'Homepage — la landing page pubblica servita sul dominio della scuola (vedi la sezione dedicata più avanti).',
        'Didattica — i vocabolari della scuola: come chiami classi, livelli e materie. Rende la piattaforma indipendente dalla materia insegnata.',
        'Funzionalità — l’interruttore generale delle sezioni attive della scuola, descritto nel capitolo successivo.',
      ],
    },
    {
      titolo: '5. Le funzionalità: cosa attivare',
      paragrafi: [
        'Ogni scuola decide quali sezioni rendere disponibili ai propri utenti. Disattivare una sezione la nasconde e la blocca per tutti: le pagine relative restituiscono “accesso negato”.',
        'Attive di default: Aule virtuali, Quiz, Corsi on-demand, Compiti, Messaggistica, Calendario, Certificazioni, Statistiche e dashboard, Gamification.',
        'Disattivate di default: Registro presenze, Pratica di scrittura e Pagamenti (iscrizioni a pagamento).',
        'Profilo e account è una funzionalità “di nucleo”: non è disattivabile, perché senza autenticazione e profilo la piattaforma non funziona.',
        'Le dipendenze si propagano: Compiti, Registro presenze e Pagamenti poggiano sulle Aule; se spegni le Aule, si spengono automaticamente anche loro. I Pagamenti richiedono inoltre i Corsi.',
      ],
    },
    {
      titolo: '6. Le sezioni didattiche in pratica',
      paragrafi: [
        'Aule virtuali — il contenitore dell’attività didattica: un’aula raccoglie insegnanti e studenti. È la base su cui poggiano compiti, presenze e, per le iscrizioni a pagamento, la destinazione automatica degli studenti che acquistano un corso.',
        'Corsi on-demand — contenuti strutturati in capitoli e sotto-capitoli con videolezioni e materiale allegato. Un corso ha uno stato (bozza o pubblicato) e, se pubblicato, può essere reso acquistabile per attivare l’iscrizione a pagamento.',
        'Compiti — assegnazione di attività ad aule o singoli studenti, con consegne e valutazioni. Le scadenze confluiscono anche nel calendario.',
        'Registro presenze (off di default) — appello per aula e data, con roster auto-precompilato. L’insegnante segna presenze, assenze, ritardi e uscite. La scuola può fissare un limite di assenze oltre il quale gli studenti vengono segnalati, e decidere se le assenze giustificate rientrano nel conteggio.',
        'Quiz — quiz personalizzati creati dallo staff oppure generati da template di piattaforma, con ripetizione spaziata per consolidare l’apprendimento.',
        'Calendario — un feed unificato che unisce eventi e scadenze dei compiti. Gli eventi possono contenere link a videochiamate (Zoom, Meet, Teams): la piattaforma riconosce automaticamente il servizio.',
        'Messaggistica, Statistiche e Gamification — comunicazioni interne, feedback e note private; heatmap di attività, streak e cruscotto per gli insegnanti; punti esperienza, livelli, streak e badge per motivare gli studenti.',
      ],
    },
    {
      titolo: '7. Pagamenti e iscrizioni a pagamento (Stripe)',
      paragrafi: [
        'La sezione Pagamenti consente alla scuola di incassare le iscrizioni ai corsi online, con iscrizione automatica all’aula a pagamento avvenuto. È disattivata di default e dipende da Corsi e Aule. Se la lasci spenta, gestisci le iscrizioni fuori piattaforma e iscrivi gli studenti manualmente alle aule.',
        'Come funziona il denaro: la piattaforma usa Stripe Connect con addebito diretto. L’incasso arriva sull’account Stripe della scuola (è la scuola a ricevere i soldi). Su ogni pagamento la piattaforma trattiene la sua commissione, mentre la commissione di Stripe è trattenuta a parte dal saldo della scuola. In pratica lo studente paga il prezzo pieno e la scuola riceve l’importo al netto di entrambe le commissioni.',
        'Prerequisito: i pagamenti funzionano solo se la piattaforma è configurata con le chiavi Stripe (compito dell’amministratore tecnico). Se non lo è, vedrai un avviso “pagamenti non configurati” e dovrai contattare l’amministratore.',
        'Attivazione passo-passo: 1) attiva la funzionalità Pagamenti dal pannello Funzionalità (richiede Corsi e Aule attive); 2) vai alla pagina Pagamenti della scuola; 3) collega Stripe avviando l’onboarding Connect (dati dell’attività, IBAN per i versamenti, verifica identità): al ritorno la piattaforma sincronizza lo stato; 4) attendi che l’account sia abilitato agli incassi (se l’onboarding si interrompe puoi riprenderlo); 5) attiva l’interruttore “usa Stripe”.',
        'I pagamenti diventano operativi solo quando entrambe le condizioni sono vere: interruttore attivo e onboarding completato. Finché l’account non è pronto, l’interruttore da solo non basta.',
        'Rendere un corso acquistabile: il corso deve essere pubblicato, marcato acquistabile, avere un prezzo e una valuta (un corso senza prezzo non è acquistabile anche se marcato tale) e avere un’aula di destinazione, cioè l’aula in cui lo studente sarà iscritto automaticamente a pagamento riuscito.',
        'L’esperienza dello studente: sfoglia il catalogo (se è già iscritto o ha già pagato, glielo segnaliamo), avvia il checkout — creiamo un ordine “in attesa” e una sessione Stripe — e paga sulla pagina sicura di Stripe. A pagamento riuscito, un webhook segna l’ordine “completato”, iscrive automaticamente lo studente all’aula di destinazione e invia una notifica allo studente e allo staff. Lo studente vede lo storico dei propri pagamenti; lo staff vede l’elenco dei pagamenti della scuola, filtrabile per stato.',
        'La commissione di piattaforma è decisa dall’admin per ciascuna scuola e non è modificabile dalla scuola: la vedi in sola lettura nella pagina Pagamenti. Disattivare l’interruttore “usa Stripe” non cancella l’account Connect né lo storico: è solo l’interruttore operativo.',
      ],
    },
    {
      titolo: '8. Certificati di fine corso',
      paragrafi: [
        'La sezione Certificazioni permette agli insegnanti di rilasciare attestati di fine corso agli studenti, scaricabili in PDF e interamente personalizzabili dalla scuola.',
        'Puoi personalizzare i testi (titolo, sottotitolo e corpo, con segnaposto come {{studente}}, {{corso}}, {{data}} e {{scuola}} sostituiti al momento del rilascio), la firma (nome e qualifica del firmatario, più un’immagine di firma) e la grafica (logo, colori di titolo, testo, bordo e sfondo, e orientamento del foglio, orizzontale o verticale).',
        'Puoi mostrare un codice di verifica: chiunque può controllare l’autenticità dell’attestato tramite l’apposita pagina pubblica. I PDF sono rigenerati on-demand da uno snapshot dei dati congelati al rilascio, così restano coerenti anche se in seguito modifichi la grafica.',
      ],
    },
    {
      titolo: '9. Homepage pubblica e richieste di contatto',
      paragrafi: [
        'Se la scuola ha un dominio personalizzato, può attivare una homepage pubblica. È un opt-in: finché non la attivi, il dominio mostra comunque la pagina di login con il tuo branding.',
        'Dall’editor della homepage puoi comporre una sezione hero (titolo, sottotitolo, immagine e un pulsante d’azione: iscriviti, contatti, accedi o nessuno), sezioni di contenuto libere, un form di contatto/iscrizione (con i tipi di richiesta ammessi, l’email di destinazione e un messaggio di conferma) e i metadati SEO.',
        'Le richieste inviate dal form diventano lead che lo staff rivede da una casella dedicata nell’app.',
      ],
    },
    {
      titolo: '10. Privacy, cookie e GDPR',
      paragrafi: [
        'La piattaforma include uno strato di conformità già pronto: documenti legali (informativa privacy, cookie policy, termini e condizioni, dichiarazione di accessibilità), banner di consenso cookie granulare con memorizzazione della scelta e accettazione dei termini registrata al momento della registrazione.',
        'Sono previsti i diritti dell’interessato: esportazione dei dati e cancellazione programmata dell’account, con job periodici di retention che ripuliscono i dati secondo le regole previste.',
        'Ricorda di compilare i tuoi dati di contatto e l’indirizzo nelle impostazioni, perché alimentano le informative pubbliche.',
      ],
    },
    {
      titolo: '11. Quote e limiti della scuola',
      paragrafi: [
        'Ogni scuola ha dei limiti fissati dall’admin: spazio di archiviazione, numero di utenti e numero di insegnanti. Nell’app trovi delle barre di occupazione che mostrano quanto stai usando rispetto al limite.',
        'I limiti sono applicati lato server: al raggiungimento del tetto, le operazioni che lo supererebbero (caricare file, invitare utenti) vengono bloccate. Nel conteggio degli utenti rientrano anche gli inviti ancora in attesa. Per alzare i limiti, fai richiesta all’amministratore di piattaforma.',
        'Una scuola può inoltre essere bloccata dall’admin (ad es. per sospensione): in quel caso l’accesso è negato ma i dati restano intatti ed è un’azione reversibile.',
      ],
    },
    {
      titolo: '12. Domande frequenti',
      paragrafi: [
        'Ho attivato “usa Stripe” ma il catalogo è vuoto o gli studenti non possono pagare — Verifica che l’onboarding Connect sia completato (l’interruttore da solo non basta), che la funzionalità Pagamenti sia attiva e che esista almeno un corso pubblicato, acquistabile, con prezzo e con aula di destinazione.',
        'Vedo “pagamenti non configurati su questa piattaforma” — Manca la configurazione Stripe a livello di piattaforma: è compito dell’amministratore tecnico.',
        'Ho disattivato le Aule e sono sparite anche altre sezioni — È voluto: Compiti, Presenze e Pagamenti dipendono dalle Aule e si spengono insieme.',
        'Un utente invitato non riesce a entrare — Controlla lo stato dell’invito (potrebbe essere scaduto o revocato) e rimandalo; verifica anche di non aver raggiunto il limite utenti.',
        'Non riesco a caricare file o immagini — Probabile quota di archiviazione esaurita: controlla le barre di occupazione o richiedi un aumento all’admin.',
        'Voglio cambiare la commissione di piattaforma — Non è modificabile dalla scuola: è una scelta dell’admin, da concordare con l’amministratore di piattaforma.',
        'Il mio dominio personalizzato non mostra la homepage — Assicurati che la homepage sia attivata e che DNS, proxy e certificati siano configurati e il dominio verificato: i dettagli sono nella Guida ai domini personalizzati.',
      ],
    },
  ],
};

const en = {
  titolo: 'School guide',
  sezioni: [
    {
      titolo: 'Introduction',
      paragrafi: [
        'This guide explains how to use the platform end to end: what you see, what you can configure and how to run each section, from the first sign-in to paid enrolments.',
        'It is written for school staff (teachers and administration) and, where relevant, distinguishes what falls to the platform administrator — the technical role that creates schools and sets their limits.',
        'Purely infrastructural topics (DNS, VPS and certificates for custom domains) are covered separately in the “Custom domains guide”. Here we focus on using the platform.',
      ],
    },
    {
      titolo: '1. Basics: roles and tenants',
      paragrafi: [
        'The platform is multi-tenant: several schools coexist on the same installation, but each sees only its own data. Every school is an isolated tenant.',
        'Student — follows classrooms, courses, assignments and quizzes, receives certificates and pays for paid enrolments. Belongs to a single school.',
        'Teacher (staff) — creates and manages their school’s content, invites users, configures settings and payments. Operates only within their own school.',
        'Administrator (admin) — a cross-platform role, not tied to any school. Creates schools, sets their limits and commission, and can block, unblock and delete them.',
        'In short: the admin creates and regulates the school; the teacher uses and customises it; the student lives it.',
      ],
    },
    {
      titolo: '2. Creating a school (admin task)',
      paragrafi: [
        'Before a school can be used, the admin creates it from the school management panel. During creation they set the name and the slug (the short, stable identifier used in URLs and tenant recognition).',
        'They also set the school’s limits: storage space, maximum number of users and of teachers.',
        'Finally, they define the platform commission — the percentage the platform withholds on each paid enrolment. The admin sets it and the school cannot change it.',
        'After that, the admin shares the first teacher account credentials with the school or sends an invite. From then on the school is self-sufficient.',
      ],
    },
    {
      titolo: '3. First sign-in and inviting users',
      paragrafi: [
        'You sign in from the login page with email and password (external account login is also supported, if configured by the platform). On first access it is best to complete your profile and the school settings straight away.',
        'Users do not register freely: they join by invitation. To invite a student you provide the email and, optionally, the class (free text: e.g. “First”, “A1”, “Evening group”). The student receives an email with a link and completes registration.',
        'To invite a teacher you provide the email: the invitee becomes part of the school staff.',
        'Every invite has a token with an expiry; until accepted it stays “pending” and can be revoked. Invites can be reviewed and filtered by status, role and email from the invites panel.',
        'Users added via invite count towards the school’s quotas, both active ones and those still pending.',
      ],
    },
    {
      titolo: '4. The Settings panel',
      paragrafi: [
        'School settings are schema-driven: the panel shows each field with the right type (text, colour, URL, email, image) and validates it. Saving is per section: changing one section does not touch the others.',
        'Identity — display name, short name, slogan, description and the images: logo (including a dark-theme variant), favicon, hero image and cover image.',
        'Appearance — primary, secondary and accent colours; default theme (light, dark or system) and whether to let users change it; whether to show the name next to the logo. Colours are applied at runtime across the whole interface.',
        'Contacts — email, front-office email, phone (and a second number), website and opening hours.',
        'Address — the physical location: street, city, postal code, province, country.',
        'Social — links to social profiles (Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Telegram and others).',
        'Footer — footer text and links, copyright text and the option to show or hide the platform credits.',
        'Announcements — a public banner shown at the top of the site and the app: you can enable it, write its text, choose its tone (info, warning, success) and add a labelled link.',
        'Homepage — the public landing page served on the school’s domain (see the dedicated section below).',
        'Teaching — the school’s vocabulary: how you name classes, levels and subjects. This makes the platform independent of the subject taught.',
        'Features — the master switch for the school’s active sections, described in the next chapter.',
      ],
    },
    {
      titolo: '5. Features: what to enable',
      paragrafi: [
        'Each school decides which sections to make available to its users. Disabling a section hides and blocks it for everyone: the related pages return “access denied”.',
        'Enabled by default: Virtual classrooms, Quizzes, On-demand courses, Assignments, Messaging, Calendar, Certificates, Statistics and dashboard, Gamification.',
        'Disabled by default: Attendance register, Writing practice and Payments (paid enrolments).',
        'Profile and account is a “core” feature: it cannot be disabled, because without authentication and profile the platform does not work.',
        'Dependencies cascade: Assignments, Attendance register and Payments rely on Classrooms; if you turn off Classrooms, they turn off too. Payments also require Courses.',
      ],
    },
    {
      titolo: '6. The teaching sections in practice',
      paragrafi: [
        'Virtual classrooms — the container of teaching activity: a classroom groups teachers and students. It is the base for assignments, attendance and, for paid enrolments, the automatic destination of students who buy a course.',
        'On-demand courses — content structured into chapters and sub-chapters with video lessons and attached material. A course has a status (draft or published) and, once published, can be made purchasable to enable paid enrolment.',
        'Assignments — assigning activities to classrooms or individual students, with submissions and grading. Deadlines also flow into the calendar.',
        'Attendance register (off by default) — roll call by classroom and date, with an auto-filled roster. The teacher records presences, absences, late arrivals and early exits. The school can set an absence limit beyond which students are flagged, and decide whether justified absences count.',
        'Quizzes — custom quizzes created by staff or generated from platform templates, with spaced repetition to consolidate learning.',
        'Calendar — a unified feed merging events and assignment deadlines. Events can include video-call links (Zoom, Meet, Teams): the platform detects the service automatically.',
        'Messaging, Statistics and Gamification — internal communications, feedback and private notes; activity heatmaps, streaks and a teacher dashboard; experience points, levels, streaks and badges to motivate students.',
      ],
    },
    {
      titolo: '7. Payments and paid enrolments (Stripe)',
      paragrafi: [
        'The Payments section lets the school collect course enrolments online, with automatic classroom enrolment once payment succeeds. It is disabled by default and depends on Courses and Classrooms. If you leave it off, you handle enrolments outside the platform and enrol students into classrooms manually.',
        'How the money works: the platform uses Stripe Connect with direct charges. The payment lands on the school’s Stripe account (the school receives the money). On each payment the platform withholds its commission, while Stripe’s fee is withheld separately from the school’s balance. In practice the student pays the full price and the school receives the amount net of both.',
        'Prerequisite: payments only work if the platform is configured with Stripe keys (a task for the technical administrator). If it is not, you will see a “payments not configured” notice and must contact the administrator.',
        'Step-by-step activation: 1) enable the Payments feature from the Features panel (requires Courses and Classrooms active); 2) go to the school’s Payments page; 3) connect Stripe by starting Connect onboarding (business details, payout IBAN, identity verification): on return the platform syncs the status; 4) wait until the account is enabled for charges (if onboarding is interrupted you can resume it); 5) turn on the “use Stripe” switch.',
        'Payments become operational only when both conditions are true: the switch is on and onboarding is complete. Until the account is ready, the switch alone is not enough.',
        'Making a course purchasable: the course must be published, marked purchasable, have a price and a currency (a course without a price is not purchasable even if marked so) and have a destination classroom — the classroom the student is automatically enrolled into once payment succeeds.',
        'The student experience: they browse the catalog (if already enrolled or already paid, we flag it), start checkout — we create a “pending” order and a Stripe session — and pay on Stripe’s secure page. Once payment succeeds, a webhook marks the order “completed”, automatically enrols the student into the destination classroom and notifies the student and staff. The student sees their own payment history; staff see the school’s payments list, filterable by status.',
        'The platform commission is set by the admin per school and cannot be changed by the school: you see it read-only on the Payments page. Turning off the “use Stripe” switch does not delete the Connect account or the history: it is only the operational switch.',
      ],
    },
    {
      titolo: '8. End-of-course certificates',
      paragrafi: [
        'The Certificates section lets teachers issue end-of-course certificates to students, downloadable as PDFs and fully customisable by the school.',
        'You can customise the texts (title, subtitle and body, with placeholders such as {{studente}}, {{corso}}, {{data}} and {{scuola}} replaced at issue time), the signature (signatory name and title, plus a signature image) and the design (logo, title/text/border/background colours, and sheet orientation, landscape or portrait).',
        'You can show a verification code: anyone can check a certificate’s authenticity via the dedicated public page. PDFs are regenerated on demand from a snapshot of the data frozen at issue time, so they stay consistent even if you later change the design.',
      ],
    },
    {
      titolo: '9. Public homepage and contact requests',
      paragrafi: [
        'If the school has a custom domain, it can enable a public homepage. It is opt-in: until you enable it, the domain still shows the login page with your branding.',
        'From the homepage editor you can compose a hero section (title, subtitle, image and an action button: enrol, contact, log in or none), free content sections, a contact/enrolment form (with the allowed request types, the destination email and a confirmation message) and the SEO metadata.',
        'Requests submitted through the form become leads that staff review from a dedicated inbox in the app.',
      ],
    },
    {
      titolo: '10. Privacy, cookies and GDPR',
      paragrafi: [
        'The platform includes a ready-made compliance layer: legal documents (privacy policy, cookie policy, terms and conditions, accessibility statement), a granular cookie consent banner that remembers the choice, and terms acceptance recorded at registration.',
        'Data-subject rights are provided: data export and scheduled account deletion, with periodic retention jobs that purge data according to the rules.',
        'Remember to fill in your contact details and address in the settings, as they feed the public notices.',
      ],
    },
    {
      titolo: '11. School quotas and limits',
      paragrafi: [
        'Every school has limits set by the admin: storage space, number of users and number of teachers. In the app you will find usage bars showing how much you are using against the limit.',
        'Limits are enforced server-side: at the cap, operations that would exceed it (uploading files, inviting users) are blocked. The user count also includes pending invites. To raise the limits, request it from the platform administrator.',
        'A school can also be blocked by the admin (e.g. for suspension): access is then denied but the data stays intact, and it is a reversible action.',
      ],
    },
    {
      titolo: '12. Frequently asked questions',
      paragrafi: [
        'I turned on “use Stripe” but the catalog is empty or students cannot pay — Check that Connect onboarding is complete (the switch alone is not enough), that the Payments feature is enabled and that there is at least one course that is published, purchasable, priced and with a destination classroom.',
        'I see “payments not configured on this platform” — The platform-level Stripe configuration is missing: this is a task for the technical administrator.',
        'I disabled Classrooms and other sections disappeared too — This is intended: Assignments, Attendance and Payments depend on Classrooms and turn off together.',
        'An invited user cannot get in — Check the invite status (it may have expired or been revoked) and resend it; also check you have not reached the user limit.',
        'I cannot upload files or images — Likely the storage quota is full: check the usage bars or request an increase from the admin.',
        'I want to change the platform commission — It cannot be changed by the school: it is the admin’s decision, to be agreed with the platform administrator.',
        'My custom domain does not show the homepage — Make sure the homepage is enabled and that DNS, proxy and certificates are configured and the domain verified: the details are in the Custom domains guide.',
      ],
    },
  ],
};

export const contenutiGuida = { it, en };

/**
 * Restituisce il contenuto della guida nella lingua indicata, con fallback
 * all'italiano se la lingua non è disponibile.
 * @param {string} lingua
 */
export const contenutoGuida = (lingua) => contenutiGuida[lingua] || contenutiGuida.it;
