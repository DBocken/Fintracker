# Performance: Ist-Zustand & Roadmap

Dieses Dokument beschreibt den **tatsächlichen** Performance-Zustand der App
(Stand: August 2026) — was bereits skaliert und wie der frühere
Single-Blob-Engpass seit WP 4.1 gelöst ist (Entscheidung und Messung:
`docs/architecture/transaction-storage-chunks.md`).

> Historie: Eine frühere Version dieses Dokuments beschrieb
> `VirtualizedTransactionTable.tsx`/`OptimizedTransactionTable.tsx` auf
> react-window-Basis — diese Komponenten haben nie im Repo existiert.
> react-window wurde entfernt; die reale Virtualisierung läuft über
> `@tanstack/react-virtual` (siehe unten).

---

## Was bereits skaliert

### Listen-Virtualisierung (TransactionDayList)
- `src/components/dashboard/TransactionDayList.tsx` fenstert ab
  ~150 Items mit `useWindowVirtualizer` (`@tanstack/react-virtual`):
  gerendert wird nur der sichtbare Ausschnitt des Seiten-Scrolls, Headings und
  Zeilen als flache Item-Liste (`flattenDayGroups` in
  `transaction-day-groups.ts`).
- Kleine Listen rendern klassisch (semantisches `ul/li`, kein Mess-Overhead).
- Abgesichert durch `TransactionDayList.perf.test.tsx`: 10.000 synthetische
  Buchungen (`@/test-utils/synthetic-transactions`) → DOM-Knoten < 300.

### Rechenintensives in Web Workern
- Monte-Carlo/FinRisk: `src/workers/finrisk-scenario.worker.ts`,
  `src/workers/affordability.worker.ts` (via `useScenarioRisk`/`useAffordability`).
- OCR nutzt Tesseract-/pdfjs-interne Worker (`letter-ocr-service`, `ocr-service`).

### Bundle-Disziplin
- ~20 Routen lazy via `React.lazy` (`src/App.tsx`).
- Schwere Libs dynamisch importiert: `tesseract.js`, `pdfjs-dist` (+Worker),
  `jspdf`(+autotable), `html-to-image`, `qrcode`.

### Caching & Memoisierung
- react-query mit `staleTime` 5 min, kein Refetch on focus (`src/main.tsx`).
- Dashboard-Aggregationen und Forecast (`useForecast`) in `useMemo`.

### Sortierung: eine Schicht, ein Contract
- Die Storage-Schicht sortiert datum-absteigend **vor** dem Limit
  (`transaction-storage-service.getTransactions`) — sonst verlöre ein Limit
  die jüngsten Buchungen.
- Service (`transaction-service.getTransactions`/`getTransactionsPaginated`)
  und UI (`TransactionsPage`) sortieren **nicht** erneut; `filterTransactions`
  ist ordnungserhaltend. Gepinnt durch
  `transaction-service.ordering.test.ts` und
  `src/features/shared/domain/__tests__/dashboard-filtering.test.ts`.

### Auto-Kategorisierung: einmal vorbereiten statt je Buchung

`createCategorizer(categories, learnedRules)` (`src/lib/categorization.ts`) baut
den Kategorie-Index EINMAL und kategorisiert danach beliebig viele Buchungen.
Alle Schleifen-Aufrufer nutzen diese Form: `recategorizeTransactions`,
`applyAutoCategorization`, `getCategoryPreview`, `getTopCategorySuggestion`
(`transaction-service.ts`), der GoCardless-Sync, die CSV-Review-Vorschau
(`review-preview.ts`) und die Vorschlagsliste (`automation-suggestions.ts`).
`explainCategorization(tx, categories, rules)` bleibt als Einzelfall darüber —
für den Beleg-Scan und die Detailansicht, die genau eine Buchung ansehen.

Vorher lagen zwei Aufbereitungen im innersten Vergleich statt davor:

- der Kategorie-Index (`byId`-Map + Auflösung der Einkommens-Kategorien über die
  Elternkette) wurde je Buchung neu gebaut;
- `matchesKeyword` schrieb bei **jedem** Aufruf beide Seiten klein und prüfte die
  Buchstaben-Regex neu — bei 200 Kategorien × 3 Filtern × 4 Textfeldern
  2 400-mal je Buchung dasselbe Ergebnis. `prepareKeyword()` /
  `matchesPreparedKeyword()` (`src/lib/keyword-match.ts`) trennen das jetzt:
  Keyword einmal je Filter, Buchungstext einmal je Buchung.

Gemessen (best-of-5, Reihenfolge je Runde getauscht, jsdom/Node 22):

| Bestand | vorher | nachher | Faktor |
|---|---|---|---|
| 3 000 Buchungen × 80 Kategorien | 170 ms | 105 ms | 1,63× |
| 3 000 Buchungen × 200 Kategorien | 426 ms | 252 ms | 1,69× |
| 10 000 Buchungen × 200 Kategorien | 1 384 ms | 836 ms | 1,65× |

