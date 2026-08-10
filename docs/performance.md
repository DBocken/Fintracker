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

## Mess- & Testinfrastruktur

- Laufzeit-Metriken: `src/lib/performance.ts` + `PerformanceDashboard`
  (Einstellungen → Technischer Status).
- Perf-Smoke-Tests: `src/components/dashboard/__tests__/TransactionDayList.perf.test.tsx`
  mit deterministischer Factory `src/test-utils/synthetic-transactions.ts`.
- Chunk-Ablage: `src/services/__tests__/transaction-storage-service.perf.test.ts`
  — die drei ADR-Zahlen am echten Service (5 000 Buchungen, Verschlüsselung
  an), mit hartem Verhältnis-Gate ≤ 1,5× für das kalte Vollesen.
- Coverage-Thresholds + 20s-testTimeout: `vitest.config.ts`.
