# Guida ai domini personalizzati (DNS + VPS + TLS)

Questa guida spiega **come funziona** il riconoscimento della scuola dal dominio
e **cosa devi configurare** sulla VPS perché una scuola sia raggiungibile dal suo
dominio (o sottodominio). Il codice dell'applicazione è **già pronto**: il lavoro
mancante è tutto di *infrastruttura* (DNS, reverse proxy, certificati).

---

## 1. Come l'app riconosce la scuola dal dominio

Ad ogni richiesta **non autenticata** (pagina pubblica, login, `/api/config`)
l'app risolve il tenant con questa precedenza:

1. **Dominio personalizzato** — l'host della richiesta corrisponde a un record
   `domini_scuola` **verificato** → quella è la scuola. È autoritativo.
2. **Override esplicito** — sul dominio globale condiviso: `?scuola=<slug>` o
   header `X-Scuola`.
3. **Scuola predefinita** — deploy mono-scuola o fallback.

Punti chiave del comportamento (già implementati):

- Un dominio risolve la scuola **solo se `verificato = true`** (fail-closed: nessuno
  può dirottare traffico registrando un host che non controlla). I domini creati
  **dall'admin** nascono già verificati; quelli aggiunti dallo staff restano in
  attesa finché un admin non li verifica.
- L'app si fida del reverse proxy (`app.set('trust proxy', 1)`): usa
  `req.hostname`, che rispetta l'header `X-Forwarded-Host`. **Il proxy deve
  inoltrare l'host originale.**
- Il **CORS** autorizza automaticamente le origini il cui host è un dominio scuola
  verificato: non devi aggiungere ogni dominio a mano in `CORS_ORIGIN`.

> Conseguenza pratica: una volta che DNS + proxy + TLS puntano correttamente e il
> dominio è verificato nel pannello, **non serve toccare il codice**.

---

## 2. Due topologie possibili

### Topologia A — Sottodomini della TUA piattaforma
`liceo-manzoni.tuodominio.it`, `accademia-rossi.tuodominio.it`, …

Il DNS lo controlli **tu**. È la via più semplice: un solo record **wildcard** e
un solo certificato **wildcard** coprono tutte le scuole presenti e future.

### Topologia B — Domini di proprietà della scuola
`liceomanzoni.it`, `www.liceomanzoni.it`

Il DNS lo controlla **la scuola**, che lo fa puntare alla tua VPS. Serve un
certificato **per ciascun dominio**: qui conviene il **TLS on-demand** (Caddy),
che emette il certificato automaticamente al primo accesso.

Le due topologie possono coesistere.

---

## 3. Prerequisiti sulla VPS

- Un IP pubblico **statico** (IPv4; consigliato anche IPv6).
- Le porte **80** e **443** aperte sul firewall.
- Il backend Node in ascolto su una porta interna (es. `http://127.0.0.1:4000`).
- Il frontend React **buildato** (`vite build` → `dist/`) servito come file statici.
- Un reverse proxy davanti a tutto: **Nginx** (classico) **oppure Caddy**
  (consigliato per la Topologia B per via del TLS automatico).

Topologia consigliata per i cookie: **ogni dominio serve sia la SPA sia `/api`**
tramite lo stesso host (il proxy manda `/api/*` al backend e tutto il resto alla
SPA). Così i cookie di sessione sono *first-party* e basta `COOKIE_SAMESITE=lax`.
Se invece l'API sta su un dominio diverso dal frontend, servono
`COOKIE_SAMESITE=none` + HTTPS ovunque.

---

## 4. Configurazione DNS

### Topologia A (sottodomini tuoi)
Sul DNS del **tuo** dominio (`tuodominio.it`):

```
; record wildcard: tutti i sottodomini puntano alla VPS
*.tuodominio.it.   A     203.0.113.10        ; IP della VPS
*.tuodominio.it.   AAAA  2001:db8::10        ; (se hai IPv6)
```

Con il wildcard, `qualsiasi-scuola.tuodominio.it` arriva alla VPS senza aggiungere
record nuovi per ogni scuola.

