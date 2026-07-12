# Feature-Slice: Dashboard (Finanzübersicht)

## Zweck

Gemeinsame Fach- und Datenbasis (Domain + Application) mit getrennter Desktop-/Mobile-Präsentation. Beide Oberflächen nutzen dasselbe ViewModel aus `useFinanceOverview()` — identische Daten, keine doppelten Queries.

## Ist-Datenflüsse (vor dem Refactoring, Stand `src/components/dashboard/Dashboard.tsx` mit 612 Zeilen)

### Queries (React Query, alle inline in Dashboard.tsx)

| Query-Key | queryFn | Service |
|---|---|---|
| `['transactions', 5000]` | `getTransactions(5000)` | transaction-service (Limit bewusst im Key, F-PERF-3, sonst Cache-Kollision mit 1000er-Load von useAutomationSuggestions) |
| `['categories']` | `getCategories()` | transaction-service |
| `['accounts']` | `getAccounts()` | account-service |
| `['contract-decisions']` | `getContractDecisionMap` | contract-decision-service |

### Berechnungen inline in der Komponente (werden nach `domain/` extrahiert)

- `localBalances` (Zeile 81–90): Summe Transaktionsbeträge je Konto
- `effectiveBalances` (92–110): Bank-Live-Saldo (`live_balance_amount`) vs. lokal (`opening_balance` + localBalances)
- `totalEffectiveBalance` (112–114)
- `stats` (302–348): Einnahmen/Ausgaben/Saldo — re-implementierte Inline-Kopie von `sumIncome`/`sumExpenses` aus `src/lib/analysis-data.ts` (Duplikat)
- Zeitreihen-Bucketing nach Granularität (318–330)
- Delegiert wird bereits an: `filterTransactions`/`getDashboardGranularity`/`encodeDashboardFilters` (filter-utils.ts), `listAvailablePeriods` (period-utils.ts), `buildSankeyData`/`buildSpendingSunburst`/`buildSunburstTree` (lib/analysis-data.ts)

### Zustand & Mutationen

- Filterzustand: Kategorie, Konto, Vertrag, Essenziell, Ausgabenklasse, Suche, Range, customDays/Gran/Period (Zeilen 116–125)
- UI-Zustand: Dialoge (Filter/Löschen/Details), Sortierung, hidden-Set via `usePersistedSet('dashboard_hidden_transactions')`
- Mutationen: Kategorie-Update + Löschen (invalidieren `['transactions']` + Toast), Detail-Speichern via `useTransactionDetailEditing` (invalidiert `['transactions']`, `['transactions','contracts']`, `['contract-decisions']`)

### Desktop/Mobile heute (nach dem Refactoring)

Rein CSS-basiert: `<DashboardMobileStory className="lg:hidden">` und `<DashboardDesktopView className="hidden lg:block">`. Beide Präsentationen bekommen dasselbe `model` (`FinanceOverviewViewModel`) als Prop und verdrahten damit dieselben fünf Komponenten (AdvancedBalanceChart, SankeyChart, SpendingBreakdownCard, ExpensesOverTimeCard, AccountCards) — keine eigenen Queries mehr in den Präsentationskomponenten.

### Ehemalige Verstöße gegen „gleiche Daten, keine Doppel-Queries" (in diesem Refactoring behoben)

1. `AdvancedBalanceChart` lud früher eigene Transaktionen über einen chart-spezifischen Query-Key (1000 Zeilen) → Saldo-Historie rechnete auf anderem Datensatz als `stats` (5000). Jetzt auf Props (`transactions`, `isLoading`) umgestellt; der Key entfiel inkl. 6 toter Invalidierungen (BankCallbackPage, gocardless-sync-service, AccountManager ×2, TransferSuggestions, ReviewTable).
2. `AccountCards` re-fetchte `['accounts']`, obwohl balances/totalBalance bereits als Props ankamen. Jetzt auf Props (`accounts`, `isLoading`) umgestellt.
3. Akzeptierte Ausnahme (bleibt): `LandscapeView` in DashboardMobileStory lädt `['financial-health', locale]` lazy nur bei aktivem Tab — bewusste progressive Offenlegung; eine Verlagerung in den Hook würde die Query für alle eager machen.

## Ziel-Zuordnung (nach dem Refactoring)

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | overview-types.ts, balance-calculations.ts, overview-calculations.ts | UI-freie Finanzberechnungen (kein React/React-Query/Browser) |
| `data/` | dashboard-query-keys.ts | stabile Query-Keys, byte-identisch zu den bisherigen Literalen |
| `application/` | finance-overview-view-model.ts, use-finance-overview.ts | UI-neutrales ViewModel: Queries, Filterzustand, abgeleitete Werte, Mutationen + Invalidierungen. Keine Darstellungsentscheidungen (keine Farben/Spalten/JSX) |
| `presentation/desktop/` | DashboardDesktopView.tsx | informationsreich: Grid, Charts nebeneinander, Sankey |
| `presentation/mobile/` | DashboardMobileStory.tsx | fokussiert: eine Ansicht pro Screen, Swipe-Story, progressive Offenlegung |

Dialog-Zustände (offen/zu, ausgewählte Transaktion) bleiben bewusst in der Page — Interaktions-, nicht Fachzustand.

## Regeln für diese Slice

- Domain-Funktionen: keine React-, React-Query-, Browser- oder UI-Imports (date-fns als reine Datumsbibliothek ist ok)
- Tests IMMER in `__tests__/`-Ordnern (Repo-Hook blockt andere Ablagen), deutsche `it('sollte …')`-Titel
- Aggregation über `@/lib/analysis-data` (`sumIncome`/`sumExpenses`) — keine neuen Inline-Reduces
- Query-Keys nur aus `data/dashboard-query-keys.ts`
