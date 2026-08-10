# Security Headers

Diese App ist **Hybrid-Local**: Finanzdaten liegen (überwiegend) lokal im Browser/Device. Damit sind **Client-Schutz** und **XSS-Mitigations** besonders wichtig.

Die verbindliche Wahrheit sind `vercel.json` und `netlify.toml` im Repo — dieses
Dokument erklärt sie und hält die **entschiedenen Punkte** fest (unterster
Abschnitt). Die Beispielblöcke unten sind der Ausgangspunkt, nicht der Stand.

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

---

## Entschiedene Punkte

Nachgetragen am **2026-08-09** (Qualitätsprogramm 10/10, WP 7.6; Befunde SEC-6
und GOV-6 in `docs/qualitaet-2026-08/audit.md`). Beide Punkte sind
**Entscheidungen, keine offenen Aufgaben** — sie stehen hier, damit sie in
keinem weiteren Audit erneut als Befund aufschlagen.

### `style-src 'unsafe-inline'` bleibt (SEC-6)

**Stand:** `vercel.json` und `netlify.toml` liefern beide
`style-src 'self' 'unsafe-inline'`. Alles andere ist eng: `default-src 'self'`,
`script-src 'self'` (**ohne** `unsafe-inline`/`unsafe-eval`), `object-src`,
`base-uri` und `frame-ancestors` auf `'none'`, `connect-src` nur `'self'` plus
die eine Supabase-Projekt-URL.

**Entscheidung:** `'unsafe-inline'` bleibt für **Stile** erlaubt.

**Begründung.** Die App gibt dynamische Werte über Inline-Stile aus — das ist
kein Schönheitsfehler, sondern von `AGENTS.md` §7 ausdrücklich vorgesehen
(„kein inline `style` **außer für dynamische Werte**"): Kontofarben,
Kategoriefarben, Balkenbreiten, Recharts-Geometrie, Framer-Motion-Transforms.
Ohne `'unsafe-inline'` bräuchte jeder dieser Werte einen Nonce oder Hash, und
zwar zur Laufzeit — ein Hash über einen Wert, der sich mit den Daten ändert, ist
nicht vorab berechenbar. Nonces wiederum brauchen serverseitig generiertes HTML;
Fintracker liefert eine statische SPA aus (`index.html` aus dem Vite-Build,
Rewrite auf `/index.html`). Der Umbau hieße also: Server-Rendering einführen,
um eine Klasse zu schließen, die hier wenig trägt.

**Was das kostet, ehrlich benannt.** `'unsafe-inline'` bei `style-src` erlaubt
einem Angreifer, der bereits HTML einschleusen kann, CSS-basierte Angriffe
(Overlays/Clickjacking innerhalb der Seite, Exfiltration über Selektoren mit
`background-image`-URLs). Was es **nicht** erlaubt: Code-Ausführung — dafür
bleibt `script-src 'self'` zuständig, und das Ziel jeder
CSS-Exfiltration müsste zusätzlich durch `connect-src`/`img-src` passen
(`img-src 'self' data: blob:` lässt keine fremde Domain zu).

**Nicht entschieden, sondern offen:** `script-src` bleibt ohne
`'unsafe-inline'` — wer dort eine Ausnahme braucht, hat einen Befund, keine
Konfigurationsfrage.

### Pre-Commit ist umgehbar — CI ist der Zaun (GOV-6)

**Stand:** `.githooks/pre-commit` steigt still mit Exit 0 aus, wenn `pnpm` nicht
im PATH liegt (GUI-Git-Clients starten ohne den PATH einer interaktiven Shell),
und `git commit --no-verify` überspringt ihn ohnehin vollständig.

**Entscheidung:** Das bleibt so. Der lokale Hook ist **Komfort** — schnelle
Rückmeldung in ~10 s, bevor ein Push CI-Zeit kostet. **Verbindlich ist CI**:
`.github/workflows/ci.yml` fährt dieselbe Batterie plus das, was lokal nicht
läuft (`check:bundle-size` braucht einen Build, `typecheck:api`,
`typecheck:mcp-poc`, die volle Suite mit Coverage-Schwellen). Ein Commit, der
den Hook umgeht, kommt am Zaun trotzdem nicht vorbei.

**Verworfen:** den Ausstieg hart machen (`exit 1` ohne `pnpm`). Er würde jeden
Commit aus einem GUI-Client blockieren, ohne die Sicherheit zu erhöhen —
`--no-verify` bleibt ja daneben bestehen. Ebenso verworfen: Telemetrie über
lokale Hook-Ausführungen; sie würde messen, wer wie committet, und nicht, ob
der Code die Regeln hält.

**Konsequenz für die Arbeitsweise:** Grün *lokal* ist kein Nachweis. Der
Nachweis ist der grüne CI-Lauf am PR (`AGENTS.md` §11/§12). Strategie und Preis
des Wächter-Systems: `docs/architecture/guard-system.md` (dort Abschnitt
„Preis", Punkt 6).

### Offen (kein Entscheid, bewusst benannt)

- **Kein Wächter prüft diese Header.** `src/security/` hat einen Test für die
  MCP-Endpunkt-Header (`mcp-headers.security.test.ts`), aber keinen für
  `vercel.json`/`netlify.toml`. Eine gelockerte CSP fiele heute niemandem auf.
- **Zwei Deployment-Konfigurationen driften.** `vercel.json` erlaubt
  `worker-src 'self' blob:` (pdfjs/Tesseract-Worker der Beleg-Erkennung),
  `netlify.toml` nicht — dort fällt `worker-src` auf `default-src 'self'`
  zurück und die Worker wären blockiert. Derselbe Punkt steht seit dem Audit
  vom 2026-07-02 offen (`docs/archive/umsetzungsleitfaden-2026-07-02.md`,
  VE-7: „Vercel produktiv, Netlify entfernen") und ist nie ausgeführt worden.
  Solange beide Dateien im Repo liegen, muss jede Header-Änderung in **beiden**
  landen.
