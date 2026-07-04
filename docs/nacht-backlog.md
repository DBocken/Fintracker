# Nacht-Backlog — autonome Entwicklungs-Sessions

Dieses Dokument steuert die nächtliche Selbstoptimierungs-Routine: Eine unbeaufsichtigte
Claude-Code-Session nimmt sich die **oberste Aufgabe mit Status `offen`**, arbeitet sie per TDD ab
und liefert einen Draft-PR. Referenzen: Issue #175 (Audit-Nacharbeiten), Epic #21 (Code-Hygiene),
`docs/design-principles.md`, `CLAUDE.md`.

## Leitplanken (gelten für jede Nacht-Session)

- **Nur headless verifizierbare Arbeit**: `npm run test`, `npm run lint`, `npm run build` müssen
  grün sein, sonst wird **nicht gepusht** (stattdessen Befund melden, Aufgabe auf `blockiert`).
- TDD gemäß `CLAUDE.md`: Test zuerst (rot → grün), `[REGRESSION]`-Tag für Bugfixes, Tests in
  `__tests__/` neben dem Code, deutsche Test-Beschreibungen.
- Jede Aufgabe auf eigenem Branch `claude/nacht-<kurzname>` (Basis: `origin/main`), Draft-PR gegen
  `main`. **Niemals mergen, niemals direkt auf `main` pushen.**
