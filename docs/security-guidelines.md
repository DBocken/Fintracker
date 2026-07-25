# Sicherheitsrichtlinien für Code-Änderungen

Stand: 11.07.2026 · Ergänzt `docs/security-boundaries.md` (Trust-Boundaries) um
verbindliche Secure-Coding-Regeln je Schwachstellen-Klasse. Jede Klasse hat einen
Wächter-Test, der Verstöße in CI rot macht — Änderungen an diesen Regeln nur
zusammen mit dem zugehörigen Test.

## 1. Kommandoausführung (child_process)

**Regel:** Nie Variablen in einen Shell-String interpolieren. Immer
`execFileSync` mit Argument-Array und `--`-Trenner vor Dateinamen; nie
`execSync`, nie `shell: true`. `import.meta.url` nur über `fileURLToPath`
in Pfade umwandeln.

```js
// ❌ Command Injection: Dateiname läuft durch die Shell
execSync(`git diff --cached -U0 "${file}"`)

// ✅ Argument-Array: weder Shell- noch git-Option-Injection möglich
execFileSync('git', ['diff', '--cached', '-U0', '--', file])
```

Wächter-Test: `src/security/hooks-command-injection.security.test.ts`

## 2. HTTP-Security-Header

**Regel:** Quelle der Wahrheit für die Web-App sind `vercel.json` /
`netlify.toml` (der globale `/(.*)`-Block gilt auch für `/api/*`). Jeder neue
Express-Server bekommt `helmet` als **erste** Middleware (JSON-only-APIs mit
strikter CSP `default-src 'none'`). Serverless-Functions setzen mindestens
`X-Content-Type-Options: nosniff` und `Cache-Control: no-store` auf
Finanzdaten-Antworten.

```ts
// ✅ Express: helmet vor allen Routen
const app = express();
app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] } } }));
```

Wächter-Test: `src/security/mcp-headers.security.test.ts`

## 3. Secrets & Keys

**Regel:** Echte Secrets (Service-Role-Keys, API-Secrets, Tokens) ausschließlich
über `process.env` **ohne** Fallback-Wert (`requireEnv`-Muster in
`mcp-poc/src/index.ts`). Der Supabase-Anon-Key ist public-by-design (RLS schützt
serverseitig), wird aber env-first gelesen (`VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`), damit er rotierbar bleibt. `.env` nie committen,
`.env.example` pflegen.

```ts
// ❌ Fallback macht ein echtes Secret zum Repo-Inhalt
const KEY = process.env.SERVICE_KEY ?? 'eyJ...';

// ✅ Fail-fast ohne Fallback
const KEY = requireEnv('SERVICE_KEY');
```

Scanner-Hinweis: `scripts/security-check.mjs` flaggt jede Datei, die ein JWT
**und** den String `service_role` enthält — in Kommentaren neben eingebetteten
Anon-Keys „Service-Role-Key“ schreiben.

Wächter-Test: `src/security/supabase-env.security.test.ts` · Scanner: `pnpm security:secrets`

## 4. GitHub Actions (Supply Chain)

**Regel:** Third-Party-Actions nur mit vollem 40-Hex-Commit-SHA pinnen und
`# vX.Y.Z`-Kommentar dahinter. Achtung bei annotated Tags (z. B.
pnpm/action-setup): den dereferenzierten Commit (`git ls-remote … 'v4^{}'`)
pinnen, nie den Tag-Objekt-SHA. Jede Workflow-Datei deklariert top-level
`permissions: contents: read` (mehr nur mit Begründung).

```yaml
# ❌ Tag ist verschiebbar
- uses: actions/checkout@v4
# ✅ SHA-Pinning mit Versions-Kommentar
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
```

Wächter-Test: `src/security/workflow-pinning.security.test.ts`

## 5. Externe Redirects

