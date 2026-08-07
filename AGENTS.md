# AGENTS.md — Fintracker

Kanonische Regelquelle für **alle** KI-Agenten (Claude, Codex, Copilot, …), die an
diesem Repository arbeiten. Diese Datei ist in sich vollständig; Details stehen
verweisend in `docs/`. Bei Widerspruch zu älteren/tool-spezifischen Dateien
(`CLAUDE.md`, `AI_RULES.md`) gilt **diese Datei**.

## Arbeitsweise: Absicht vor Auftrag (verbindlich, übergreifend)

Diese Regel steht bewusst vor allen nummerierten Abschnitten und ohne eigene
Nummer: sie gilt für jeden von ihnen, und die bestehende Nummerierung §1–§12
ist aus Code-Kommentaren heraus referenziert.

Ein Auftrag wird **nicht wörtlich abgearbeitet**, sondern zuerst auf Ziel und
Absicht geprüft. Nichts wird ungeprüft übernommen — keine Bezeichnung, keine
Bibliothek, kein Lösungsweg, auch dann nicht, wenn der Auftrag sie vorgibt.
Anschließend wird die Methode gewählt, die das *Ziel* mit der höchsten
technischen Qualität erreicht, nicht die, die dem Wortlaut am nächsten kommt.

### Wann die Regel greift

| Greift | Greift nicht |
|---|---|
| Bezeichnungen in persistierten Daten, Typen, öffentlichen APIs, i18n-Keys, Dateipfaden | offensichtliche mechanische Arbeit, Tippfehler, Einzeiler mit genau einer sinnvollen Lösung |
| Wahl von Methode, Bibliothek, Architektur, Datenmodell | Anwenden einer hier bereits entschiedenen Regel |
| alles, was nach dem Merge nur noch mit Migration änderbar ist | reines Ausführen eines schon geprüften Plans |

Die Schwelle ist Absicht: Hinterfragen ohne Bleibewirkung ist Reibung, keine
Sorgfalt.

### Was geprüft wird

1. **Ziel dahinter.** Welches Problem soll gelöst werden? Löst der wörtliche
   Auftrag es tatsächlich?
2. **Bessere Methode.** Existiert ein Weg mit weniger Zustand, weniger
   Sonderfällen, besserer Testbarkeit?
3. **Bessere Bezeichnung.** Deckt sich der Name mit der Sprache der
   Oberfläche und der Fachdomäne? Etikettiert er, wo er beschreiben sollte?
4. **Ungenannte Konsequenzen.** Was folgt daraus, das der Auftrag nicht
   erwähnt — für Bestandsdaten, Bestandsnutzer, angrenzende Features, CI?
5. **Letzter günstiger Zeitpunkt.** Was ist jetzt eine Textersetzung und nach
   dem Merge eine Migration? Das wird *vor* dem Merge gesagt, nicht danach.
6. **Weiterdenken.** Gedankengänge, die der Auftraggeber nicht zu Ende geführt
   hat, werden fortgeführt und ihre Folgen benannt — auch ungefragt.

```markdown
❌ „Wird gemacht." → Auftrag wörtlich umgesetzt, Bezeichnung übernommen.
✅ „Der sichtbare Text sagt durchgehend X, der Code Y — das driftet.
    Ich empfehle X, weil […]. Jetzt eine Textersetzung, nach dem Merge
    eine Migration des persistierten Feldes."
```

### Wie das Ergebnis aussieht

- **Eine Empfehlung, keine Optionen-Parade.** Alternativen werden nur genannt,
  soweit sie die Entscheidung tragen, jeweils mit dem Grund für die Absage.
- **Einwand blockiert nicht.** Bedenken werden in ein bis zwei Sätzen benannt,
  danach wird geliefert — unter ausdrücklich genannter Annahme. Eine echte
  Rückfrage nur, wenn jede Annahme das Ergebnis unbrauchbar machen könnte.
- **Bestätigung beendet die Diskussion.** Bekräftigt der Auftraggeber seine
  Vorgabe nach dem Einwand, ist entschieden; das Thema wird nicht erneut
  aufgerollt.

