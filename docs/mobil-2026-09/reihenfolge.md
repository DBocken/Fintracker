# Reihenfolge und Parallelisierbarkeit (2026-09-04)

Synthese über die zwölf Entwürfe in [`flaechen.md`](flaechen.md). Sie beantwortet, was gefahrlos gleichzeitig gebaut werden darf, welche Arbeiten in einer Hand bleiben müssen und in welcher Reihenfolge.

**Protokoll, keine Vorgabe** — verbindlich ist `docs/architecture/darstellungsdichte.md`.

---

## 0. Was die 12 Entwürfe gemeinsam anfassen (Grundlage der Aufteilung)

Vier Konfliktklassen, alle mit *einer* Zahl bzw. *einer* Datei für den ganzen Baum:

**K1 Sprachbäume** — `src/i18n/translations/{de,en,ru,tlh}.ts` + `src/i18n/overlays/everyday/{de,en,ru}.ts`. 12 von 12 Entwürfen nennen sie, zusammen **134 neue Schlüssel** (Nav 1, Übersicht 8, Buchungen 6, Schulden/Nettovermögen 12, Budgets/Liquidität 19, Einstellungen 5, Konten/Verträge 17, Steuer/EÜR/Export/CSV 19, Meilensteine/Einkommen/Anlässe 12, Trading/Analyse/Abrechnung 15, Fragen/Tutorials/Datenschutz 14, Finanzstadt 6).

**K2 Ratschen** — `card-rule-budget.json` (149 / maxFokussiert 2), `view-data-budget.json`, `slice-presentation-budget.json` (11 / maxBausteine 0), `bundle-size-budget.json` (`totalGzipBytes`), `touch-target-budget.json` (0/0), `platform-parity-allowlist.json`, `state-coverage-allowlist.json`, `query-error-allowlist.json`, `i18n-allowlist.json`.

**K3 Boxlose Bausteine** — `src/features/shared/presentation/{PageHeader,InfoGroup,StatHero,ListRow,MilestonesStrip,InteractiveCard,BudgetTank}.tsx`.

**K4 Rahmen** — `src/components/layout/{AppShell,BottomNav,MobileNav,nav-config,SideNav}`.

**K5 (in den Aufträgen unterschätzt) — flächenübergreifende Einzeldateien:** `docs/architecture/darstellungsdichte.md`, `src/lib/tutorial-steps.ts`, `e2e-tests/fixtures/routes.ts`, `playwright.config.ts`, `e2e-tests/fixtures/vertical-slice.ts`, `src/__tests__/layout-overlap.sweep.test.tsx`, `src/pages/__tests__/screens.empty-state.test.tsx`, `src/pages/__tests__/screens.error-state.test.tsx`, `index.html`, `src/components/ui/input.tsx`.

**Zwei Widersprüche, die VOR Baubeginn zu klären sind:**
- `view-data-budget.json`: Konten/Verträge misst **220**, alle anderen elf Entwürfe **204**. Eine der beiden Messungen ist falsch — sonst rechnen zwei Flächen ihr Delta gegen verschiedene Stände.
- `card-rule-budget.json maxFokussiert` steht auf 2; die Übersicht will 2→1 (`DashboardMobileStory.tsx:62`) und Meilensteine/Anlässe ebenfalls 2→1 (`SpecialCategoriesMobileStory.tsx:26`). Zusammen ist es 2→0 — beide dürfen die Zahl nicht selbst schreiben. Dasselbe bei `max` 149: Datenschutz rechnet →145, Trading →147, Meilensteine →147, jeweils von 149 aus.

---

## (c) Was ZUERST gebaut werden muss — die Sperren

Diese sieben Schritte laufen **in einer Hand**, jeder als eigener Commit, bevor irgendeine Fläche gebaut wird. Reihenfolge ist bindend.

