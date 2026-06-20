# Piattaforma Giapponese — Frontend

Frontend React per il backend Node/Express/MySQL del modulo di autenticazione
e gestione utenti. Costruito su React 19, Vite 6, React Router, TanStack
Query, React Hook Form, Zod e Zustand.

---

## 1. Analisi preliminare del backend

Prima di scrivere codice è stato analizzato il sorgente reale del backend
(non solo la documentazione fornita). Sono emerse discrepanze rilevanti tra
documentazione e implementazione, riportate qui per trasparenza.

### 🔴 Bug critico: il refresh token non funziona nello stato attuale del codice

`authService.refreshAccessToken` restituisce solo `{ accessToken }`, ma
`authController.refreshToken` tenta comunque di impostare un cookie con
`tokens.refreshToken` (che è `undefined`). Inoltre **né il login né la
registrazione salvano mai `refresh_token` nel database**, mentre
`refreshAccessToken` lo richiede per validare la richiesta — quindi ogni
chiamata reale a `POST /refresh-token` fallirà con `401
INVALID_REFRESH_TOKEN`.

**Decisione presa (concordata con il committente):** il frontend è stato
costruito assumendo il comportamento *documentato* e corretto (interceptor
Axios standard che ritenta la richiesta dopo un refresh riuscito — vedi
`src/api/authInterceptor.js`). Quando il backend verrà corretto, il
frontend funzionerà senza modifiche. Nello stato attuale, gli utenti
verranno disconnessi automaticamente alla scadenza dell'access token (15
minuti), dato che il refresh fallirà sempre.

### 🔴 `token_version` non viene mai verificato

Il modello incrementa `token_version` al logout/reset password per
invalidare le sessioni attive, ma `middleware/auth.js` non controlla mai
questo valore nei token decodificati. Il logout lato server non invalida
realmente gli access token già emessi (restano validi fino a naturale
scadenza). Il frontend tratta comunque il logout come l'azione corretta
dal punto di vista dell'utente (cancellazione cookie + pulizia stato locale).

### 🟡 Payload reset password: `nuovaPassword`, non `password`

La documentazione indica `{ token, password }`; il validator e il
controller reali richiedono `{ token, nuovaPassword }`. Il frontend usa
`nuovaPassword`.

### 🟡 `GET /confirm-email-change`: redirect solo in caso di successo

Il controller fa `res.redirect()` verso il frontend **solo se la
conferma ha successo**. In caso di token mancante, invalido o scaduto, il
backend risponde con JSON grezzo direttamente al browser (la richiesta
arriva da un click su un link email, non da una fetch del frontend — il
nostro router non la vede mai). Non esiste un modo lato client per
intercettare questo caso. **Decisione presa:** `VerifyEmailChangePage`
gestisce solo il percorso di successo (`?status=success`); per qualunque
altro stato mostra un messaggio neutro che invita l'utente a riprovare
dal proprio profilo, senza presumere un fallimento che non è stato
osservato direttamente.

### 🟡 Nessuna paginazione reale su `GET /gestione/utenti`

La documentazione lascia intendere una paginazione ("Spesso impaginati"),
ma il codice usa `findAll` senza `limit`/`offset`. Il frontend non invia
parametri di paginazione (sarebbe stata una funzionalità inventata).

### 🟡 Filtri reali non documentati esplicitamente

`GET /gestione/utenti` supporta `?ruolo=`, `?classe=`, `?nome=` (ricerca
parziale su nome/cognome). Confermati nel codice sorgente
(`getUtentiPerInsegnante`) e implementati nella UI (`UsersFilterBar`).

### 🟢 Confermato e implementato fedelmente

- Lockout dopo 5 tentativi di login falliti → blocco 15 minuti, 403.
- `forgot-password` non rivela se l'email esiste (anti user-enumeration).
- Login non restituisce i dati utente: il frontend chiama `GET /me` subito
  dopo un login riuscito per popolare lo stato applicativo.

---

## 2. Architettura

