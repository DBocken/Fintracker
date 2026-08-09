# Slice `trading`

Depot, Positionen, Kennzahlen und die eToro-Konto-Ansichten. Route: `/trading`
(`src/pages/TradingPage.tsx` — sechs Zeilen, reiner Einstieg).

Bis WP 6.3 hatte die Slice `domain/` und `application/`, aber keine
`presentation/`: Die Migration hatte die Datenschicht herausgezogen und die
UI-Komplexität in `src/components/trading/` stehen lassen (ARCH-5/KOMP-1,
`TradingDashboard.tsx` mit 746 Zeilen). WP 6.3 hat die Kette geschlossen und die
Fläche entlang ihrer Tabs zerlegt; `src/components/trading/` gibt es nicht mehr.

## Schichten

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `performance-preview.ts`, `position-metrics.ts`, `etoro-view-state.ts` | Reine Berechnungen und fachliche Zustandstypen. Kein React, kein I/O. |
| `application/` | `use-trading-portfolio.ts`, `use-etoro-account.ts`, `use-trading-portfolios.ts`, `etoro-tab-gate.ts` | Die drei ViewModels und das gemeinsame Abfrage-Gatter. |
| `presentation/` | `TradingDashboard.tsx` + `shared/`, `tabs/`, `etoro/`, `dialogs/` | Darstellung. Keine eigene lesende Abfrage. |

### Warum drei ViewModels und nicht eines

- **`use-trading-portfolio`** — der Depot-Kern: aktives Depot, Positionen,
  Kennzahlen, Kursaktualisierung. Gilt für JEDES Depot und liest lokal.
- **`use-etoro-account`** — die zwanzig eToro-Abfragen über sieben Tabs. Betrifft
  nur eToro-Konten, geht ins Netz und steht unter einem Rate-Limit; deshalb ist
  jede Abfrage über `etoro-tab-gate.ts` an den sichtbaren Tab gebunden.
- **`use-trading-portfolios`** — die Depotverwaltung (Liste + anlegen,
  aktivieren, löschen). Seit WP 6.3 aus `PortfolioManager` herausgelöst; er war
  die letzte Trading-Fläche mit einer eigenen lesenden Abfrage.

## Aufteilung der Präsentation

```
presentation/
├── TradingDashboard.tsx        Kompositionswurzel: ViewModels lesen, Zustände
│                               der ganzen Fläche entscheiden, zusammensetzen
├── shared/                     TradingHeader, TradingSummaryStats,
│                               TradingTabsBar, ProviderSelector, PositionTable,
│                               PortfolioManager
├── tabs/                       je Tab ein Baustein: EtoroTabPanels (die sieben
│                               eToro-Tabs), TradingPositionsTab,
│                               TradingPerformanceTab, TradingPortfoliosTab
├── etoro/                      die eToro-Bausteine, props-getrieben
└── dialogs/                    EtoroConnectDialog, AddPositionDialog,
                                OcrImportDialog
```

## Zustände

- **Tab.** `activeTab` lebt in `use-etoro-account` (`useState`), NICHT in der URL
  und nicht persistiert. Voreinstellung je Depottyp: eToro → „Übersicht", sonst
  „Positionen". Beim Depotwechsel fällt er absichtlich auf die Voreinstellung
  zurück. WP 6.3 hat daran nichts geändert.
- **Fehler.** `hasLoadError` fasst die vier Bestandsabfragen des Depot-Kerns zu
  EINER Aussage zusammen (WP-9.6): „du besitzt nichts" ist hier die teuerste
  Falschaussage der App. Die eToro-Zusatzabfragen stehen bewusst nicht darin —
  ihre `queryFn` fängt den Fehler selbst ab und liefert eine dokumentierte
  Ersatzantwort.
- **Dialoge.** Der Öffnungszustand liegt in der Präsentation bzw. im
  Depot-ViewModel, nicht in `use-etoro-account`.

## Offen

- `presentation/` importiert an fünf Stellen `@/components/common/`-Bausteine
  (`InfoGroup`, `EmptyState`, `InteractiveCard`, `DecimalInput`,
  `FinanceErrorState`, `LoadingSwap`, `ChartFigure`, `SegmentedControl`,
  `StatHero`). Das ist kein Fehler dieser Slice — AGENTS.md §8/§9 schreibt
  genau diese Bausteine vor —, sondern der offene Umzug
  `components/common/` → `features/shared/presentation/`. Gezählt in
  `slice-presentation-budget.json` unter `maxBausteine`.
- Die drei Dialoge halten je eine `useMutation` (Absenden hinter einer
  Interaktion, Kochrezept Schritt 8, Ausnahme „echte Lazy-Loads"). Wenn ein
  zweiter Aufrufer dazukommt, gehören sie ins ViewModel.
- Desktop und Mobil teilen sich heute EINE responsive Präsentation. Eine
  Aufteilung nach `desktop/`/`mobile/` (Muster: `features/dashboard`) ist
  bisher nicht nötig gewesen — die Tab-Leiste scrollt horizontal, statt Inhalt
  wegzulassen.