**S1 — ADR-Präzisierung: `docs/architecture/darstellungsdichte.md`.**
Die Finanzstadt liefert die drei fehlenden Sätze zu Regel 9: (a) *eine Visualisierung ist selbst die eine Aussage* — ohne diesen Satz sind die 6 Stadt-Label sechs Aussagen und jedes Recharts-Diagramm der App ein Verstoß (betrifft Übersicht, Liquidität, Einkommen, Trading, Analyse); (b) *ein Plättchen AUF einer gerenderten Fläche ist keine Box, der Rahmen UM sie schon* (`CityPage.tsx:70`); (c) *die Stadt bekommt keine Ausnahme von "ein Bildschirm"*. Dazu drei Konventionen, die alle zwölf brauchen und die heute jede Fläche anders beantwortet:
- **Detailschritt-Parameter**: `?lage=offen` (Coach, Übersicht, Schulden, Verträge, Stadt) vs. `?summen=offen` (Buchungen) vs. `?bereich=` (Einstellungen) vs. `?schritt=` (Export/CSV) vs. `?frage=detail` (Fragen) vs. `?anlass=` (Anlässe) vs. `?stand=alle` (Meilensteine) vs. `?verwaltung=offen` (Konten). Nach dem Merge stehen diese Namen in geteilten Adressen.
- **Zurücktaste**: CoachFokussiert benutzt `replace: true`, Einstellungen schlägt ausdrücklich `push` vor. Zwei Flächen mit verschiedenem Zurücktasten-Verhalten sind ein Bruch.
- **Wer misst „ein Bildschirm ohne Scrollen"** — acht Entwürfe stellen dieselbe offene Frage.

**S2 — Sprachbäume in einem Zug.** Die 134 Schlüssel aus den `benoetigteTexte`-Listen aller zwölf Entwürfe werden in EINEM Commit nach `de/en/ru/tlh` + `overlays/everyday/{de,en,ru}` geschrieben. Danach rührt **keine** Fläche die Sprachbäume mehr an — sie konsumiert nur. Das nimmt die heißeste Konfliktdatei komplett aus dem Parallelpfad heraus. (Ausnahmen, die mitkommen: Korrektur von `netWorth.composition`, Entfernen von `nav.short.dashboard`.)

**S3 — Die boxlosen Bausteine unter `src/features/shared/presentation/`.** Darauf warten nachweislich mehrere Flächen:
- `PageHeader.tsx` — muss in fokussiert den eigenen `<h1>` unterdrücken. Betrifft 12 Seiten gleichzeitig (Billing, Budgets, Coach, Debts, Euer, Income, Liquidity, Milestones, NetWorth, TaxReport, Transactions, Tutorials). Der Nav-Entwurf nennt das selbst „den Engpass des ganzen Plans". Zusammen damit: `CoachFokussiert.tsx` löscht seine eigene `<h1>`-Zeile, `CoachPage.tsx` bekommt die neue Begründung.
- `StatHero.tsx` — trägt `rounded-xl bg-gradient-to-br p-5`, also eine Box nach Regel 9. Schulden/Nettovermögen will sie ersatzlos fallen lassen, Budgets/Liquidität und Konten benutzen sie. Entweder eine `fokussiert:`-Variante ohne Hintergrund oder ein Ersatz-Baustein — die Entscheidung betrifft jeden Nutzer.
- `InfoGroup.tsx` (InfoStatStrip) — Schulden/Nettovermögen meldet ausdrücklich: „**wird gerade von jemand anderem geändert**, die kompakt/sm-Reihenfolge hat sich während dieser Analyse verändert". Steuer/EÜR und Budgets brauchen sie unverändert. Ein Besitzer, ein Commit.
- `ListRow.tsx` — Budgets und Konten wollen sie benutzen, Einstellungen umgeht sie eigens, weil die Icon-Kachel (`rounded-xl bg-muted`) die verbotene Schachtelung ist. Braucht die Variante ohne Kachel und ohne Rahmen je Zeile.
- `MilestonesStrip.tsx` — rendert je Meilenstein eine getönte Box (Regel 10, beide Dichten) und wird vom Coach-Detailschritt benutzt. Meilensteine und Coach würden dieselbe Datei doppelt entrahmen.
- **Neu und heute nirgends vorhanden:** ein Bottom-Sheet-Baustein (`side="bottom"`, `max-h-[90dvh]`, `overflow-y-auto`, `pb-[max(1.5rem,env(safe-area-inset-bottom))]`) und ein `useDetailParam`-Hook. **Elf von zwölf Entwürfen** kopieren dafür heute CoachFokussiert von Hand. Einmal bauen, elfmal benutzen.
- Regel für alle: `InteractiveCard` kommt in `presentation/mobile/**` nicht vor.

