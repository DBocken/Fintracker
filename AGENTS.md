# AGENTS.md — Fintracker

Kanonische Regelquelle für **alle** KI-Agenten (Claude, Codex, Copilot, …), die an
diesem Repository arbeiten. Diese Datei ist in sich vollständig; Details stehen
verweisend in `docs/`. Bei Widerspruch zu älteren/tool-spezifischen Dateien
(`CLAUDE.md`, `AI_RULES.md`) gilt **diese Datei**.

## 1. Was ist Fintracker

Fintracker ist eine **local-first** Finanz-App. **IndexedDB ist der primäre
Speicher** (optional AES-GCM-verschlüsselt) — Finanzdaten bleiben standardmäßig
auf dem Gerät. **Supabase ist NUR für Auth und explizite Opt-in-Features**
(Cloud-Sync, Markt-Daten) im Einsatz, nicht als primärer Datenspeicher. Das
korrigiert das veraltete Cloud-first-Framing älterer Dokumente (`AI_RULES.md`).
Stack: React 18 + TypeScript (`strict`), Vite, Tailwind CSS, Capacitor für
Android. Details: `docs/coding-guide.md` §1, `docs/security-boundaries.md`.

## 2. Setup & Kommandos

**Nur `pnpm`** (Version 10.12.4 / Node 22, wie in CI) — **npm/yarn nicht
verwenden**.

| Befehl | Zweck |
|---|---|
| `pnpm dev` | Dev-Server (Vite) |
| `pnpm build` | Typecheck (`tsc`) + Produktions-Build |
| `pnpm preview` | Build lokal previewen |
| `pnpm lint` | ESLint — keine Warnungen erlaubt |
| `pnpm test` | Alle Vitest-Suiten |
| `pnpm test:watch` | Vitest im Watch-Modus |
| `pnpm test:coverage` | Tests + Coverage (Schwellen in `vitest.config.ts` sind Pflicht) |
| `pnpm test:security` | Security-Wächter-Tests (`[SECURITY]`) |
| `pnpm test:integrity` | Integritäts-Tests (`[INTEGRITY]`) |
| `pnpm test:privacy` | Privacy-Tests (`[PRIVACY]`) |
| `pnpm test:mobile` | Mobile-spezifische Tests (`[MOBILE]`) |
| `pnpm check:i18n` | Prüft i18n-Compliance (keine hardcodierten UI-Strings im Diff, Key-Symmetrie ALLER `SUPPORTED_LOCALES` gegen `de` per Klammer-Ebenen-Heuristik) — läuft in Pre-Commit und CI |
| `pnpm check:test-structure` | Prüft Testdatei-Platzierung (`__tests__/`, Ausnahme `src/security/*.security.test.ts`) — läuft in Pre-Commit und CI |
| `pnpm security:secrets` | Secret-Scan (`scripts/security-check.mjs`) |

## 3. Architektur

Zwei komplementäre Schichtungen, siehe `docs/coding-guide.md` §2 im Detail:

- **Klassische Schichten:** `src/lib/` (pure Domänen-/Berechnungslogik, kein
  React, kein I/O) → `src/services/` (I/O: Storage, Supabase, externe APIs,
  kapselt `lib`) → `src/hooks/` (React-Anbindung) → `src/components/` (UI,
  keine Domänentypen/Geschäftslogik) → `src/pages/` (dünne Routen-Einstiege).
- **Feature-Slices:** `src/features/<name>/{domain,data,application,presentation}`
  für in sich geschlossene Features mit Desktop-/Mobile-Präsentation
  (Referenz: `src/features/dashboard/`). Fachlogik, die von **≥ 2 Slices**
  gebraucht wird, wandert nach `src/features/shared/`. Verbindliches
  Kochrezept inkl. Entscheidungsbaum „gemeinsame Komponente vs. getrennte
  Views": `docs/architecture/feature-structure.md`.

## 4. Plattform-Prinzip (verbindlich)