Diese Regel ist **nicht** automatisiert erzwingbar (kein Hook, kein CI-Schritt
kann eine Absicht prüfen) — sie gehört zum Selbst-Review vor jedem Commit.

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
| `pnpm check:i18n` | Prüft, dass keine hardcodierten UI-Strings auftauchen. **Zwei Modi:** `--staged`/`--range` sehen den Diff, `--all` den ganzen Baum — der Diff-Modus kann Altbestand strukturell NIE sehen, und genau daran sind in Phase 9 zwei Verstöße vorbeigelaufen. Beide laufen in Pre-Commit und CI. Die **Key-Symmetrie** prüft dagegen `src/i18n/__tests__/locale-parity.test.ts` (vollständiger Blatt-Vergleich aller `SUPPORTED_LOCALES` gegen `de`, unabhängig vom Diff) |
| `pnpm check:i18n-module-consts` | Findet `t()`-Aufrufe im Initializer einer Modul-`const` — die frieren beim Import ein und ignorieren jeden späteren Sprachwechsel. Ganzbaumig über die TypeScript-AST, läuft in Pre-Commit und CI |
| `pnpm check:query-errors` | Verlangt, dass jeder `useQuery`-Aufruf den Fehlerfall in die Hand nimmt (`isError`/`error`/`status` destrukturieren oder `throwOnError`). Sonst macht der übliche Fallback `data = []` einen Ladefehler unsichtbar und der Screen behauptet „du hast noch nichts“. Die Ausnahmeliste `query-error-allowlist.json` führt die ANZAHL je Datei — sie darf nur sinken. Läuft in Pre-Commit und CI |
| `pnpm check:platform-parity` | Prüft den maschinell fassbaren Teil von §4: Eine Fläche mit `hidden <bp>:*` ohne Gegenstück (`<bp>:hidden`) fehlt auf schmalen Breiten ganz — das ist kein Dichte-Unterschied, sondern ein fehlendes Feature. Legitime Paare über Dateigrenzen stehen mit **Nennung des Partners** in `platform-parity-allowlist.json`. Läuft in Pre-Commit und CI |
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

### Vorentschiedenes zuerst lesen

Für manche Themen liegen Vorüberlegungen bereits schriftlich vor. Sie werden
**vor** der Arbeit daran gelesen, damit getroffene Entscheidungen nicht
versehentlich untergraben und Überlegungen nicht neu erarbeitet werden:

| Thema | Datei |
|---|---|
| Onboarding, Lebenssituationen, Bereichs-Vorauswahl, Einzelunternehmer-Modus | `docs/onboarding-life-situations.md` |
| Tutorial, Freischaltung von Funktionen, behutsame Heranführung | `docs/tutorial-progressive-disclosure.md` |
| Reihenfolge der Tutorial-Kapitel, Datenquellen-Weiche (Datei/Bank/Beispieldaten) | `docs/tutorial-sequence.md` |

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
muss in **allen** `SUPPORTED_LOCALES` (aktuell `de`, `en`, `ru` —
`src/i18n/translations.ts`) vorhanden sein. Klingonisch (`tlh`) steht in
`INACTIVE_LOCALES`: die Übersetzungen bleiben im Baum, die Sprache ist aber
nicht wählbar und **nicht paritätspflichtig**. In Komponenten `useI18n()`
(`t('namespace.key')`), in `src/services/`/`src/lib/`-Modulen (kein React-
Kontext) `serviceT` aus `src/i18n/serviceT.ts`. Komponententests prüfen
**bilingual** (mind. de + en) über `@/test-utils/render`. Durchsetzung
agentenunabhängig via `pnpm check:i18n` (hardcodierte Strings, Pre-Commit + CI)
und `src/i18n/__tests__/locale-parity.test.ts` (Key-Symmetrie). Vollständiger
Workflow inkl. Test-Template, dynamische Strings, neue Sprachen hinzufügen:
`.claude/i18n-workflow.md` + `.claude/templates/i18n-*.template.tsx`.

### Sprachstil (`wording`)

Zweite Achse neben der Sprache: `everyday` (Alltagssprache, **Standard**) und
`technical` (Fachsprache). Der Basisbaum in `translations.ts` **ist** die
Fachsprache; `src/i18n/overlays/everyday/<locale>.ts` enthält nur die
Abweichungen. Aufgelöst wird das in `t()` — Aufrufstellen ändern sich nie.
Fehlt ein Overlay-Eintrag, greift der Basistext. Details und Formulierungsregeln:
`src/i18n/wording.ts` und der Kopf von `overlays/everyday/de.ts`.

**Jede Sprache in `SUPPORTED_LOCALES` braucht ein Overlay.** Der Sprachstil ist
ein Barrierefreiheits-Versprechen; eine Sprache ohne Overlay sieht nur die
Fachsprache und hat einen toten Schalter in den Einstellungen — ohne dass
irgendetwas rot wird, denn `overlayFor()` liefert dann still `undefined`.
Erzwungen durch `src/i18n/__tests__/overlay-coverage.test.ts` (Existenz **und**
Mindestumfang, damit ein Feigenblatt-Overlay nicht durchgeht). Der Basisbaum ist
je Sprache eigenständig zu beurteilen: „Fixed costs" ist im Englischen bereits
Alltagssprache und braucht keinen Eintrag, „буфер" im Russischen dagegen ein
technisches Lehnwort — deshalb steht dort „запас", wo Deutsch „Puffer" behält.

```typescript
// ❌ NICHT ERLAUBT:            // ✅ ERFORDERLICH:
<h1>Meine Überschrift</h1>      const { t } = useI18n();
                                 <h1>{t('myFeature.title')}</h1>
```

### Fallen, die hier schon zugeschlagen haben