**S4 — Geteilte Query-Schlüssel nach `src/features/shared/data/finance-query-keys.ts`**, byte-identisch:
- `['net-worth']` — heute in `src/features/accounts/data/account-query-keys.ts:29`, gelesen von `use-net-worth-snapshot.ts`, `CashSection.tsx`, `use-money-questions.ts:304`, gefordert von Konten **und** Nettovermögen.
- `['milestones', locale]` — heute in `MilestonesPage.tsx:14`, `features/coach/data/coach-query-keys.ts` und `features/finance-city/application/use-city-model.ts:95`. Das ist die einzige Datei, über die sich Meilensteine und Finanzstadt berühren; wird sie hier erledigt, sind beide Flächen danach disjunkt.
- `['budget-overview']` — an vier Stellen als roher String (`BudgetsPage.tsx:33`, `useGlobalAtmosphere.ts:57`, `settings-query-keys.ts:16`, `use-budget-action.ts:50`). Ändert sich der Wert, lauscht die Atmosphäre ins Leere.
- `['transactions','contracts']` — heute in `account-query-keys.ts`, gebraucht von der neuen Verträge-Slice.

**S5 — Bausteine, die zwischen Slices hängen, an ihren Zielort.** Ohne diesen Commit hebt jede betroffene Fläche `slice-presentation-budget.json` (11, darf nur sinken):
- `src/components/tax/TaxCategorySelect.tsx` → `features/shared/presentation/`. Wird von **drei fremden** Flächen benutzt: `TransactionDetailsPanel.tsx:12` (Übersicht), `CategoryForm.tsx:13` (Einstellungen), `TransactionFormDialog.tsx:20` (Buchungen). Solange sie in `src/components/tax/` liegt, blockiert sie die Steuer-Migration.
- `src/components/dashboard/AusgabenklasseFilter.tsx` → `features/shared/presentation/` (Nutzer: `TransactionFilters` und `features/dashboard/presentation/shared/TransactionCharts.tsx`; nach AGENTS.md §3 ohnehin fällig).
- `src/components/PremiumUpsell.tsx` und `src/components/premium/PremiumTeaser.tsx` — Einordnung entscheiden (Infrastruktur wie `FeatureGate` oder `features/shared/presentation/`). Einkommen, Einstellungen, Budgets/Liquidität und Trading warten alle darauf.
- Der Zeitraum-Text `useRangeLabel` aus `src/components/dashboard/TransactionFilters.tsx:38-54` → reine Funktion unter `features/shared/domain/`. **Übersicht und Buchungen fordern denselben Ausbau in derselben Datei** — das ist der direkteste Merge-Konflikt der ganzen Liste.

**S6 — `src/lib/tutorial-steps.ts` einmal für alle.** `step()` bekommt `openAnchor` und ein Ziel mit Query-Parameter. Sechs Flächen brauchen es für Anker, die hinter Sheets wandern: `filter-reset` + fünf `filter-*` (Buchungen), `backup-create`/`backup-restore`/`encryption-setup` (Einstellungen), `debts-strategy` (Schulden), `accounts-add-cash` (Konten), `dashboard-flow`/`kpi-customize` (Übersicht), `budgets-edit` (Budgets), `upload`/`review`/`ownership` (CSV/Export). Der Buchungen-Entwurf empfiehlt das selbst als „eigenen, kleinen Commit VOR dem Umbau, damit er nicht mit fünf anderen Flächen in derselben Datei kollidiert".

**S7 — Wächter- und E2E-Infrastruktur.** `e2e-tests/fixtures/routes.ts` + `playwright.config.ts` auf Zwei-Dichten-Lauf, die Scrollhöhen-Messung gegen die Viewport-Höhe, dazu die drei Sammel-Testdateien, die mehreren Flächen gehören (`layout-overlap.sweep.test.tsx`, `screens.empty-state.test.tsx`, `screens.error-state.test.tsx`). Acht Entwürfe fragen „wer besitzt das" — Antwort: dieser Schritt.

**S8 (eigenständig, nicht sperrend) — App-weite Eingabe/Tastatur.** `index.html:6` `interactive-widget=resizes-content`, `src/components/ui/input.tsx` (`h-10` = 40 px, unter 44 px, und es ist das Hauptbedienelement von `/fragen`), `AndroidManifest.xml` `windowSoftInputMode`. Wirkt auf jede Fläche mit Eingabefeld und auf `AppShell.tsx:185` (`pb-[calc(5rem+…)]`). Muss vor **Fragen/Tutorials/Datenschutz** stehen, blockiert sonst niemanden — aber am Gerät nachmessen, nicht raten.

