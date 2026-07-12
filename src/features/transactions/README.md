# Feature-Slice: Transactions (Buchungsseite)

## Zweck

Gemeinsame Fach- und Datenbasis (Domain + Application) mit getrennter Desktop-/Mobile-Präsentation für `/transactions`. Beide Oberflächen nutzen dasselbe ViewModel aus `useTransactionsOverview()` — identische Daten, keine doppelten Queries.

## Ist-Datenflüsse (vor dem Presentation-Split, Stand `src/pages/TransactionsPage.tsx` mit 436 Zeilen)

### Queries (React Query)

| Query-Key | queryFn | Service |
|---|---|---|
| `['transactions', 5000]` | `getTransactions(5000)` | transaction-service (Limit bewusst im Key, F-PERF-3 — sonst Cache-Kollision mit dem 1000er-Load von `useAutomationSuggestions`) |
| `['categories']` | `getCategories()` | transaction-service |
| `['accounts']` | `getAccounts()` | account-service |
| `['contract-decisions']` | `getContractDecisionMap` | contract-decision-service |

Die Keys stammen aus der **kanonischen** `financeKeys` (`src/features/shared/data/finance-query-keys.ts`), re-exportiert über `src/features/transactions/data/transactions-query-keys.ts` als `transactionsKeys` — byte-identisch zu den Dashboard-Keys, damit Invalidierungen aus beiden Slices denselben Cache-Eintrag treffen.

### Berechnungen (jetzt in `domain/`)

- `transactions-scope.ts`: `computeScopedBalance`, `computeEndingBalanceAnchor`, `hasContentFilter`, `countActiveFilters` — 1:1 aus der ehemaligen Page (Z. 119–202), nutzt `computeLocalBalances`/`computeEffectiveBalances` aus `src/features/shared/domain/balance-calculations.ts` (von Dashboard- **und** Transactions-Slice gebraucht → nach `shared/` gehoben statt dupliziert).
- `transaction-stats.ts`: `computeTransactionStats` — transferbereinigte Einnahmen/Ausgaben/Saldo über `computeFlowTotals` (`shared/domain/flow-calculations.ts`), keine eigene Reduce-Kette.

### Zustand & Mutationen

- Filterzustand: Kategorie, Konto, Vertrag, Essenziell, Ausgabenklasse, Suche, Range, customDays/Period (`DashboardFilterState`, im Hook) + `customGranularity` (eigener `useState`, s. u.)
- UI-/Dialog-Zustand: bleibt in der Page (`detailsTransaction`, `detailsOpen`, `addOpen`) — Interaktions-, nicht Fachzustand
- `hidden`-Set via `usePersistedSet('transactions_hidden')`
- Mutation: Löschen (invalidiert `transactionsKeys.transactionsRoot`, Toast, **bewusst ohne `onError`** — Ist-Verhalten der ehemaligen Page); Detail-Speichern via `useTransactionDetailEditing` (invalidiert `['transactions']`, `['transactions','contracts']`, `['contract-decisions']`)

## Ziel-Zuordnung (nach dem Presentation-Split)

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `transactions-scope.ts`, `transaction-stats.ts` | UI-freie Finanzberechnungen (kein React/React-Query/Browser) |
| `data/` | `transactions-query-keys.ts` | Re-Export der kanonischen `financeKeys` (`shared/data/`) |
| `application/` | `transactions-overview-view-model.ts`, `use-transactions-overview.ts` | UI-neutrales ViewModel: Queries, Filterzustand, abgeleitete Werte, Mutationen + Invalidierungen. Bewusst OHNE Router-/URL-Zeug — das bleibt Sache der Page |
| `presentation/desktop/` | `TransactionsDesktopView.tsx` | Master-Detail-Split: Filter + Kennzahlen + Tagesliste links, angedocktes Detail-Panel (sticky, 1/3·2/3) rechts |
| `presentation/mobile/` | `TransactionsMobileView.tsx` | Liste im normalen Seitenfluss, Detail als Overlay (`TransactionDetailsModal`, Dialog/Sheet-Weiche bei 768px bleibt intern im Modal) |
| `presentation/transactions-view-props.ts` | — | Gemeinsamer Interaktions-Props-Typ (`detailsTransaction`, `onOpenDetails`, `onSaveDetails`), den beide Views von der Page übernehmen |

`src/pages/TransactionsPage.tsx` bleibt dünner Orchestrator: `useSearchParams` + URL-Write-back, `?tx=`-Deep-Link (One-Shot via Ref), Dialog-/Auswahlzustand, Seiten-Chrome (PageHeader, Add-Button, Formular-Dialog, Lade-Skeleton/`FinanceEmptyState`) und die Layout-Wahl.

## Warum JS-Branching statt CSS-Dual-Render (Abweichung vom Dashboard-Muster)

Das Dashboard rendert Desktop- und Mobile-View gleichzeitig im DOM und blendet die inaktive Variante per CSS aus (`hidden lg:block` / `lg:hidden`) — das funktioniert dort, weil keine der beiden Ansichten eine große, fenstervirtualisierte Liste enthält.