### Topologia B (dominio della scuola)
Istruzioni **da dare alla scuola**, sul DNS di `liceomanzoni.it`:

```
; dominio "nudo" (apex) → IP della VPS
liceomanzoni.it.       A      203.0.113.10
; www → apex (o direttamente A record)
www.liceomanzoni.it.   CNAME  liceomanzoni.it.
```

Note importanti:
- L'**apex** (`liceomanzoni.it` senza `www`) non può essere un CNAME per gli
  standard DNS: usa un **A record** (alcuni provider offrono ALIAS/ANAME per fare
  puntare l'apex a un hostname — vanno bene lo stesso).
- Abbassa il **TTL** (es. 300s) prima del cambio, così la propagazione è rapida.
- Verifica la propagazione: `dig +short liceomanzoni.it` deve restituire il tuo IP.

---

## 5. Reverse proxy + TLS

### Opzione 1 — Nginx + Certbot (Let's Encrypt)

Adatta soprattutto alla **Topologia A** (con wildcard TLS via DNS-01) o a pochi
domini fissi. Esempio di server block per un dominio (SPA + proxy `/api`):

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name liceomanzoni.it www.liceomanzoni.it;

    ssl_certificate     /etc/letsencrypt/live/liceomanzoni.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/liceomanzoni.it/privkey.pem;

    # --- SPA (frontend buildato) ---
    root /var/www/istruzione/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # --- API (backend Node) ---
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;

        # OBBLIGATORIO: inoltra l'host originale, così l'app risolve il tenant.
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP         $remote_addr;

        # necessario per lo streaming video (Range) e gli upload grandi
        proxy_request_buffering off;
        client_max_body_size 1200m;   # >= UPLOAD_MAX_VIDEO_MB
    }
}

# redirect 80 → 443
server {
    listen 80;
    listen [::]:80;
    server_name liceomanzoni.it www.liceomanzoni.it;
    return 301 https://$host$request_uri;
}
```

Emissione certificato per un singolo dominio:
```bash
sudo certbot --nginx -d liceomanzoni.it -d www.liceomanzoni.it
```

Certificato **wildcard** (Topologia A, richiede DNS-01 sul tuo provider):
```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d '*.tuodominio.it' -d 'tuodominio.it'
```
> Il wildcard NON copre i domini *della scuola* (Topologia B): copre solo i
> sottodomini del **tuo** dominio.

Per la Topologia B con Nginx dovresti lanciare un `certbot` per ogni dominio
**dopo** che il DNS punta alla VPS. Gestire a mano N certificati è scomodo: per
questo, con i domini dei clienti, conviene Caddy.

### Opzione 2 — Caddy con TLS **on-demand** (consigliato per la Topologia B)

Caddy emette e rinnova i certificati **da solo**, anche per domini che non conosci
in anticipo: quando arriva la prima richiesta HTTPS per `liceomanzoni.it`, Caddy
chiede a Let's Encrypt il certificato al volo. Perfetto per «la scuola punta il
suo dominio e funziona».

Per sicurezza, il TLS on-demand va **limitato ai soli domini autorizzati**: Caddy
chiama un endpoint della piattaforma (`ask`) che risponde 200 solo se il dominio
è una scuola verificata **e attiva**. Questo endpoint **è incluso**:

```
GET /api/interno/dominio-consentito?domain=<host>
  → 200  se <host> è un dominio scuola verificato di una scuola ATTIVA
  → 403  altrimenti (dominio sconosciuto, non verificato, o scuola bloccata)
```

È pubblico (nessun cookie/JWT, lo chiama Caddy) e a bassa sensibilità: rivela solo
se un host è una scuola servita. Nota utile: una scuola **bloccata** non supera il
controllo, quindi Caddy non emette/rinnova certificati per i suoi domini.

`Caddyfile` di esempio:

```caddyfile
{
    on_demand_tls {
        ask http://127.0.0.1:4000/api/interno/dominio-consentito
    }
}

