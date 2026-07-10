# CHANGES — Frontend: pannello preferenze notifiche email

Data: 11/07/2026
Ambito: **frontend** (React 19 / Vite / React Query / i18n)

Questa iterazione aggiunge al **profilo utente** un pannello "Notifiche email"
per gestire le preferenze introdotte nella sessione backend precedente. L'utente
può attivare/disattivare tutte le email di notifica (interruttore generale) e
scegliere singolarmente le categorie: nuovi messaggi, nuovi compiti, compiti in
scadenza, feedback ricevuti.

Si collega agli endpoint backend già esistenti:
- `GET /api/auth/me/notifiche` — legge le preferenze (blob completo dei default);
- `PATCH /api/auth/me/notifiche` — salva interruttore generale + categorie.

---

## 1. File nuovi

- **`src/features/auth/components/NotificationSection.jsx`**
  La sezione "Notifiche email" del profilo. Mostra:
  - un **interruttore generale** (`emailAttive`): se spento, disabilita i toggle
    di categoria (con feedback visivo) — coerente col comportamento del backend,
    che in quel caso non invia nulla;
  - un **toggle per categoria** (messaggi, compiti, scadenze, feedback), ognuno
    con titolo e descrizione.
  Usa una **bozza locale**: l'utente può cambiare più toggle e salvare in un
  colpo solo; il pulsante "Salva" è attivo solo se ci sono modifiche pendenti.
  Stati gestiti: caricamento (spinner), errore (messaggio localizzato), successo
  (toast). La sincronizzazione bozza↔server usa il pattern *derived-state-on-
  change* (nessun `useEffect` con `setState`, come richiede l'ESLint del
  progetto): niente render a cascata.

- **`src/features/auth/components/NotificationSection.module.css`**
  Stile del pannello, allineato ai design token del progetto e agli stili toggle
  già usati in `FunzionalitaPanel` (coerenza visiva con il resto delle
  impostazioni).

---

## 2. File modificati

- **`src/services/authService.js`**
  Aggiunte `getNotificationPreferences()` e `updateNotificationPreferences({ emailAttive, categorie })`,
  mappate 1:1 sugli endpoint backend. Il token CSRF sul `PATCH` è gestito
  automaticamente dall'interceptor Axios esistente.

- **`src/hooks/useProfileMutations.js`**
  Nuovi hook:
  - `useNotificationPreferences()` — query React Query che restituisce il blob
    delle preferenze;
  - `useUpdateNotificationPreferences()` — mutation che, al successo, aggiorna la
    cache con la versione **normalizzata** restituita dal backend (così i toggle
    riflettono subito lo stato salvato).

- **`src/constants/queryKeys.js`**
  Aggiunta la chiave `auth.notifiche` per la cache delle preferenze.

- **`src/pages/ProfilePage.jsx`**
  Inserita `<NotificationSection />` nel profilo, tra la sezione Lingua e il
  cambio email.

- **`src/locales/it/translation.json`** + **`src/locales/en/translation.json`**
  Nuovo blocco `notifications` (titolo, descrizione, interruttore generale, le 4
  categorie con titolo+descrizione, pulsante e messaggio di conferma).
  **Parità IT/EN verificata** programmaticamente.

---

## 3. Comportamento

- All'apertura del profilo, il pannello carica le preferenze correnti. Se
  l'utente non le ha mai toccate, riceve i **default** (tutto attivo) applicati
  dal backend.
- Spegnere l'interruttore generale disabilita visivamente i toggle di categoria:
  è chiaro che nessuna email verrà inviata, qualunque sia lo stato delle
  categorie.
- "Salva preferenze" invia il blob completo; al successo compare un toast e la
  cache viene aggiornata con quanto normalizzato dal server.

---

## 4. Validazione eseguita

- **ESLint** sui file nuovi/modificati → nessun problema.
- **`npm run lint`** sull'intero progetto → nessun problema (nessuna regressione).
- **`npm run build`** (Vite, produzione) → 537 moduli trasformati, build
  completato. (Il warning sulla dimensione del chunk è **preesistente** e non
  legato a questa modifica.)
- **Parità i18n IT/EN** verificata programmaticamente (1279 chiavi per lato,
  nessuna asimmetria; 14 nuove chiavi `notifications.*`).

---

## 5. Stato complessivo della funzionalità

Con questa sessione la funzionalità "notifiche email" è **completa end-to-end**:

- **Backend** (sessione precedente): coda notifiche, digest periodico con tetto
  giornaliero (2-3 email/giorno), scansione scadenze, endpoint preferenze.
- **Frontend** (questa sessione): pannello preferenze nel profilo.

Non restano passi obbligatori. Possibili estensioni future (facoltative): un
badge/centro notifiche in-app, oppure la scelta della frequenza del digest da
parte dell'utente (oggi è governata lato server dalle variabili d'ambiente).
