# Fintracker

Privater Finanz-Copilot: Ausgaben, Budgets, Schulden, Vermögen und finanzieller Coach — alles ohne Cloud.

## Kernprinzipien

- **Local-First**: Finanzdaten bleiben im Browser/IndexedDB, optional AES-GCM-verschlüsselt. Supabase nur für optionale Auth, kein Zwang.
- **Privacy First**: Code ist die Quelle der Wahrheit für jeden Privacy-Anspruch (siehe `docs/coding-guide.md`).
- **Feature-Parität Desktop/Mobile**: Gemeinsame Fachbasis (ViewModel), getrennte Präsentationen — mobil fokussiert (eine Idee pro Screen), Desktop informationsreich (Tabellen, Diagramme, Bulk-Aktionen).

## Tech-Stack

| Komponente | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 4, shadcn/Radix UI |
| State | TanStack Query 5 (ausschließlich — kein Redux/Zustand), Framer Motion 12 |
| Visualisierung | Recharts 3 |
| Tests | Vitest 4, React Testing Library |
| Mobile | Capacitor 8, Android 7+ (minSdk 24, targetSdk 36) |
| Auth | Supabase Auth |

## Voraussetzungen

- Node.js 22+
- pnpm 10.12.4+

## Setup & Entwicklung

```bash
pnpm install
pnpm dev          # dev server
pnpm build        # production build
pnpm build && npx cap sync android  # Android app
```

## Scripts

| Befehl | Beschreibung |
|---|---|
| `pnpm dev` | Development server (Vite) |
| `pnpm build` | TypeScript + Vite build |
| `pnpm preview` | Vorschau des Production-Build |
| `pnpm lint` | ESLint prüfen |
| `pnpm test` | Alle Tests einmalig ausführen |
| `pnpm test:watch` | Tests im Watch-Mode |
| `pnpm test:coverage` | Coverage-Report |
| `pnpm test:security` | [SECURITY]-Tests (Schwachstellen-Wächter) |
| `pnpm test:integrity` | [INTEGRITY]-Tests (Datenfluss-Invarianten) |
| `pnpm test:privacy` | [PRIVACY]-Tests (Datengrenzen) |
| `pnpm test:mobile` | [MOBILE]-Tests (Touch, Swipe, Gesten) |
| `pnpm security:secrets` | Secret-Scan (Credentials, Keys) |

### Struktur-Wächter

Alle laufen in Pre-Commit **und** CI. Sie prüfen Regeln, die weder Compiler noch
Test rot machen würden — jeder einzelne existiert wegen eines Fehlers, der
genau deshalb durchgerutscht ist. Was er im Detail prüft und warum, steht in
[AGENTS.md](AGENTS.md) §2.

| Befehl | Prüft |
|---|---|
| `pnpm check:i18n` | Hardcodierte UI-Strings (`--staged`/`--range` für den Diff, `--all` für den Bestand) |
| `pnpm check:i18n-module-consts` | `t()` im Initializer einer Modul-`const` — friert beim Import ein |
| `pnpm check:layers` | Import-**Richtung** zwischen den Schichten (AGENTS.md §3) |
| `pnpm check:test-structure` | Testdatei-Platzierung (`__tests__/`-Konvention) |
| `pnpm check:card-rule` | Karten-Chrome ohne Interaktions-Signal |
| `pnpm check:platform-parity` | Fläche, die auf schmalen Breiten ganz fehlt |
| `pnpm check:query-errors` | `useQuery`-Aufruf ohne behandelten Fehlerfall |
| `pnpm check:a11y-names` | Bedienelement ohne zugänglichen Namen |
| `pnpm check:state-coverage` | Test für Leer- **und** Fehlerzustand je Fläche |
| `pnpm check:bundle-size` | gzip-Größen gegen `bundle-size-budget.json` (nur CI, setzt `pnpm build` voraus) |

## Tests