---

## (a) Was gefahrlos gleichzeitig laufen darf

**Immer parallel, ohne Einschränkung: Analyse, Messung und Entwurf für alle 12 Flächen.** Die zwölf vorliegenden Dokumente sind der Beweis — sie sind gemessen, nicht geraten, und keine zwei haben sich beim Lesen gestört.

**Bauen** dagegen nur in diesen Gruppen, nach S1–S7:

### Welle 1 — acht Flächen gleichzeitig, paarweise disjunkte Codedateien

| Fläche | Eigenes Gebiet | Warum kollisionsfrei |
|---|---|---|
| **Buchungen /transactions** | `features/transactions/**`, `src/components/dashboard/{TransactionStats,TransactionDayList}.tsx` | Datenschicht bereits sauber (0 useQuery in Seite und Presentation, alle 5 Abfragen im ViewModel). **Muss vor der Übersicht laufen**, weil sie die drei geteilten `src/components/dashboard/`-Dateien in ihre Slice zieht (Ratsche 11→9). |
| **Budgets /budgets + Liquidität /liquidity** | `src/components/budgets/**`, `src/components/dashboard/liquidity/**`, `ForecastPlanner`, `StressPresetQuickAdd`, `BudgetOptimizerPanel`, `DataQualityNotice`, `finrisk/**`, neue Slices `features/budgets`, `features/liquidity` | Liegt zwar in `src/components/dashboard/`, aber in **anderen Dateien** als Übersicht und Buchungen. Bedingung: `features/debts/domain/questions.ts` wird nur gelesen — `?mode=simulation` muss gelesen, nicht neu geschrieben werden. |
| **Einstellungen /settings** | `features/settings/presentation/**`, `src/components/settings/settings-gruppen.tsx` | Der sauberste Entwurf der Liste: props-getrieben, importiert **nichts** aus `src/components/settings/`, bewegt **keine** Ratsche (slice-presentation bleibt 11, view-data bleibt, 22 Abfragen bleiben liegen). Bedingung: der Komplettumzug von `src/components/settings/` bleibt aufgeschoben (er triebe die Ratsche 11→17). |
| **Steuer /tax, EÜR /euer, Export /export, CSV /csv** | `src/components/tax/**`, `src/components/euer/**`, `DataExport.tsx`, `CsvUploader.tsx`, `ReviewTable.tsx`, neue Slice `features/tax/{application,presentation}` | Nach S5 (TaxCategorySelect) berührt sie niemanden mehr. |
| **Konten /accounts + Verträge /contracts** | `src/components/accounts/**` (ohne `AccountCards.tsx`), `src/components/contracts/**`, `ContractsDashboard.tsx`, neue Slice `features/contracts` | Bedingung 1: `src/components/accounts/AccountCards.tsx` gehört der **Übersicht** (sie zieht es nach `features/dashboard/presentation/shared/`) — Konten fasst es nicht an. Bedingung 2: `['net-worth']` liegt nach S4 im gemeinsamen Modul. |
| **Meilensteine /milestones, Einkommen /income, Anlässe /occasions** | `src/components/income/**` (11 Dateien, müssen im selben Commit in `features/income/` ziehen), `features/special-categories/**`, neue Slice `features/milestones` | Bedingung: der Milestone-Schlüssel liegt nach S4 im gemeinsamen Modul, `MilestonesStrip` ist nach S3 entrahmt. Dann ist die einzige verbleibende Berührung zur Finanzstadt und zum Coach weg. |
| **Trading /trading, Analyse /premium, Abrechnung /billing** | `features/trading/**`, `features/billing/**`, `src/components/premium-dashboard/ResponsivePremiumDashboard.tsx`, neue Slice `features/analysis` | **Nur in Variante B.** Variante A zieht `SankeyChart.tsx`, `TimelineChart`, `HeatmapCalendar`, `WeeklyPatternCharts`, `SmartInsightsPanel` um und fasst damit `DashboardDesktopView.tsx`, `DashboardMobileStory.tsx`, `i18n-allowlist.json` und den Chunk `sankey` an — dann darf Trading **nicht** parallel zur Übersicht laufen. Variante A ist zu verwerfen. Ebenso bleibt `src/lib/analysis-data.ts` (`resolveHierarchy` vs. `topKategorien`) außerhalb dieses Auftrags — die Datei gehört Übersicht und Buchungen mit. |
| **Finanzstadt /city** | `features/finance-city/**`, `src/pages/CityPage.tsx` | Einzige Fläche mit `konfliktrisiko: gering`. 0 Abfragen in der Darstellung, 0 `<Card>`/`bg-card`, kein Beitrag zu view-data, slice-presentation unberührt. Bedingung: der Shared-Element-Übergang `layoutId='dashboard-city-link'` bekommt sein neues Gegenstück **in der Stadt** (Kontext-Zeile), `src/components/dashboard/Dashboard.tsx:159` wird nicht angefasst. |