**Regel:** URLs aus API-Antworten sind nicht vertrauenswürdig
(`docs/security-boundaries.md`). Vor `window.location.href = …` oder
`window.open(…)` immer `isSafeExternalAuthUrl` aus `@/lib/safe-url` (https-only,
keine eingebetteten Credentials, Host-Allowlist bzw. `allowedOrigins` für eigene
App-Origins). `window.open` immer mit `noopener`.

```ts
// ❌ ungeprüfte API-URL → javascript:-Schema/fremder Host möglich
window.location.href = requisition.link;

// ✅ validiert, mit i18n-Fehlermeldung im Ablehnungsfall
if (!isSafeExternalAuthUrl(link, { allowedOrigins: [window.location.origin] })) { showError(t('…')); return; }
window.location.href = link;
```

Wächter-Test: `src/lib/__tests__/safe-url.test.ts`

## 6. Android-Manifest & Netzwerk

**Regel:** `android:allowBackup="false"` (Finanzdaten gehören nicht ins
Auto-Backup; Gerätewechsel über den app-eigenen verschlüsselten Export),
`android:networkSecurityConfig` mit `cleartextTrafficPermitted="false"`
(minSdk 24 erlaubt Klartext sonst bis API 27). Keine neuen
`android:exported="true"`-Komponenten ohne Begründung + Testanpassung.
FileProvider bleibt nicht-exportiert; bei Aufnahme von
Camera/Share/Filesystem-Plugins die Pfade in `file_paths.xml` auf das benötigte
Unterverzeichnis eingrenzen.

Wächter-Test: `src/security/android-hardening.security.test.ts`

## 7. Abhängigkeits-Patchstände (Supply Chain)

**Regel:** `pnpm-lock.yaml` enthält keine Version mit bekanntem Advisory. CI
prüft das mit OSV-Scanner (`.github/workflows/security-audit.yml`); lokal zeigt
`pnpm audit` dieselben GHSA-Daten.

- **Direkte Abhängigkeit betroffen** ⇒ Version in `package.json` anheben.
- **Transitive Abhängigkeit betroffen** ⇒ Floor in `pnpm.overrides`. Das Ziel
  wird **immer nach oben begrenzt** (`">=1.1.16 <2"`, nicht `">=1.1.16"`): ein
  offener Range zieht die nächste Major-Linie herein und tauscht damit
  stillschweigend die API — bei `brace-expansion` landete so die ESM-Variante
  5.x unter `minimatch@3`, das `require('brace-expansion')()` aufruft.
- **Kein kompatibler Patch verfügbar** (Fix nur in einer Major-Version, oder die
  betroffene Linie bekommt keinen Backport) ⇒ Eintrag in `osv-scanner.toml` mit
  `reason` **und** `ignoreUntil`. Ohne Ablaufdatum wird aus einer Ausnahme ein
  Dauerzustand; nach Ablauf schlägt CI wieder an und erzwingt eine neue
  Bewertung. Der Eintrag nennt, warum der Fund hier nicht ausnutzbar ist und
  welcher Vorgang ihn auflöst.

`minimumReleaseAge: 1440` (`pnpm-workspace.yaml`) hält Pakete 24 h zurück —
Patch-Floors dürfen deshalb nicht auf eine Version zeigen, die jünger ist als
einen Tag, sonst bleibt die Auflösung darunter hängen.

Wächter-Test: `src/security/dependency-patch-floors.security.test.ts`

## 8. Testpflicht

Änderungen in einer dieser Klassen landen nur mit passendem `[SECURITY]`- bzw.
`[REGRESSION]`-Test **im selben Commit** im Repo. Neue Wächter-Tests gehören
nach `src/security/` (laufen automatisch in `pnpm test` und via
`pnpm test:security` in CI); Unit-Tests für Security-Utilities neben den Code
(`__tests__/`). Behobene Schwachstellen bekommen immer einen
`[REGRESSION]`-Test, der den Rückfall rot macht.