Alle folgenden Fehler waren **unsichtbar**: kein Test wurde rot, kein Compiler
hat gemeckert. Sie sind jetzt maschinell abgesichert — die Regeln stehen hier,
damit klar ist, *warum* der jeweilige Wächter existiert.

| Falle | Was passiert | Wächter |
|---|---|---|
| `t()` im Initializer einer **Modul-`const`** | Wird EINMAL beim Import aufgelöst; ein Sprachwechsel wirkt nie wieder. Konstante in eine **Funktion** umwandeln | `pnpm check:i18n-module-consts` (TypeScript-AST, ganzbaumig) |
| **Doppelter Namespace** in `translations.ts` | Gültiges JavaScript — der spätere gewinnt, der frühere verschwindet lautlos. Im ausgewerteten Objekt ist der Fehler unsichtbar | `tsc` (TS1117) **und** `locale-parity.test.ts` (liest die Quelle) |
| **Vertippter `t()`-Key** | Rendert den rohen Punkt-String. Die Locale-Parität fängt das NICHT — sie prüft die Bäume gegeneinander, nicht die Aufrufstellen | `call-site-keys.test.ts` |
| **Erfundener Platzhalter** in einer Übersetzung | Steht wörtlich als `{foo}` auf dem Bildschirm. Umgekehrt darf eine Sprache einen Platzhalter weglassen — Russisch braucht kein `{plural}` | `locale-parity.test.ts` |
| **Rohe Steuerbytes** im Quelltext | `grep` hält die Datei für binär und überspringt sie in jedem Audit | `pnpm security:secrets` |
| Matching über den **Anzeigenamen** statt der ID | Bricht bei Umbenennung und in jeder anderen Sprache. Entitäten immer über die stabile ID adressieren | Review; die historischen Ausnahmen in `local-settings-service.ts` sind als solche kommentiert |

Zwei Arbeitsregeln dazu:

- Nach **jeder** Änderung an `translations.ts` sofort `pnpm exec tsc --noEmit` —
  ein doppelter Namespace fällt sonst erst viel später auf.
- Tests, die `serviceT`-gestützten Code anfassen, brauchen **keine** eigene
  Sprachfixierung mehr: `vitest.setup.ts` pinnt `navigator.language` auf `de-DE`.
  Eine explizit gespeicherte Sprache gewinnt weiterhin.

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
7. **Abhängigkeits-Patchstände:** `pnpm-lock.yaml` ohne bekannte Advisories
   (CI: OSV-Scanner). Direkte Abhängigkeit anheben, transitive über
   `pnpm.overrides` — Override-Ziele **immer nach oben begrenzen**
   (`">=1.1.16 <2"`). Ohne kompatiblen Patch: Eintrag in `osv-scanner.toml`
   mit `reason` **und** `ignoreUntil`, nie unbefristet.

Änderungen in diesen Klassen nur mit `[SECURITY]`/`[REGRESSION]`-Test im
selben Commit. Vor jedem Push: `pnpm test:security` und
`pnpm security:secrets` müssen grün sein.

## 11. Commits & PRs

Logische Commits mit den zugehörigen Tests, nicht 100-Zeilen-Sammelcommits.
Commit-Message nennt **Ziel + Test-Abdeckung** (nicht nur „was"). PR-Workflow:
Branch anlegen → Tests schreiben (rot) → implementieren (grün) → pushen → CI
abwarten → Review-Kommentare bearbeiten.

**Supabase Edge Functions (`supabase/functions/**`) deployen nicht
automatisch** — es gibt keinen CI-Schritt dafür (geprüft:
`.github/workflows/*.yml`). Immer wenn ein PR Dateien unter
`supabase/functions/` ändert und gemerged wird, legt der Agent **sofort ein
GitHub-Issue** an („Deployment ausstehend: <function-name> (PR #…)“) mit dem
konkreten `supabase functions deploy <name>`-Befehl, kurzer Begründung und
Link zum PR. Gilt für jeden Merge in diesem Bereich, nicht nur beim ersten
Mal — kein Vorgang wird stillschweigend übersprungen.

## 12. Automatische Durchsetzung

Pre-Commit (`.githooks/pre-commit`) und CI erzwingen i18n
(`pnpm check:i18n`), Teststruktur (`pnpm check:test-structure`), die
Karten-Regel (`pnpm check:card-rule`), die Plattform-Parität
(`pnpm check:platform-parity`) und den Fehlerzustand jeder Abfrage
(`pnpm check:query-errors`). Claude
Code erhält zusätzlich Live-Hinweise über `.claude/hooks/` (blockierend:
test-structure; advisory: Animations-Baseline, Karten-Klickbarkeit). Andere
Agenten prüfen diese Punkte im Selbst-Review.

Nicht maschinell prüfbar und deshalb ausschließlich Sache des Selbst-Reviews:
die Arbeitsweise-Regel „Absicht vor Auftrag" (siehe oben, vor §1).
