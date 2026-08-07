# Performance: Ist-Zustand & Roadmap

Dieses Dokument beschreibt den **tatsächlichen** Performance-Zustand der App
(Stand: Juli 2026) — was bereits skaliert, wo die realen Engpässe bei
wachsenden Datenmengen liegen und was als Nächstes geplant ist (Phase B).

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
  `transaction-service.ordering.test.ts` und `filter-utils.test.ts`.

---

## Bekannter Haupt-Engpass: Single-Blob-Storage

Transaktionen liegen als **ein** (optional verschlüsselter) JSON-Blob unter
`ausgabentracker_transactions_v3` im IndexedDB-KV-Store (`idb-kv.ts`):

- Jeder Read entschlüsselt + parst den **gesamten** Bestand.
- Jede Einzel-Mutation (Update/Delete) schreibt den **gesamten** Bestand neu
  (Read-Modify-Write inkl. Re-Encrypt) → O(n) pro Edit.
- `getTransactionsPaginated` ist bewusst **kein** Storage-Paging, sondern
  In-Memory-Filter+Slice (siehe JSDoc dort).

Bei heutigen Datenmengen ist das unkritisch (IndexedDB statt localStorage,
persistenter Speicher via `requestPersistentStorage`). Ab ~10k+ Buchungen wird
der Blob-Decrypt/Re-Encrypt zum messbaren Kostenfaktor.

---

## Phase B (geplant, separater PR): Monats-Chunk-Storage

**Empfehlung: monatliche verschlüsselte Chunk-Blobs — NICHT Per-Record-Verschlüsselung.**

- Per-Record-Envelopes mit Plaintext-Indexfeldern würden Datums-/Kadenz-
  Metadaten an jeden mit Gerätezugriff leaken (Regression der
  Verschlüsselungs-Posture) und bedeuten ~10k WebCrypto-Ops bei Import/Restore.
- Monats-Chunks (`ausgabentracker_transactions_v4__YYYY-MM`, je ein
  `EncryptedEnvelopeV1` über die unveränderte `localEncryption`-Schicht):
  - O(Monat) statt O(alles) pro Write,
  - natürliches datum-absteigendes Cursor-Paging über Monats-Keys
    (deckungsgleich mit der Sortierung aller Consumer),
  - Metadaten-Leak begrenzt auf „welche Monate haben Daten".
- Migration v3→v4 nach dem verified-write-then-delete-Muster von
  `migrateLocalStorageToIdb`; Cross-Month-Operationen (Import-Dedupe) brauchen
  einen Known-IDs-Index-Chunk.
- Hinweis: der Legacy-Prefix `ausgabentracker_transactions_v2__` in
  `idb-kv.ts` stammt aus einem früheren Chunk-Schema — Migrationshistorie vor
  der Umsetzung prüfen.

**Auslöser:** erst umsetzen, wenn reale Datenmengen den Blob-Decrypt messbar
schmerzen lassen (Diagnose: Einstellungen → Technischer Status →
Performance-Dashboard).

---

## Mess- & Testinfrastruktur

- Laufzeit-Metriken: `src/lib/performance.ts` + `PerformanceDashboard`
  (Einstellungen → Technischer Status).
- Perf-Smoke-Tests: `src/components/dashboard/__tests__/TransactionDayList.perf.test.tsx`
  mit deterministischer Factory `src/test-utils/synthetic-transactions.ts`.
- Coverage-Thresholds + 20s-testTimeout: `vitest.config.ts`.