Die Buchungsseite lädt bis zu 5000 Transaktionen; `TransactionDayList` (`@tanstack/react-virtual`, `useWindowVirtualizer`) virtualisiert ab 150 Einträgen gegen das **Fenster-Scroll**. Ein CSS-Dual-Render würde die Liste **zweimal** ins DOM hängen (einmal pro Präsentation) und zweimal virtualisieren/messen — unnötiger Render- und Scroll-Messaufwand, potenziell inkonsistente `selectedId`-Hervorhebung zwischen beiden Kopien. Deshalb wählt die Page die aktive View per JS (`isWide ? <TransactionsDesktopView/> : <TransactionsMobileView/>`, `useIsWideDesktop()` = `min-width: 1024px`, identisch zum Master-Detail-Breakpoint) — zu jedem Zeitpunkt steht nur eine Listeninstanz im DOM.

Die bestehenden Page-Tests (`TransactionsPage.masterdetail/filters/deeplink.test.tsx`) erwarten ohnehin Einzeltreffer (`getByRole`/`getByText` ohne `within(...)`-Scoping) — ein Dual-Render hätte sie durch doppelte Treffer gebrochen, auch unabhängig von der Virtualisierungsfrage.

## Virtualisierungs-Constraint (verbindlich für beide Views)

`TransactionDayList` darf in **keiner** der beiden Views von einem eigenen `overflow`/`max-height`-Container umschlossen werden — die Virtualisierung hängt am Seiten-Scroll (`useWindowVirtualizer`), nicht an einem internen Scrollcontainer. Das gilt auch für künftige Änderungen an `TransactionsDesktopView`/`TransactionsMobileView`.

## 768px-Dialog/Sheet-Weiche (Mobile)

`TransactionDetailsModal` entscheidet intern (eigener `resize`-Listener, 768px) zwischen Dialog (≥768px) und Bottom-Sheet (<768px) — unabhängig vom 1024px-Master-Detail-Breakpoint der Page. Diese interne Weiche bleibt unangetastet; `TransactionsMobileView` reicht nur `open`/`onOpenChange` durch.

## Konservierte Eigenheiten (bewusst NICHT an das Dashboard-Muster angeglichen)

- **`activeCount` zählt 7 Dimensionen** (inkl. `range` und `search`), der Dashboard-Hook zählt nur 5 (ohne `range`/`search`, da dort Zeitraum separat angezeigt wird und kein Suchfeld im Header existiert). Siehe `countActiveFilters` (`domain/transactions-scope.ts`).
- **`reset()` setzt ALLE Filterfelder inkl. `ausgabenklasse` UND `customGranularity` zurück.** Der Dashboard-Hook lässt `ausgabenklasse` in seinem `reset()` bewusst unangetastet. Diese Slice bildet die ehemalige Page-Funktion `resetFilters` (Z. 218–231) exakt nach — `[REGRESSION]`-Test in `application/__tests__/use-transactions-overview.test.tsx`.
- **Eigenes Hidden-Set `transactions_hidden`**, getrennt vom Dashboard-Key `dashboard_hidden_transactions`: Ausblenden auf der Buchungsseite beeinflusst nicht die Dashboard-Vorschau und umgekehrt.
- **`customGranularity` ist NICHT Teil von `filters.values`** und wird nicht über `encodeDashboardFilters`/`decodeDashboardFilters` in der URL gespiegelt — lebt in einem eigenen `useState` im Hook (Ist-Verhalten der ehemaligen Page, deren `customGran` ebenfalls ein separater `useState` war).
- **`deleteMutation` hat bewusst kein `onError`** — Ist-Verhalten der ehemaligen Page (Z. 109–115), nicht neu entschieden.
- **`TransactionDetailsModal.open` vereinfacht sich zu `detailsOpen`** (statt ehemals `detailsOpen && !isWide` auf der Page): da `TransactionsMobileView` ausschließlich bei `!isWide` mountet, ist die `!isWide`-Bedingung durch das JS-Branching bereits erfüllt. Verhaltensgleich, weil `detailsTransaction`/`detailsOpen` nur über `openDetails()` (nur bei vorhandenen Buchungen) oder den `?tx=`-Deep-Link (nur bei `transactions.all.length > 0`) gesetzt werden — beide Pfade sind an den `TransactionsDesktopView`/`TransactionsMobileView`-Zweig der Page gekoppelt.

## Regeln für diese Slice

- Domain-Funktionen: keine React-, React-Query-, Browser- oder UI-Imports
- Tests IMMER in `__tests__/`-Ordnern, deutsche `it('sollte …')`-Titel
- Aggregation über `computeFlowTotals`/`shared/domain/balance-calculations` — keine neuen Inline-Reduces
- Query-Keys nur aus `data/transactions-query-keys.ts` (re-exportiert die kanonische `financeKeys`-Quelle)
- `TransactionDayList` nie in einem `overflow`-Container einschließen (Virtualisierungs-Constraint oben)
