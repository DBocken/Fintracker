# Feature-Slice-Architektur: Gemeinsame Fachbasis, getrennte Präsentation

## Motivation & Grundprinzip

- Features bestehen aus UI-unabhängiger Fachlogik + optional getrennten Desktop-/Mobile-Präsentationen.
- Desktop: informationsreich, vergleichend (Tabellen, Diagramme, Filterleisten, Bulk-Aktionen).
- Mobile: fokussiert (eine Hauptaussage pro Ansicht, progressive Offenlegung, Bottom Sheets, geführte Abläufe).
- Beide Oberflächen konsumieren DASSELBE ViewModel → identische Daten/Berechnungen per Konstruktion, keine doppelten Queries. Alle Desktop-Informationen müssen auch mobil erreichbar sein — nur anders gestaffelt (progressive Verzweigung).

## Referenzimplementierung: `src/features/dashboard/`

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `overview-types.ts`, `balance-calculations.ts`, `overview-calculations.ts` | Reine Berechnungen. VERBOTEN: React, `@tanstack/react-query`, Browser-APIs, UI-Imports. ERLAUBT: date-fns, `@/types`, `@/lib/*` (reine Funktionen). Aggregation IMMER über `@/lib/analysis-data` (`sumIncome`/`sumExpenses`) statt neuer Inline-Reduces. |
| `data/` | `dashboard-query-keys.ts` | Query-Keys als Konstanten — byte-identisch zu bestehenden Literalen bei Migrationen! Bestehende Services aus `src/services` weiterverwenden, nicht duplizieren. |
| `application/` | `finance-overview-view-model.ts`, `use-finance-overview.ts` | Ein Hook (`use<Feature>Overview`) + expliziter ViewModel-Typ. Darf: Daten laden, Domain-Funktionen aufrufen, Mutationen + Invalidierungen bereitstellen, `useI18n` für Toasts. Darf NICHT: Farben, Kartengrößen, Spaltenzahlen, JSX. Dialog-/Interaktionszustand bleibt in der Page. |
| `presentation/desktop\|mobile\|shared/` | `DashboardDesktopView.tsx`, `DashboardMobileStory.tsx` | Bewusst unterschiedliche Informationsarchitektur erlaubt; Auswahl über bestehende responsive Mechanik (heute CSS `lg:hidden`/`hidden lg:block`), beide bekommen dasselbe `model`-Objekt. |

Details zum Ist-Zustand vor der Migration (Query-Tabelle, betroffene Zeilen, behobene Doppel-Query-Verstöße) stehen in `src/features/dashboard/README.md` — als Vorlage für die README jeder neuen Slice.

## Entscheidungsbaum: gemeinsame Komponente vs. getrennte Views

- Nur Abstände/Größen/Anordnung unterschiedlich → EINE responsive Komponente.
- Unterschiedliche Informationshierarchie, Bedienablauf oder gleichzeitig sichtbare Informationsmenge → getrennte Desktop-/Mobile-Komponenten mit gemeinsamem ViewModel.
- Anti-Pattern: große Komponenten mit vielen `hidden lg:block`/`lg:hidden`/`isMobile ? … : …`-Kombinationen.

### Zweite legitime Verzweigungsmechanik: gemeinsamer Kern immer gemountet + JS-Branching nur für die abweichende Region

Neben CSS-Dual-Render (Dashboard-Muster oben) gibt es einen zweiten legitimen Fall: ein gemeinsamer, IMMER gemounteter Kern (`presentation/shared/`, z. B. `TransactionsListPane`) plus JS-Branching NUR für die strukturell unterschiedliche Restregion (Referenz: `src/features/transactions/`, `TransactionsDetailAside` vs. `TransactionsDetailSheet`). Kriterium, wann dieses Muster statt CSS-Dual-Render oder statt JS-Branching über den GANZEN Baum gilt: virtualisierte/teure Bäume (z. B. `@tanstack/react-virtual` über hunderte/tausende Zeilen) dürfen **nie doppelt gemountet** werden (CSS-Dual-Render würde sie zweimal ins DOM hängen und zweimal virtualisieren) UND **nie per Ternary remounten** (`isWide ? <Desktop/> : <Mobile/>` über den ganzen Baum würde bei jedem Breakpoint-Wechsel Scroll-/Fokus-/Virtualizer-Zustand verlieren, z. B. bei iPad-Rotation über 1024px). Die Lösung: den teuren, gemeinsamen Teil als eigene `presentation/shared/`-Komponente extrahieren, die immer rendert, und nur die kleine, strukturell abweichende Region (z. B. Detail-Panel vs. Detail-Sheet) per JS verzweigen lassen.