**Fragen /fragen, Tutorials /tutorials, Datenschutz /privacy** läuft ebenfalls in Welle 1, sobald **S8** steht. Eigenes Gebiet: `features/money-questions/**`, `features/tutorials/**`, neue Slice `features/privacy` samt `src/components/privacy/AnalyticsTransparencyPreview.tsx`. Regel gegen Meilensteine/Anlässe: `features/special-categories/domain/questions.ts` (sechs tote Deep-Links auf `/special-categories?event=`) gehört **Anlässe**, `features/money-questions/**` gehört **Fragen**; die Invariante in `question-registry.ts` und `question-catalog.test.ts` schreibt der Integrator.

**Nav-Rest** (Bodennavigation 3+Mehr, `?ziele=offen`, Werkzeugzeile unter die Zielliste) läuft ebenfalls in Welle 1 — nach S3 fasst er nur noch `src/components/layout/**` an und niemand sonst.

### Welle 2 — die zwei Flächen, die auf Welle 1 warten

| Fläche | Wartet auf | Warum |
|---|---|---|
| **Übersicht /dashboard** | **Buchungen** | Vier geteilte Dateien: `TransactionFilters.tsx` (beide wollen `useRangeLabel` heraus), `TransactionStats.tsx`, `TransactionDayList.tsx`, `TransactionDetailsPanel/Modal` (`Dashboard.tsx` ist ihr Wirt). Dazu die Ratsche: Buchungen rechnet 11→9 durch den Umzug von zwei Dateien, die Übersicht rechnet 11→5 durch den Umzug von `AdvancedBalanceChart`, `AccountCards`, `SankeyChart`. Beide gegen 11 gleichzeitig geht nicht. |
| **Schulden /debts + Nettovermögen /net-worth** | **Konten/Verträge** | `['net-worth']`, `getNetWorthBreakdown` und die `manualAssets`-Korrektur: Konten zeigt `netWorth.cash` und `netWorth.accountBalances`, Nettovermögen ändert die Zusammensetzung derselben Antwort (Sachwerte, `netWorth.composition`). Zwei gleichzeitige Umbauten an derselben Rechnung sind genau der Fall von ADR Regel 1. |

---

## (b) Reihenfolge der serialisierten Arbeiten und die erzwingende Abhängigkeit