> Mobile = einfaches, sauberes Modell (eine Hauptaussage pro Ansicht,
> progressive Offenlegung, Bottom Sheets). Desktop = dieselben Features, nutzt
> den großen Bildschirm (mehr Information gleichzeitig, Tabellen, Vergleiche).
> JEDES Feature muss in beiden Varianten existieren (Feature-Parität). Gleiche
> Daten, gleiche Berechnungen, gleiches ViewModel — progressive Verzweigung,
> keine doppelten Queries.

## 5. TDD & Teststruktur

Ablauf: **Ziel verstehen → Test schreiben (rot) → minimale Implementierung
(grün) → refactor**. Behobene Bugs bekommen **immer** einen `[REGRESSION]`-Test.

- Tests **nur** in `__tests__/`-Ordnern neben dem Code — einzige Ausnahme:
  `src/security/*.security.test.ts`. Blockierend geprüft durch
  `.claude/hooks/test-structure-check.mjs` (Claude Code) bzw.
  `pnpm check:test-structure` (alle Agenten, Pre-Commit + CI).
- Testtitel deutsch, beschreibend: `it('sollte …')`. Keine `describe('tests')`
  / `it('test 1')`.
- Render-/Hook-Helfer **nur zentral** aus `@/test-utils/render`
  (`renderWithI18n`, `renderWithProviders`, `createHookWrapper`) — keine
  lokalen Kopien pro Datei.
- Tags für besondere Kategorien: `[REGRESSION]` (behobener Bug),
  `[SECURITY]`, `[INTEGRITY]`, `[PRIVACY]`, `[MOBILE]`.

```typescript
// ✅ GUT:
describe('CategoryTwoStepSelect', () => {
  it('sollte Unterkategorien anzeigen wenn Hauptkategorie Kinder hat', () => {})
  it('[REGRESSION] sollte parent_id Migration funktionieren', () => {})
})

// ❌ SCHLECHT:
describe('tests', () => {
  it('test 1', () => {})
})
```

## 6. i18n (verbindlich)

**Kein hardcodierter UI-Text.** Jeder sichtbare String läuft über i18n und
muss in **allen** `SUPPORTED_LOCALES` (aktuell `de`, `en`, `tlh`,
`src/i18n/translations.ts`) vorhanden sein. In Komponenten `useI18n()`
(`t('namespace.key')`), in `src/services/`/`src/lib/`-Modulen (kein React-
Kontext) `serviceT` aus `src/i18n/serviceT.ts`. Komponententests prüfen
**bilingual** (mind. de + en) über `@/test-utils/render`. Durchsetzung
agentenunabhängig via `pnpm check:i18n` (Pre-Commit + CI). Vollständiger
Workflow inkl. Test-Template, dynamische Strings, neue Sprachen hinzufügen:
`.claude/i18n-workflow.md` + `.claude/templates/i18n-*.template.tsx`.

```typescript
// ❌ NICHT ERLAUBT:            // ✅ ERFORDERLICH:
<h1>Meine Überschrift</h1>      const { t } = useI18n();
                                 <h1>{t('myFeature.title')}</h1>
```

## 7. Tech-Stack-Regeln

- **UI:** ausschließlich shadcn/`@/components/ui`; Styling ausschließlich
  Tailwind-Utility-Klassen (kein Custom-CSS, kein inline `style` außer für
  dynamische Werte).
- **Server-/Async-State:** ausschließlich TanStack Query
  (`useQuery`/`useMutation`). **Kein** Redux/Zustand oder anderer globaler
  State-Manager.
- **I/O-Regel:** Jeglicher Zugriff auf IndexedDB, Supabase oder externe APIs
  läuft ausschließlich über `src/services/`. Komponenten rufen niemals
  direkt einen Client auf, sondern nutzen Service-Funktionen via TanStack
  Query.
- **Charts:** Recharts, immer in `ResponsiveContainer`.
- **Animationen:** Framer Motion / CSS / `requestAnimationFrame` — Baseline
  ist datengetriebener Aufbau (siehe §9).
- **Icons:** ausschließlich `lucide-react`.
- **CSV:** Papaparse.
- **3D:** three.js — ausschließlich in src/features/finance-city/ (WebGL-Stadt); nirgendwo sonst importieren.

## 8. Geld & Domäne