**Der Faktor ist über alle drei Formen gleich — und das ist die Aussage:**
Verbessert wurde die Konstante, nicht die Klasse. Das Filter-Matching bleibt
`Buchungen × Kategorien × Filter`. Ein invertierter Index über die Filter wäre
der nächste Schritt und ist **bewusst nicht** gegangen: lange Keywords matchen
als Substring (`e.on`, `trade republic`), das lässt sich nicht auf ein
Wort-Nachschlagen abbilden, ohne die Trefferregel zu ändern — und die Trefferregel
entscheidet, in welche Kategorie eine Buchung fällt. Der Standard-Kategoriebaum
umfasst 110 Einträge (`DEFAULT_LOCAL_CATEGORIES`), der reale Fall liegt damit
zwischen den ersten beiden Zeilen — Größenordnung 0,04 ms je Buchung. Das trägt,
bis es gemessen nicht mehr trägt.

Abgesichert durch zwei Tests mit unterschiedlicher Aufgabe:
`src/lib/__tests__/categorizer.test.ts` zählt die **Zugriffe** auf die
Kategorien und verlangt, dass ihre Zahl nicht von der Zahl der Buchungen abhängt
(ohne Uhr, damit nichts flackert); `categorizer.perf.test.ts` hält ein absolutes
Budget für den Vollauf (3 000 × 200 unter 1 500 ms, gemessen ~320 ms).

---

## Gelöster Haupt-Engpass: vom Single-Blob zu Quartals-Chunks (WP 4.1)

Bis WP 4.1 lag der gesamte Transaktionsbestand als **ein** (optional
verschlüsselter) JSON-Blob unter `ausgabentracker_transactions_v3` — jeder
Read entschlüsselte alles, jede Einzel-Mutation schrieb und verschlüsselte
alles neu (O(n) pro Edit). Seit WP 4.1c liest und schreibt
`transaction-storage-service.ts` über die Chunk-Ablage
(`transaction-chunk-store.ts`): Schlüssel
`ausgabentracker_transactions_v4_YYYY-Qn` plus `…_v4_index`, je Chunk ein
`EncryptedEnvelopeV1` über die unveränderte `localEncryption`-Schicht. Eine
Einzeländerung berührt nur noch das betroffene Quartal — gemessen bei 5 000
Buchungen mit Verschlüsselung: **46,7 ms → 3,8 ms**. Der v3-Blob ist nur noch
der Legacy-Zweig bis zur Migration (nummerierter Schritt
`transactions-blob-to-quarter-chunks` in `local-store-migrations.ts`).

- `getTransactionsPaginated` bleibt bewusst **kein** Storage-Paging, sondern
  In-Memory-Filter+Slice (siehe JSDoc dort).
- **Monats**-Chunks waren die ursprüngliche Vorgabe und wurden gemessen
  verworfen (kaltes Vollesen 1,76×–2,84× statt der 1,5×-Grenze);
  Per-Record-Verschlüsselung ebenso (Metadaten-Leak an jeden mit
  Gerätezugriff, ~10k WebCrypto-Ops je Import/Restore). Entwurf, Messung und
  Verworfenes vollständig in `docs/architecture/transaction-storage-chunks.md`.

---

## Was hier NICHT gilt

`MAX_TRANSACTIONS_LOCAL = 10000` stand bis August 2026 in `src/lib/constants.ts`
und wurde **nirgends gelesen** — nicht in `src/`, nicht in `api/`, nicht in einem
Test. Der Bestand ist nicht gedeckelt. Wer eine Laufzeit-Überlegung auf „n ist ja
begrenzt" stützt, stützt sie auf nichts: Bankanbindung über mehrere Jahre und
zwei Konten geht an dieser Zahl vorbei, ohne dass irgendetwas rot wird. Die
Konstante ist entfernt; was den Bestand tatsächlich trägt, sind die
Quartals-Chunks und die Virtualisierung oben.

## Mess- & Testinfrastruktur

- Laufzeit-Metriken: `src/lib/performance.ts` + `PerformanceDashboard`
  (Einstellungen → Technischer Status).
- Perf-Smoke-Tests: `src/components/dashboard/__tests__/TransactionDayList.perf.test.tsx`
  mit deterministischer Factory `src/test-utils/synthetic-transactions.ts`.
- Chunk-Ablage: `src/services/__tests__/transaction-storage-service.perf.test.ts`
  — die drei ADR-Zahlen am echten Service (5 000 Buchungen, Verschlüsselung
  an), mit hartem Verhältnis-Gate ≤ 1,5× für das kalte Vollesen.
- Coverage-Thresholds + 20s-testTimeout: `vitest.config.ts`.