```
src/
├── api/            # Istanza Axios, interceptor di refresh, QueryClient
├── services/        # Funzioni che chiamano l'API, 1:1 con gli endpoint reali
├── hooks/            # Hook React Query (query + mutation) per ogni operazione
├── pages/            # Una pagina per ogni route applicativa
├── components/
│   ├── ui/            # Componenti atomici puri (Button, TextField, Card...)
│   ├── layout/        # Header, Footer, AppLayout
│   └── shared/        # EmptyState, ErrorState, Skeleton, ConfirmDialog...
├── features/          # Componenti di dominio specifici (auth/, users/)
├── routes/            # Router, ProtectedRoute, PublicOnlyRoute
├── store/             # Store Zustand (stato auth globale)
├── utils/              # parseApiError e altre utility pure
├── validators/        # Schemi Zod, fedeli alle regole reali del backend
└── constants/          # Route, domini (ruoli/classi/lingue), query keys
```

### Perché Zustand invece di Context API

Lo stato globale necessario è piccolo (utente corrente + flag di sessione
verificata), ma viene letto da componenti sparsi in tutto l'albero
(Header, ProtectedRoute, Dashboard, ogni mutation che tocca il profilo).
Con Context puro, ogni cambiamento di stato re-renderizza tutti i
consumer del Provider, a meno di split manuale in più Context o memo
selettivi. Zustand offre selettori granulari (`useAuthStore(selector)`)
che evitano re-render superflui senza boilerplate aggiuntivo, supporto
DevTools integrato, e non richiede avvolgere l'albero in un Provider —
riducendo l'annidamento. Per uno scope di questa dimensione la differenza
è contenuta, ma Zustand scala meglio se in futuro si aggiungono altri
slice di stato globale (es. preferenze UI, notifiche).

### Gestione della sessione

Il backend usa cookie **httpOnly** per `access_token` e `refresh_token`:
il frontend non li legge né li scrive mai direttamente (è una scelta di
sicurezza del backend, rispettata). La sessione "persiste" tra refresh di
pagina perché il cookie sopravvive; lo stato React (`useAuthStore`) viene
ricostruito ad ogni avvio dell'app chiamando `GET /me` (vedi
`useCurrentUser`, montato in `App.jsx`). Se la chiamata fallisce (nessun
cookie valido), l'utente è considerato non autenticato.

### Refresh automatico del token

`src/api/authInterceptor.js` intercetta le risposte 401 con
`code: 'TOKEN_EXPIRED'`, chiama `POST /refresh-token` (il cookie
`refresh_token` viaggia automaticamente, nessun body necessario), e
ritenta la richiesta originale una sola volta. Richieste multiple in
parallelo che falliscono simultaneamente condividono la stessa promise di
refresh, per evitare race condition. Su fallimento del refresh (o su
codici `REFRESH_TOKEN_EXPIRED` / `INVALID_REFRESH_TOKEN` /
`NO_REFRESH_TOKEN`), l'utente viene disconnesso e reindirizzato al login.

### Validazione

Gli schemi Zod in `src/validators/authSchemas.js` rispecchiano
letteralmente le regex e i range del backend (stessa regex password,
stesso pattern nome/cognome, stessi limiti età 14–99), per garantire che
ciò che il client accetta sia ciò che il server accetterà, evitando sia
falsi negativi lato client sia submit che il server rifiuterebbe comunque.

---

## 3. Mappatura endpoint → schermate