- Konflikt-Check vor Start: Dateien, die in offenen PRs umgebaut werden, nicht anfassen
  (aktuell v. a. #174 FinancialLandscape/Coach, #179 Coach/Datenschicht).
- Bei Strang-D-Aufgaben: Playwright-Screenshots (390 px mobil + Desktop, vorher/nachher) in den PR.
- Status hier fortschreiben: `offen` → `in-arbeit` → `erledigt` (mit PR-Link) bzw. `blockiert`
  (mit Begründung).

## Bereits erledigt (Verifikation 2026-07-04, nicht mehr bearbeiten)

- Rate-Limit-Totcode `gocardless-sync`: Konstanten entfernt, fehlendes Limit dokumentiert
  (`supabase/functions/gocardless-sync/index.ts:26-29`). Rest siehe N6.
- Toter Code `AusgabentrackerPage.tsx` / `xs2a-service.ts` / `market-data-mock-service.ts`:
  existiert nicht mehr; alle Skins haben CSS.
- Englische Roadmap-Titel: `coach-service.ts` ist vollständig deutsch.

## Endliche Aufgaben (zuerst, in dieser Reihenfolge)

### N1 — A11y: Pagination & Icon-Buttons ohne zugängliche Namen · Status: in-arbeit (Nacht-Batch 2026-07-04)

- Ist: `src/components/ReviewTable.tsx:384-423` — 4 Icon-only-Pagination-Buttons ohne
  aria-label/title; `src/components/settings/CategoryTree.tsx:93,105,118` und
  `src/components/accounts/AccountManager.tsx:422-461` nutzen `title` statt `aria-label`.
- Test-first: RTL-Tests `getByRole('button', { name: /nächste Seite/i })` u. ä.
- Akzeptanz: neue Tests + Suite/Lint/Build grün. Umfang S, Risiko niedrig.

### N2 — Löschbestätigung auf der Buchungsseite (F-UX-2) · Status: erledigt ([PR #184](https://github.com/DBocken/Fintracker/pull/184))

- Ist: `src/pages/TransactionsPage.tsx:375,404` löscht ohne Dialog;
  `src/components/dashboard/TransactionDetailsPanel.tsx:444-457` ebenso. Zielmuster existiert:
  `src/components/dashboard/DeleteConfirmationDialog.tsx` (Nutzung siehe `Dashboard.tsx:166-169`).
- Test-first: `[REGRESSION]`-Test — Klick auf „Löschen" ruft den Delete-Mock NICHT auf, erst die
  Bestätigung ruft ihn genau 1×.
- Akzeptanz: neuer Test rot→grün, Suite/Lint/Build grün. Umfang S, Risiko niedrig.

### N3 — Testlücken Geld-Logik schließen · Status: in-arbeit (Nacht-Batch 2026-07-04)

- Services ohne Tests (verifiziert): `coach-service.ts` (Stage-Logik, Notgroschen-Edge
  `expenses===0→6`), `live-balance-service.ts` (`pickPreferredBankBalance`, pure),
  `merchant-rules-service.ts`, `finance-foundation-service.ts` (`medianMonthlyExpenses`),
  `budget-sweep-service.ts`.
- Nur neue Tests in `src/services/__tests__/`; Produktivcode bleibt unangetastet. Findet ein Test
  einen echten Bug: als `[REGRESSION]` fixen (separater Commit).
- Akzeptanz: Suite/Lint/Build grün. Umfang S–M, Risiko sehr niedrig.

### N4 — Such-Debounce für Transaktionssuche (F-PERF-2 Rest) · Status: offen

- Ist: `src/pages/TransactionsPage.tsx:286` und
  `src/components/dashboard/Dashboard.tsx:121,256-261` filtern bis zu 5000 Buchungen pro
  Tastendruck inkl. URL-Write. `src/lib/performance.ts` hat ungenutzte `debounce`/`throttle`.
- Plan: neuer Hook `src/hooks/useDebouncedValue.ts` (~250 ms); Input bleibt kontrolliert auf dem
  Rohwert, nur der Filter-/URL-Wert wird debounced.
- Test-first: Hook-Test mit `vi.useFakeTimers()`; danach `TransactionsPage.filters.test.tsx:77`
  auf Timer-Advance umstellen.
- Akzeptanz: Hook-Test + angepasste Filter-Tests + Suite/Lint/Build grün. Umfang M,
  Risiko niedrig-mittel. **Hinweis:** fasst dieselben Dateien wie N2 an — erst nach N2-Merge.

### N5 — Rest-Hygiene · Status: offen

- `src/pages/BankCallbackPage.tsx:484`: Text „Zurück zum Ausgabentracker" verweist auf die
  gelöschte Seite → Wording anpassen.
- `debounce`/`throttle` in `src/lib/performance.ts`: werden durch N4 erstmals genutzt; falls N4
  entfällt, als tote Exporte entfernen.
- Akzeptanz: Suite/Lint/Build grün. Umfang S, Risiko niedrig.

### N6 — Per-User-Rate-Limiting gocardless-sync (Issue #175 Punkt 4) · Status: offen

- Nur der nachts machbare Teil: pure Token-Bucket-/Sliding-Window-Logik in Deno-Import-freier
  Datei `supabase/functions/gocardless-sync/rate-limit.ts`, per vitest getestet (Burst,
  Fenster-Reset, getrennte User).
- Die Einbindung in `index.ts` ist headless NICHT verifizierbar (kein Deno-Harness) → im PR als
  offener, menschlich zu reviewender Folge-Schritt markieren.
- Akzeptanz: neue Testdatei grün, Suite/Lint/Build grün. Umfang M/L, Risiko mittel.

## Serien-Aufgaben (nach N1–N6, abwechselnd C und D)

### Strang C — Vollständige Zweisprachigkeit de/en

Infrastruktur existiert (`src/i18n/`: `translations.ts` de/en, `useI18n`, `I18nProvider`,
Coverage-Tests bis „Batch 8"). 7 von 23 Seiten nutzen `useI18n` (Coach, Debts, Liquidity,
Milestones, NetWorth, Privacy, Transactions). Pro Nacht **eine Scheibe**:

| # | Scheibe | Status |
|---|---|---|
| C1 | Dashboard-Komponenten-Reste | in-arbeit (Nacht-Batch 2026-07-04) |
| C2 | AccountsPage + AccountManager | offen |
| C3 | CsvPage + ReviewTable | offen |
| C4 | ContractsPage | offen |
| C5 | BudgetsPage | offen |
| C6 | Settings-Cluster (EnhancedSettings + Unterkomponenten) | offen |
| C7 | Form-Dialoge (TransactionFormDialog, AccountFormDialog, DebtFormDialog — Batch-8-Inventar) | offen |
| C8+ | restliche Seiten/Sheets/Popups (vor Start inventarisieren) | offen |
| C-final | Sprachumschalter in Settings prüfen/ergänzen + repo-weiter Hardcoded-String-Scanner-Test (deutsche Umlaut-Wörter in JSX außerhalb `translations.ts`, Snapshot der Restliste) | offen |

Vorgehen je Scheibe (Muster: `src/i18n/__tests__/dashboard-i18n.test.ts`):
(1) Coverage-Test — jeder neue Key in **beiden** Locales; (2) Render-Test mit `locale='en'` —
bekannte deutsche Strings verschwinden; (3) Strings nach `translations.ts`, `useI18n` einsetzen.

### Strang D — Stylecode-Konformität (weniger Rahmen/Boxen, klar, mobil, kompakt)

Basis: `docs/design-principles.md` (Prinzip 8 „Karten sind Aktionen"), Bausteine
`InteractiveCard`, `InfoGroup`/`InfoStatStrip`, `ListRow`, `PageHeader`, `SectionHeader`,
`StatHero` in `src/components/common/`. Pro Nacht **ein Screen**, konservativ: nur strukturelle
Umstellung auf vorhandene Bausteine, **keine** neuen Farb-/Token-Entscheidungen (→ Issue #54).

| # | Screen | Status |
|---|---|---|
| D1 | Dashboard | offen |
| D2 | TransactionsPage | offen |
| D3 | AccountsPage | offen |
| D4 | Settings | offen |
| D5+ | weitere Screens nach Sichtbarkeit; CoachPage erst nach Merge von #174/#179 | offen |

Vorgehen je Screen: (1) Karten-Audit — Karten-Chrome ohne Klick-Aktion → `InfoGroup`/
`InfoStatStrip`, klickbare Flächen → ganzflächige `InteractiveCard`; (2) verschachtelte Boxen
reduzieren, kompakte mobile Abstände; (3) bestehende Tests grün + Komponententests für geänderte
Interaktionen; (4) Playwright-Screenshots (390 px + Desktop, vorher/nachher) in den PR.
