# Security Headers (Beispiel-Konfiguration)

Diese App ist **Hybrid-Local**: Finanzdaten liegen (überwiegend) lokal im Browser/Device. Damit sind **Client-Schutz** und **XSS-Mitigations** besonders wichtig.

> Hinweis: Passe Werte (Domains/Hashes/Nonces) an deine Deployment-Umgebung an. Starte idealerweise mit **CSP Report-Only** und schalte danach auf **Enforce** um.

## Empfohlene Header

### 1) Content-Security-Policy (CSP)

**Empfehlung (Startpunkt, ohne externe Skripte):**

```
Content-Security-Policy: default-src 'self'; \
  base-uri 'none'; \
  object-src 'none'; \
  frame-ancestors 'none'; \
  img-src 'self' data: blob:; \
  font-src 'self' data:; \
  style-src 'self' 'unsafe-inline'; \
  script-src 'self'; \
  connect-src 'self' https://pbopyawkxxrluhofjtub.supabase.co;
```

**Report-Only zum Testen:**

```
Content-Security-Policy-Report-Only: ...
```

> Für eine **striktere** CSP mit `nonce-...`/`sha256-...` brauchst du serverseitige HTML-Generierung bzw. eine Build/Runtime-Integration.

### 2) HSTS

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 3) Clickjacking / Framing

```
X-Frame-Options: DENY
```

(Alternativ/zusätzlich per CSP `frame-ancestors 'none'`.)

### 4) MIME Sniffing

```
X-Content-Type-Options: nosniff
```

### 5) Referrer Policy

```
Referrer-Policy: no-referrer
```

### 6) Permissions Policy (optional)

Je nach Feature-Set:

```
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Vercel Beispiel (`vercel.json`)

Siehe `vercel.json` im Repo.

## Netlify Beispiel (`netlify.toml`)

Siehe `netlify.toml` im Repo.