# Sottodomini tuoi (Topologia A): certificato normale
*.tuodominio.it, tuodominio.it {
    encode gzip
    handle /api/* {
        reverse_proxy 127.0.0.1:4000 {
            header_up Host {host}
            header_up X-Forwarded-Host {host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    handle {
        root * /var/www/istruzione/dist
        try_files {path} /index.html
        file_server
    }
}

# Domini dei clienti (Topologia B): TLS on-demand
https:// {
    tls {
        on_demand
    }
    encode gzip
    handle /api/* {
        reverse_proxy 127.0.0.1:4000 {
            header_up Host {host}
            header_up X-Forwarded-Host {host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    handle {
        root * /var/www/istruzione/dist
        try_files {path} /index.html
        file_server
    }
}
```

Caddy imposta correttamente `Host`/`X-Forwarded-*` e gestisce il redirect
80→443 in automatico.

---

## 6. Flusso operativo end-to-end

**Topologia A (sottodominio tuo):**
1. Crea la scuola nel pannello admin indicando il dominio
   `liceo-manzoni.tuodominio.it` (nasce già verificato e principale).
2. Il wildcard DNS + wildcard TLS già coprono l'host: **fatto**.

**Topologia B (dominio della scuola):**
1. Crea la scuola nel pannello indicando `liceomanzoni.it` come dominio (creato
   dall'admin → già verificato). *In alternativa, aggiungilo dopo dal riquadro
   «Domini» in modifica scuola.*
2. Dai alla scuola le istruzioni DNS del §4 (A record apex + CNAME www → tua VPS).
3. Attendi la propagazione (`dig +short liceomanzoni.it` → tuo IP).
4. Reverse proxy + TLS: con Caddy on-demand è automatico; con Nginx lancia
   `certbot` per quel dominio.
5. Apri `https://liceomanzoni.it`: deve comparire la homepage/login della scuola.

Se l'hai aggiunto dallo staff (non admin), ricordati il passo di **verifica**:
un admin lo marca `verificato` solo dopo aver accertato che il DNS punta davvero
alla VPS (evita il dirottamento di host altrui).

---

## 7. Checklist e troubleshooting

| Sintomo | Causa probabile | Rimedio |
|---|---|---|
| Il dominio mostra la scuola sbagliata o quella predefinita | Host non inoltrato dal proxy | Aggiungi `proxy_set_header Host $host;` e `X-Forwarded-Host` (Nginx) / `header_up Host {host}` (Caddy) |
| Errore CORS dal dominio della scuola | Dominio non verificato | Verifica il dominio nel pannello (`verificato = true`) |
| «Origine non consentita da CORS» in locale | Origin diverso da `CORS_ORIGIN` | Aggiungi l'origine a `CORS_ORIGIN` o verifica il dominio |
| Login riesce ma la sessione «si perde» | Cookie cross-site bloccati | Servi SPA e `/api` sullo **stesso** host, oppure `COOKIE_SAMESITE=none` + HTTPS |
| TLS: «certificato non valido» al primo accesso | DNS non ancora propagato o `ask` che rifiuta | Attendi propagazione; controlla l'endpoint `ask` |
| Upload video falliscono con 413 | Limite del proxy o **quota storage** della scuola | Alza `client_max_body_size`; se è `QUOTA_STORAGE`, aumenta la quota della scuola |
| IP dietro Cloudflare: risolve sempre lo stesso tenant | Host mascherato dalla CDN | Usa modalità «DNS only» o assicurati che Cloudflare inoltri `Host` reale |
| Scuola bloccata: il dominio non serve più HTTPS | L'`ask` nega il rinnovo per le scuole sospese | Comportamento atteso: sbloccando la scuola il certificato torna a rinnovarsi |

---

## 8. In sintesi

- **Codice**: già pronto (risoluzione per host, CORS dinamico, trust proxy).
- **Topologia A** (sottodomini tuoi): wildcard DNS + wildcard TLS → zero lavoro per
  scuola.
- **Topologia B** (dominio della scuola): la scuola punta il DNS alla tua VPS; tu
  metti reverse proxy + TLS (Caddy on-demand è la via più comoda).
- **Regola d'oro del proxy**: inoltra sempre l'**Host** originale, o l'app non
  riesce a capire quale scuola servire.