| # | Arbeit | Erzwungen durch |
|---|---|---|
| 1 | **ADR-Präzisierung** `docs/architecture/darstellungsdichte.md` + Parameter-, Zurücktasten- und Messkonvention | Es ist das Maß, gegen das alle zwölf gebaut werden. Ohne (a) „Visualisierung = eine Aussage" ist Regel 9 auf keiner Fläche mit Diagramm anwendbar; ohne die Parameterkonvention stehen nach dem Merge acht verschiedene Namen in geteilten Adressen. |
| 2 | **134 i18n-Schlüssel in einem Commit** (de/en/ru/tlh + everyday-Overlays) | `locale-parity.test.ts` vergleicht blattweise gegen de, `overlay-coverage.test.ts` prüft Existenz und Mindestumfang. Zwölf gleichzeitige Schreiber in vier Dateien produzieren nur Konflikte. Die Entwürfe liefern die Schlüssel bereits fertig. |
| 3 | **`features/shared/presentation/` boxlos** — PageHeader-Dichteweiche (+ `CoachFokussiert` h1, `CoachPage`), StatHero, InfoGroup, ListRow, MilestonesStrip, neuer Detail-Sheet-Baustein + `useDetailParam` | PageHeader hängt an 12 Seiten gleichzeitig; StatHero/InfoGroup/ListRow werden von je 2–4 Flächen gebraucht; elf Flächen bauen sonst elfmal dasselbe Sheet. |
| 4 | **Geteilte Query-Schlüssel** nach `features/shared/data/finance-query-keys.ts` | Ein abweichender Schlüssel führt still zwei Caches. Nach diesem Schritt sind Meilensteine↔Finanzstadt und Konten↔Nettovermögen entkoppelt (bis auf die Rechnung selbst). |
| 5 | **Bausteine an ihren Zielort** — TaxCategorySelect, AusgabenklasseFilter, PremiumUpsell/PremiumTeaser, `useRangeLabel` | `slice-presentation-budget.json` steht auf 11 und darf nur sinken. Jede Fläche, die diese Dateien am alten Ort importiert, hebt sie und wird von der Ratsche verurteilt, für die sie gebaut wurde (Lehre aus WP 6.2/6.3). |
| 6 | **`src/lib/tutorial-steps.ts`** (`openAnchor`, Ziel mit Query-Parameter) | Sechs Flächen schieben Anker hinter Sheets; ADR Regel 5 verlangt jeden Anker in beiden Dichten. Sechs gleichzeitige Editoren in einer Datei. |
| 7 | **E2E/Wächter-Infrastruktur** — routes.ts, playwright.config.ts, vertical-slice-Fixture, die drei Sammel-Tests | Der Scroll-Nachweis ist in jsdom nicht führbar; acht Entwürfe stellen dieselbe Frage. Ein Besitzer statt acht Antworten. |
| 8 | **Welle 1** (8–9 Flächen parallel) | siehe oben |
| 9 | **Welle 2** — Übersicht (nach Buchungen), Nettovermögen/Schulden (nach Konten) | geteilte Dateien und geteilte Rechnung |
| 10 | **Ratschen und Bündelgrößen nachziehen** — card-rule, view-data, slice-presentation, bundle-size, touch-target, platform-parity, state-coverage, query-error | Je EINE Zahl für den ganzen Baum. Flächen liefern ihr gemessenes Delta, der Integrator schreibt. `bundle-size-budget.json` `totalGzipBytes` ist die eine Zeile, die **jede** Fläche anfasst; sie braucht ohnehin einen `pnpm build` mit echten Zahlen statt Schätzungen. |
| 11 | **Gerätelauf und Abnahme** | Der Beleg für Regel 9 ist laut ADR ein Bildschirmfoto vom Gerät plus eine Playwright-Messung — kein grüner Haken. Dazu die ungemessenen Punkte: Tastaturverhalten unter Capacitor 8 / Android 15, `CityPage`-Chunk (178 kB, ob die Dichteteilung ihn wirklich senkt, ist nicht gemessen), Kopfhöhe 56 px in fokussiert. |

**Ausdrücklich NICHT in diesen Plan** (eigene Aufträge, sonst blockieren sie alles): Auflösung des CSS-Verzweigens im Rahmen (Regel 6, `md:hidden` → lazy je Dichte); Nachschärfen von `check:card-rule` (schweigt bei `/privacy` wegen eines `<Link>`, nimmt `InteractiveCard` aus, obwohl 26 Kapitel auf `/tutorials` und je ein Anlass auf `/occasions` Regel 10 verletzen); Vereinheitlichung von `src/lib/analysis-data.ts`; Zerlegung von `ReceivablesPanel` (9 Datenzugriffe); Tief-Verlinkbarkeit von Welt und Ebene der Finanzstadt.

---

## (d) Die drei Flächen mit dem größten Nutzen je Aufwand

