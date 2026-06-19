# Node.js Auth Backend

Backend completo per autenticazione e gestione utenti con **Node.js**, **Express.js**, **MySQL** e **JWT**.

---

## Stack Tecnologico

| Componente | Libreria | Motivazione |
|---|---|---|
| Runtime | Node.js 20 LTS | Versione stabile con supporto lungo termine |
| Framework | Express.js 4 | Maturo, flessibile, ecosystem enorme |
| Database | MySQL 8 | Relazionale, ACID, ottimo per dati strutturati |
| ORM | **Sequelize** | Scelto su mysql2 raw per: modelli tipizzati, hook automatici (hash password), gestione migrazione, validazioni integrate, protezione SQL Injection nativa |
| Hashing | bcryptjs | Standard per password: slow by design, salt automatico |
| Auth | jsonwebtoken | JWT: stateless, scalabile, standard RFC 7519 |
| Sicurezza | helmet, cors, express-rate-limit | Trio standard di sicurezza Express |
| Validazione | express-validator | Middleware, chainable, integrato con Express |
| Logging | winston + morgan | Strutturato (JSON in prod), colorato in dev |
| Env | dotenv | Standard de facto |

---

## Installazione

### Prerequisiti
- Node.js >= 20
- MySQL >= 8.0
- npm >= 9

### 1. Clona e installa le dipendenze

```bash
git clone <repo>
cd node-auth-backend
npm install
```

### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

Apri `.env` e modifica tutti i valori — soprattutto:
- `DB_PASSWORD` → password del tuo MySQL
- `JWT_ACCESS_SECRET` → stringa casuale lunga (min 32 caratteri)
- `JWT_REFRESH_SECRET` → stringa casuale lunga DIVERSA dalla precedente

**Genera segreti sicuri con:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Crea il database

```bash
mysql -u root -p < schema.sql
```

Oppure manualmente:
```sql
CREATE DATABASE auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Avvia il server

```bash
# Sviluppo (con nodemon, auto-restart)
npm run dev

# Produzione
npm start

# Solo migrazione DB (senza avviare il server)
npm run db:migrate
```

Il server è su: `http://localhost:3000`

---

## Struttura del Progetto

```
src/
├── config/
│   ├── database.js        ← Istanza Sequelize con pool di connessioni
│   └── jwt.js             ← Configurazione centralizzata JWT
│
├── controllers/
│   └── authController.js  ← Livello sottile: estrae params, chiama services, formatta response
│
├── middleware/
│   ├── auth.js            ← authenticateJWT + authorizeRoles
│   ├── errorHandler.js    ← Gestione centralizzata errori (operazionali vs bug)
│   ├── rateLimiter.js     ← Limitatori per rotte globali, login, forgot-password
│   ├── requestLogger.js   ← Morgan → Winston
│   └── validate.js        ← Controlla risultati di express-validator
│
├── models/
│   └── Utente.js          ← Modello Sequelize con hook beforeSave per hash password
│
├── routes/
│   └── authRoutes.js      ← Definizione route con middleware chain documentata
│
├── services/
│   └── authService.js     ← Tutta la logica di business (registrazione, login, reset...)
│
├── utils/
│   ├── AppError.js        ← Classe custom per errori operazionali
│   ├── catchAsync.js      ← Wrapper per evitare try/catch nei controller
│   ├── jwtHelpers.js      ← generateAccessToken, generateRefreshToken, verify*
│   └── logger.js          ← Winston configurato per dev (colorato) e prod (JSON)
│
├── validators/
│   └── authValidators.js  ← Regole express-validator per ogni endpoint
│
├── database/
│   └── migrate.js         ← Script standalone per sincronizzare il DB
│
├── app.js                 ← Configurazione Express (middleware, route, error handler)
└── server.js              ← Entry point: connette DB, avvia HTTP server, graceful shutdown
```

---

## Architettura

Il codice segue il pattern **Controller → Service → Model**:

```
Request
  ↓
Route (definisce middleware chain)
  ↓
Middleware (rate limit → auth JWT → validazione input)
  ↓
Controller (estrae parametri, chiama service, formatta response)
  ↓
Service (logica di business, accede ai model)
  ↓
Model/DB (Sequelize → MySQL)
  ↓
Response
```

**Perché separare Controller e Service?**
- Il controller conosce HTTP (req, res); il service non lo conosce → testabile senza Express
- Riuso: lo stesso service può essere chiamato da CLI, worker, altro controller
- Singola responsabilità

---

## API Reference

### `POST /api/auth/register`

Registra un nuovo utente. Il ruolo viene impostato automaticamente a `studente`.

**Request:**
```json
{
  "nome": "Mario",
  "cognome": "Rossi",
  "eta": 18,
  "email": "mario@email.it",
  "password": "Password123!",
  "classe": "Quarta"
}
```

**Response 201:**
```json
{
  "status": "success",
  "message": "Registrazione completata. Puoi effettuare il login.",
  "data": {
    "utente": {
      "id": 1, "nome": "Mario", "cognome": "Rossi",
      "eta": 18, "email": "mario@email.it",
      "ruolo": "studente", "classe": "Quarta",
      "email_verificata": false
    }
  }
}
```

| Codice | Causa |
|---|---|
| 201 | Registrazione riuscita |
| 409 | Email già registrata |
| 422 | Dati non validi (password debole, classe non valida, ecc.) |

---

### `POST /api/auth/login`

**Rate limit:** 5 tentativi ogni 15 minuti per IP (solo fallimenti).