| Endpoint backend | Metodo | Schermata / componente | Hook |
|---|---|---|---|
| `/auth/register` | POST | `RegisterPage` | `useRegister` |
| `/auth/login` | POST | `LoginPage` | `useLogin` |
| `/auth/refresh-token` | POST | (automatico, interceptor) | `authInterceptor.js` |
| `/auth/forgot-password` | POST | `ForgotPasswordPage` | `useForgotPassword` |
| `/auth/reset-password` | POST | `ResetPasswordPage` | `useResetPassword` |
| `/auth/verify-email` | POST | `VerifyEmailPage` | `useVerifyEmail` |
| `/auth/me` | GET | Bootstrap sessione (`App.jsx`), `DashboardPage`, `ProfilePage` | `useCurrentUser` |
| `/auth/logout` | POST | `Header` (bottone "Esci") | `useLogout` |
| `/auth/me` | DELETE | `ProfilePage` → `DeleteAccountSection` | `useDeleteMyAccount` |
| `/auth/me/lingua` | PATCH | `ProfilePage` → `LanguageSection` | `useUpdateLanguage` |
| `/auth/request-email-change` | POST | `ProfilePage` → `ChangeEmailSection` | `useRequestEmailChange` |
| `/auth/confirm-email-change` | GET | `VerifyEmailChangePage` (raggiunta dal redirect del backend, non chiamata via fetch) | — |
| `/auth/gestione/utenti` | GET | `UsersManagementPage` | `useUsersList` |
| `/auth/gestione/utenti/:id/ruolo` | PATCH | `UsersManagementPage` → `UserRow` | `useUpdateUserRole` |
| `/auth/gestione/utenti/:id` | DELETE | `UsersManagementPage` → `UserRow` | `useDeleteUserByTeacher` |

Nessun endpoint documentato e implementato nel backend resta inutilizzato.

---

## 4. Funzionalità implementate

- Registrazione con validazione completa lato client (nome, cognome, età,
  email, password con requisiti di complessità, classe).
- Login con gestione esplicita del lockout (countdown leggibile) e
  dell'errore "email non verificata".
- Refresh automatico della sessione via interceptor Axios.
- Logout con pulizia completa di stato locale e cache React Query.
- Recupero e reset password via link email.
- Verifica email post-registrazione.
- Richiesta di cambio email con pagina di esito dedicata.
- Eliminazione account con conferma esplicita a due passaggi.
- Cambio lingua di preferenza.
- Dashboard con riepilogo profilo, adattata al ruolo.
- Gestione utenti (solo insegnanti): elenco, filtri per nome/ruolo/classe,
  cambio ruolo inline, eliminazione con dialog di conferma.
- Route protette per autenticazione e per ruolo, con redirect coerenti.
- Skeleton loading, stati vuoti, stati di errore con retry, notifiche
  toast per ogni operazione con effetti collaterali.
- Accessibilità: focus visibile, `aria-live`/`role="alert"` sugli errori,
  focus trap minimo sui dialog, rispetto di `prefers-reduced-motion`.

---

## 5. Configurazione

Copia `.env.example` in `.env` e aggiorna i valori secondo il tuo ambiente:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Piattaforma Giapponese
```

`VITE_API_BASE_URL` deve puntare al backend Express (prefisso `/api`
incluso, come da `app.js` del backend). Il backend si aspetta richieste
provenienti esattamente da `http://localhost:5173` in sviluppo (vedi
`CORS_ORIGIN` nel backend) — la porta è fissata esplicitamente in
`vite.config.js` per questo motivo.

---

## 6. Avvio del progetto

```bash
npm install
npm run dev          # sviluppo, http://localhost:5173
npm run build        # build di produzione in dist/
npm run preview      # serve la build di produzione in locale
npm run lint          # ESLint
npm run lint:fix      # ESLint con fix automatico
npm run format         # Prettier (scrive le modifiche)
npm run format:check   # Prettier (solo verifica)
```

Il backend deve essere in esecuzione e raggiungibile all'URL configurato
in `VITE_API_BASE_URL` perché l'app sia funzionale.

---

## 7. Limiti noti (ereditati dal backend, non risolvibili lato frontend)

1. Il refresh token non funzionerà finché il backend non salva
   `refresh_token` nel DB al login e non corregge `refreshAccessToken`
   per restituire effettivamente un nuovo refresh token.
2. Il logout/reset-password non invalida realmente gli access token già
   emessi, perché `token_version` non viene verificato in `auth.js`.
3. Un link di cambio email scaduto/invalido mostra JSON grezzo dell'API
   invece di una pagina applicativa, perché il backend non reindirizza in
   caso di errore su `GET /confirm-email-change`.