## Migrations-Kochrezept

1. Ist-Datenflüsse dokumentieren (README in der Slice).
2. Reine Berechnungen in Komponenten identifizieren.
3. Nach `domain/` extrahieren (TDD, Verhalten exakt konservieren — bewusste Abweichungen einzeln begründen + `[REGRESSION]`-Test).
4. Query-Keys byte-identisch nach `data/`.
5. Application-Hook + expliziter ViewModel-Typ.
6. Desktop-View aufs Model umstellen.
7. Mobile-View aufs Model umstellen.
8. Kind-Komponenten props-getrieben machen (keine eigenen Queries in der Präsentation; Ausnahme: echte Lazy-Loads hinter Interaktion, dokumentiert).
9. Tote Query-Keys/Invalidierungen entfernen.
10. Verifikation (volle Suite, Lint, Build, Smoke Desktop+Mobile).

## Verbindliche Repo-Regeln (Abweichung vom CLAUDE.md-Template!)

- Tests IMMER in `__tests__/`-Ordnern — Pre-Commit/CI (`pnpm check:test-structure`) blockt andere Ablagen; Claude Code blockt zusätzlich live (`.claude/hooks/test-structure-check.mjs`).
- Deutsche Testtitel `it('sollte …')`; `renderWithI18n`/`renderWithProviders`/`createHookWrapper` nur zentral aus `@/test-utils/render`.
- i18n: keine neuen hardcodierten UI-Strings; Keys in **allen** `SUPPORTED_LOCALES` (`de`/`en`/`ru`) je Sprachbaum in `src/i18n/translations/<locale>.ts` — nicht im Barrel `translations.ts` (erzwungen via `pnpm check:i18n` in Pre-Commit + CI; Key-Symmetrie: `locale-parity.test.ts`).
- Karten-Regel & Animations-Baseline gelten auch in `presentation/` (siehe `docs/design-principles.md`).
- Die vollständige, verbindliche Wächterliste steht in `AGENTS.md` §2 bzw. `docs/architecture/guard-system.md`; auf `presentation/` wirken zusätzlich `check:slice-presentation`, `check:view-data`, `check:card-rule`, `check:a11y-names` und `check:platform-parity`.

## Nächste Migrationskandidaten (Reihenfolge mit Begründung)

1. ~~**TransactionsPage**~~ — **migriert**: `src/features/transactions/` ist eine vollständige Slice (domain/data/application/presentation, siehe oben als Referenz für „gemeinsamer Kern + JS-Branching"); `src/pages/TransactionsPage.tsx` ist auf 177 Zeilen zurückgebaut.
2. **CoachPage / NetWorthPage** — bereits nahe am Muster (`getCoachOverview`/`getNetWorthBreakdown` liefern ViewModel-artige Objekte aus dem Service-Layer); fehlt nur ein dünner Application-Hook + explizite Typen.
3. **Repo-weite Query-Key-Normalisierung** (`userSettings` vs. `user-settings`, `automation-suggestions` vs. `automationSuggestions`) — separater, mechanischer Schritt mit eigener Invalidierungs-Prüfung.
4. ~~**`filter-utils`/`filter-constants`/`period-utils` nach `src/features/shared/` heben**~~ — **erledigt**: Filtermodell und Bereichslogik liegen in `src/features/shared/domain/` (`dashboard-filters.ts`, `dashboard-filtering.ts`, `active-filters.ts`, `period-options.ts`, `filter-view-model.ts`); `src/components/dashboard/` hält keine dieser Dateien mehr.
