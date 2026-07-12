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
| State | TanStack Query 5, Framer Motion |
| Visualisierung | Recharts 2 |
| Tests | Vitest 4, React Testing Library |
| Mobile | Capacitor 8, Android 34+ |
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
| `pnpm check:i18n` | i18n-Compliance (hardcodierte Strings, fehlende Keys) |
| `pnpm check:test-structure` | Test-Struktur validieren (`__tests__/`-Konvention) |

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

Unterstützte Sprachen: `de` (Deutsch), `en` (English), `tlh` (Klingon)  
Translations: `src/i18n/translations.ts`

Neue Strings: Zentral in `translations.ts` (beide Sprachen), via `useI18n()`/`t()` in Komponenten.  
Tests: Bilingual mit `renderWithI18n(..., 'de')` und `renderWithI18n(..., 'en')`.

Siehe [AGENTS.md](AGENTS.md) Abschnitt „Internationalisierung".

## Für KI-Agenten

Verbindliche Regeln für ALLE Agenten (Claude, Codex, …) in [AGENTS.md](AGENTS.md) (TDD, Design, Security, i18n); Claude Code liest zusätzlich [CLAUDE.md](CLAUDE.md) mit Claude-spezifischer Mechanik.  
Zusätzlich: Entwickler-Guidelines in [docs/coding-guide.md](docs/coding-guide.md), Feature-Struktur in [docs/architecture/feature-structure.md](docs/architecture/feature-structure.md).

## Dokumentation

- [docs/FEATURES.md](docs/FEATURES.md) — aktuelle Features
- [docs/domain-invariants.md](docs/domain-invariants.md) — Geschäftslogik-Grenzen
- [docs/security-guidelines.md](docs/security-guidelines.md) — Schwachstellen-Klassen
- [docs/design-principles.md](docs/design-principles.md) — UI/Animation-Regeln
- [docs/architecture/feature-structure.md](docs/architecture/feature-structure.md) — Feature-Slice-Pattern