- **Konvention**: Tests neben Code in `__tests__/`-Ordnern (nicht `x.test.ts` neben `x.ts`).
- **Sprache**: Deutsche Testtitel (`sollte …`), Kategorien-Tags (`[REGRESSION]`, `[SECURITY]`, `[PRIVACY]`, `[MOBILE]`).
- **Abdeckung**: Vitest 4; Coverage-Schwellen werden in CI durchgesetzt (`vitest.config.ts`).
- **Wächter**: `src/security/*.security.test.ts` (Repo/Config-Scans gegen Schwachstellen).

## Architektur

**Feature-Slice-Architektur**: Gemeinsame Fachbasis (`domain/`, `application/`), getrennte Präsentationen (`presentation/desktop/`, `presentation/mobile/`).

- `src/lib/` — reine Domänenlogik (Berechnungen, kein I/O/React)
- `src/services/` — I/O: Storage, Supabase, APIs
- `src/hooks/` — React-Anbindung
- `src/components/` — UI (keine Business-Logik)
- `src/pages/` — Routen-Einstiegspunkte
- `src/features/` — Feature-Slices (domain + presentation)

Vollständig: [docs/coding-guide.md](docs/coding-guide.md), [docs/architecture/feature-structure.md](docs/architecture/feature-structure.md).

**Domain-Invarianten**: [docs/domain-invariants.md](docs/domain-invariants.md)  
**Design & Animation**: [docs/design-principles.md](docs/design-principles.md)  
**Security**: [docs/security-guidelines.md](docs/security-guidelines.md)

## Android-App

```bash
pnpm build
npx cap sync android
# Android Studio: android/ → Run on Device/Emulator
```

App-ID: `de.finanz.copilot`, Config: `capacitor.config.ts`

## Internationalisierung

Aktive Sprachen (`SUPPORTED_LOCALES`): `de` (Deutsch), `en` (English), `ru` (Русский).
Klingonisch (`tlh`) steht in `INACTIVE_LOCALES` — die Übersetzungen bleiben im
Baum, die Sprache ist nicht wählbar und **nicht** paritätspflichtig.

Zweite Achse: der **Sprachstil** (`wording`). `everyday` (Alltagssprache,
Standard) und `technical` (Fachsprache). Der Basisbaum in `translations.ts`
*ist* die Fachsprache; `src/i18n/overlays/everyday/<locale>.ts` enthält nur die
Abweichungen. Aufgelöst wird das in `t()` — Aufrufstellen ändern sich nie.

- Translations: `src/i18n/translations.ts`
- Neue Strings: zentral dort eintragen, in **allen** aktiven Sprachen, via
  `useI18n()`/`t()` in Komponenten bzw. `serviceT` in `services`/`lib`.
- Tests: bilingual mit `renderWithI18n(..., 'de')` und `renderWithI18n(..., 'en')`.

Siehe [AGENTS.md](AGENTS.md) §6 „i18n (verbindlich)" und den ausführlichen
Workflow in [.claude/i18n-workflow.md](.claude/i18n-workflow.md).

## Für KI-Agenten

Verbindliche Regeln für ALLE Agenten (Claude, Codex, …) in [AGENTS.md](AGENTS.md) (TDD, Design, Security, i18n); Claude Code liest zusätzlich [CLAUDE.md](CLAUDE.md) mit Claude-spezifischer Mechanik.  
Zusätzlich: Entwickler-Guidelines in [docs/coding-guide.md](docs/coding-guide.md), Feature-Struktur in [docs/architecture/feature-structure.md](docs/architecture/feature-structure.md).

## Dokumentation

**Landkarte: [docs/README.md](docs/README.md)** — trennt geltende Regeln von
Protokollen (Audits, Berichte, Momentaufnahmen). Wer wissen will, was *jetzt*
gilt, fängt dort an; alles unter `docs/archive/` ist Beleg, keine Vorgabe.

Die meistgebrauchten:

- [docs/FEATURES.md](docs/FEATURES.md) — versteckte und experimentelle Features
- [docs/domain-invariants.md](docs/domain-invariants.md) — Geschäftslogik-Grenzen
- [docs/security-guidelines.md](docs/security-guidelines.md) — Schwachstellen-Klassen
- [docs/design-principles.md](docs/design-principles.md) — UI/Animation-Regeln
- [docs/architecture/feature-structure.md](docs/architecture/feature-structure.md) — Feature-Slice-Pattern