**Request:**
```json
{ "email": "mario@email.it", "password": "Password123!" }
```

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "utente": { "id": 1, "nome": "Mario", ... }
  }
}
```

| Codice | Causa |
|---|---|
| 200 | Login riuscito |
| 401 | Credenziali non valide |
| 429 | Troppi tentativi |

---

### `POST /api/auth/logout`

**Auth:** `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{ "status": "success", "message": "Logout effettuato con successo." }
```

Invalida il refresh token nel DB: anche se il refresh token non è ancora scaduto, non potrà più essere usato.

---

### `GET /api/auth/me`

**Auth:** `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "utente": {
      "id": 1, "nome": "Mario", "cognome": "Rossi",
      "eta": 18, "email": "mario@email.it",
      "ruolo": "studente", "classe": "Quarta"
    }
  }
}
```

---

### `POST /api/auth/refresh-token`

Ottieni un nuovo access token usando il refresh token (senza dover rifare il login).

**Request:**
```json
{ "refreshToken": "eyJhbGc..." }
```

**Response 200:**
```json
{ "status": "success", "data": { "accessToken": "eyJhbGc..." } }
```

| Codice | Causa |
|---|---|
| 200 | Nuovo access token emesso |
| 401 | Refresh token non valido, scaduto, o invalidato (logout) |

---

### `POST /api/auth/forgot-password`

**Rate limit:** 3 richieste per ora per IP.

**Request:**
```json
{ "email": "mario@email.it" }
```

**Response 200** (sempre, anche se l'email non esiste):
```json
{
  "status": "success",
  "message": "Se l'email è registrata, riceverai le istruzioni per il reset della password."
}
```

In sviluppo, la response include `_debug_token` con il token (rimuovere in produzione). In produzione va integrato un servizio email (SendGrid, Nodemailer...).

---

### `POST /api/auth/reset-password`

**Request:**
```json
{
  "token": "a3f4b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3",
  "nuovaPassword": "NuovaPassword456!"
}
```

**Response 200:**
```json
{ "status": "success", "message": "Password aggiornata con successo." }
```

| Codice | Causa |
|---|---|
| 200 | Password aggiornata |
| 400 | Token non valido o scaduto |
| 422 | Nuova password non rispetta i requisiti |

---

### `PATCH /api/auth/change-email`

**Auth:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{ "nuovaEmail": "nuova@email.it" }
```

**Response 200:**
```json
{
  "status": "success",
  "data": { "utente": { ... } }
}
```

---

## Sicurezza: Decisioni Chiave

### Password
- Hash con **bcrypt** (salt factor 12, configurabile via `BCRYPT_ROUNDS`)
- Hook `beforeSave` nel modello → impossibile salvare password in chiaro per errore
- **Timing attack prevention**: il login fa sempre un compare, anche se l'email non esiste

### JWT
- **Access Token**: scadenza corta (15 min default) → limita la finestra di abuso se intercettato
- **Refresh Token**: scadenza lunga (7 giorni), salvato nel DB → può essere invalidato al logout
- Payload minimale: solo `id` e `ruolo` (no dati sensibili)

### Ruoli
- `ruolo` impostato **hardcoded a `studente`** nel service, mai letto dal body della request
- Solo un admin può modificare i ruoli (via `authorizeRoles('admin')` su un endpoint dedicato)

### Rate Limiting
- Login: 5 tentativi/15min per IP, con `skipSuccessfulRequests: true`
- Forgot password: 3/ora (previene enumerazione account + abuso email)
- Globale: 100 req/15min per tutto il resto

### SQL Injection
- Sequelize usa **prepared statements** nativamente → ogni parametro è automaticamente escaped

### Input
- `express-validator` su ogni endpoint pubblico
- Payload JSON limitato a **10KB** (previene payload bombing)
- Email normalizzata in minuscolo prima del salvataggio

---

## Variabili d'Ambiente

| Variabile | Descrizione | Default |
|---|---|---|
| `NODE_ENV` | `development` o `production` | `development` |
| `PORT` | Porta del server | `3000` |
| `DB_HOST` | Host MySQL | `localhost` |
| `DB_PORT` | Porta MySQL | `3306` |
| `DB_NAME` | Nome database | — |
| `DB_USER` | Utente MySQL | — |
| `DB_PASSWORD` | Password MySQL | — |
| `JWT_ACCESS_SECRET` | Segreto access token | — |
| `JWT_ACCESS_EXPIRES` | Durata access token | `15m` |
| `JWT_REFRESH_SECRET` | Segreto refresh token | — |
| `JWT_REFRESH_EXPIRES` | Durata refresh token | `7d` |
| `BCRYPT_ROUNDS` | Salt rounds bcrypt | `12` |
| `RATE_LIMIT_WINDOW_MS` | Finestra rate limit globale | `900000` |
| `RATE_LIMIT_MAX` | Max req nella finestra | `100` |
| `LOGIN_RATE_LIMIT_MAX` | Max tentativi login | `5` |
| `CORS_ORIGIN` | Origine CORS consentita | `http://localhost:5173` |
| `RESET_PASSWORD_EXPIRES_HOURS` | Durata token reset | `1` |
| `LOG_LEVEL` | Livello log Winston | `info` |

---

## Estensioni Future

- **Email verification**: token univoco inviato all'email al momento della registrazione
- **Email service**: integra Nodemailer + SMTP o SendGrid per forgot-password e verify
- **Refresh token rotation**: ogni refresh genera un nuovo refresh token (e invalida il precedente)
- **Admin endpoints**: `PATCH /api/users/:id/ruolo` protetto da `authorizeRoles('admin')`
- **2FA**: TOTP con librerie come `otplib`
- **Test**: Jest + Supertest per test unitari e di integrazione