**1. Navigation und App-Rahmen** — `src/components/layout/` (AppShell 200 + BottomNav 65 + MobileNav 133 + nav-config 271 = **669 Zeilen**, vier Dateien).
Kleinster Dateisatz, größte Reichweite: der Rahmen läuft auf **allen 25 Routen** mit und verbraucht dort Platz, bevor die Fläche etwas sagen darf. Er löst zentral, was sonst 12 Einzelmigrationen wären — **12 der 25 Flächen** tragen ihren Namen heute ausschließlich im Kopf (`/dashboard`, `/settings`, `/accounts`, `/city`, `/contracts`, `/csv`, `/export`, `/fragen`, `/premium`, `/occasions`, `/trading`, `/simulation`), 13 tragen ihn doppelt. Nachrechenbar: Bodennavigation 5 → 4 Slots ergibt **90 statt 72 px je Tab** auf 360 dp, Beschriftung von `text-[11px]` (exakt auf der Grenze von `check:type-scale`) auf `text-xs`. Und der Preis ist niedrig, weil die Fläche **0 Kartenrahmen** und **0 Abfragen in der Darstellung** hat: `card-rule-budget.json` und `view-data-budget.json` bleiben unberührt.

**2. Buchungen /transactions** — `src/pages/TransactionsPage.tsx` (177 Zeilen), `features/transactions/**`.
Die einzige Fläche, deren Datenschicht **bereits fertig** ist: **0** `useQuery`/`useMutation` in Seite und Presentation, alle fünf Abfragen im ViewModel. Der Umbau braucht **keine** Änderung am ViewModel und **keine** neue Abfrage — reine Präsentationsarbeit. Gemessener Gewinn: über der Liste stehen heute PageHeader (~70 px) + Suchfeld (~56) + Filterzeile (~56) + Kennzahlenbox (~230) = **rund 410 px** vor der ersten Buchungszeile, danach h1 (~24) + eine Zahl (~90) + eine Bedienzeile (~56) = **rund 170 px**. **6 Aussagen → 2**. Dazu senkt ein rein mechanischer Umzug zweier Dateien (`TransactionStats.tsx`, `TransactionDayList.tsx` — nachgemessen **kein** anderer Importeur außer Tests, und sie bringen keine neuen gezählten Importe mit) `slice-presentation-budget.json` von **11 auf 9**.

**3. Einstellungen /settings** — `src/pages/SettingsPage.tsx` (8 Zeilen), `features/settings/presentation/`.
Der höchste Boxen-Ertrag der Liste bei **null Ratschenbewegung**: **33 gemessene Kartenrahmen** in vier Dateien, **60** `<Card>`-Vorkommen über 10 Dateien, **11 gleichzeitige Abschnitte** werden zu **2 Aussagen** und einem Verzeichnis aus 10 Zeilen (≈640 px, passt ohne die Listen-Ausnahme). Entscheidend für Nutzen/Aufwand: der Entwurf ist props-getrieben gebaut, importiert **nichts** aus `src/components/settings/` und lässt deshalb `slice-presentation-budget.json` bei 11, `view-data-budget.json` unverändert (die 22 Abfragen bleiben liegen, wo sie sind — jede Untergruppe landet vollständig hinter genau einem Schritt) und `card-rule maxFokussiert` bei 2. **Keine Datei muss umziehen.** Der einzige echte Preis sind zwei E2E-Specs (`local-encryption.spec.ts`, `backup-roundtrip.spec.ts`), die einen Schritt „Gruppe öffnen" brauchen.

*Knapp dahinter:* **Finanzstadt /city** — einzige Fläche mit `konfliktrisiko: gering`, 0 Abfragen in der Darstellung, 0 `<Card>`, Slice und Datenschicht bereits korrekt, nur zwei echte Boxen fallen (`CityPage.tsx:70`, `CityContractSheet.tsx:57`), Aussagen 5–8 → 3. Ihr eigentlicher Wert liegt aber im Vorlauf: Ihr Entwurf liefert die ADR-Präzisierung aus Schritt 1, von der **jede** Fläche mit Diagramm abhängt.

*Am anderen Ende:* **Übersicht /dashboard** und **Schulden/Nettovermögen** haben das schlechteste Verhältnis — beide `hoch`/`L`, beide mit den meisten Fremddateien (Übersicht: 3 Komponentenumzüge, 3 Testpfade, 4 E2E-Dateien, eine Auftraggeber-Entscheidung zum Kontostand, die aufgehoben werden muss; Schulden/Nettovermögen: **zehn** Dateien aus `src/components/debts|networth/`, ein kompletter neuer Slice für `/net-worth`, 21 Datenzugriffe) und beide in Welle 2. Sie zuerst zu starten hieße, den Rest auf sie warten zu lassen.