Beträge intern **immer Integer-Cent** über `src/lib/money.ts`
(`toMinor`/`sumMinor`); nie roher Float-Vergleich, nie `toFixed` für
Berechnungen, nie roher `parseFloat`-Ersatz für Geldeingaben (nur
`parseGermanNumber`/`parseEuroInput`). Aggregation (Einnahmen/Ausgaben/Saldo)
**nur** über `@/lib/analysis-data` (`sumIncome`/`sumExpenses`) — keine
komponenten-lokalen `reduce`-Ketten über Beträge. Datengrenzen (IndexedDB,
Backup, Vault, Import, Netz) werden mit **zod** validiert. Details und die
fachlichen Invarianten: `docs/coding-guide.md`, `docs/domain-invariants.md`.

## 9. Design-Grundregeln

- **Karten sind Aktionen:** Fläche mit Karten-Chrome (Rahmen + Hintergrund +
  Schatten) muss als Ganzes klickbar sein (navigieren, Popup/Sheet/Dialog
  öffnen, auf-/zuklappen). Kein toter Karten-Rahmen um nur einen
  verschachtelten Button. Bausteine: klickbar → `@/components/common/
  InteractiveCard`; reines Readout ohne Follow-up → `@/components/common/
  InfoGroup`/`InfoStatStrip` (kein Rahmen/Schatten).
- **Animations-Baseline:** eigene, datengetriebene Implementierung (SVG /
  Framer Motion / CSS / `requestAnimationFrame` / Recharts) — Lottie ist
  **nicht** Baseline. Visualisierte Daten poppen nicht auf, sie werden
  *aufgebaut* (hochzählen, füllen, wachsen, zeichnen); Farb-/Statuswechsel
  sind schwellwertbewusst. Kein `isAnimationActive={false}` ohne kurze
  Begründung. `prefers-reduced-motion` überall respektieren.
- Vollständige Prinzipien (7 Kernprinzipien + Karten- und Animationsregel im
  Detail): `docs/design-principles.md`.

## 10. Security & Privacy

Verbindliche Regeln je Schwachstellenklasse (Details + ❌/✅-Beispiele in
`docs/security-guidelines.md`), jede mit Wächter-Test in `src/security/`:

1. **child_process:** nie `execSync`/String-Interpolation — immer
   `execFileSync('cmd', [args, '--', file])`.
2. **HTTP-Header:** Web-App über `vercel.json`/`netlify.toml`; neue
   Express-Server → `helmet` zuerst; Serverless-JSON → `nosniff` + `no-store`.
3. **Secrets:** echte Secrets nur `process.env` ohne Fallback; `.env` nie
   committen.
4. **GitHub Actions:** `uses:` nur mit 40-Hex-SHA + Versions-Kommentar;
   `permissions: contents: read` top-level in jeder Workflow-Datei.
5. **Redirects:** externe URLs vor `window.location.href`/`window.open`
   immer durch `isSafeExternalAuthUrl` (`@/lib/safe-url`) prüfen.
6. **Android:** `allowBackup="false"`, keine Klartext-Netzwerkkonfiguration,
   keine neuen exportierten Komponenten ohne Begründung + Test.

Änderungen in diesen Klassen nur mit `[SECURITY]`/`[REGRESSION]`-Test im
selben Commit. Vor jedem Push: `pnpm test:security` und
`pnpm security:secrets` müssen grün sein.

## 11. Commits & PRs

Logische Commits mit den zugehörigen Tests, nicht 100-Zeilen-Sammelcommits.
Commit-Message nennt **Ziel + Test-Abdeckung** (nicht nur „was"). PR-Workflow:
Branch anlegen → Tests schreiben (rot) → implementieren (grün) → pushen → CI
abwarten → Review-Kommentare bearbeiten.

## 12. Automatische Durchsetzung

Pre-Commit (`.githooks/pre-commit`) und CI erzwingen i18n
(`pnpm check:i18n`) und Teststruktur (`pnpm check:test-structure`). Claude
Code erhält zusätzlich Live-Hinweise über `.claude/hooks/` (blockierend:
test-structure; advisory: Animations-Baseline, Karten-Klickbarkeit). Andere
Agenten prüfen diese Punkte im Selbst-Review.
