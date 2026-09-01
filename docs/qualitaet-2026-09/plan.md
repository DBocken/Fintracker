# Plan: Kritische Design-Schwächen beheben (Fintracker)

## Context

Ein Audit (4 parallele Prüfungen: Datenschicht/Krypto, Sync/Import, Auth/Entitlements, Architektur) hat drei verifizierte Schwächen gefunden, die **lautlos Zahlen verfälschen oder Buchungen verlieren**. Keine ist eine Sicherheitslücke; alle drei sind heute Codeänderungen und werden nach weiteren Importen zur Datenbereinigung bei Bestandsnutzern.

| # | Befund | Beleg |
|---|---|---|
| F1 | Chunk-Schreibpfade (save/update/delete pro Quartal) machen Lesen → `await` → Schreiben **ohne `withKeyLock`**; nur der Index ist gesperrt. Der Wächter `check:store-serialization` kennt die Familie nicht und ist grün. Zusätzlich installiert ein laufendes Lesen nach einem konkurrierenden Schreiben veraltete Daten in den Chunk-Cache | `src/services/transaction-storage-service.ts:411-459, 477-537`, `transaction-chunk-store.ts:~176, ~274`, `scripts/store-serialization-core.mjs:49-74` |
| F2 | `getTransactions(limit)` sortiert absteigend und schneidet ab. ~45 Aufrufer wählen literale Limits (500/1000/2000/5000/10000); **niemand prüft, ob es griff**. Folgen ab größerem Bestand: Naive Bayes trainiert auf 1.000 Buchungen, Vertragserkennung sieht keine Jahresverträge, Steuer/EÜR-Summen falsch, Kategorie-Remap überspringt Buchungen jenseits der 10.000 jüngsten | `transaction-storage-service.ts:184, :340, :541`, `useCategoryModel.ts:37`, `ContractsDashboard.tsx:51`, `TaxReportPage.tsx:47`, `EuerPage.tsx:51`, `lib/constants.ts:30` |
| F3 | Import nicht idempotent: CSV-ID enthält den **Zeilenindex** → überlappende Exporte duplizieren alles. GoCardless-Dedup-Fenster = 5.000 jüngste Buchungen, Edge Function zieht 730 Tage → ältere Bankzeilen werden bei jedem Sync neu angelegt | `csv-service.ts:187-196`, `gocardless-sync-service.ts:288-292` |

Kleinere Härtungen (WP7): Snapshot-Import ersetzt lokale Daten ohne Rückfrage, `enable()` schreibt Config vor Prüfblob, `idbSet` schluckt fehlendes IndexedDB als No-op und die Lazy-Migration löscht dann die einzige Kopie.

**Nicht in diesem Plan** (bewusst, eigene Entscheidung des Auftraggebers): Premium nur clientseitig (`tier.ts:100-150`), 14 parallele Query-Keys (Phase 2 nach WP4), Money-Questions-Gates als eigene Pipeline-Stufe, Webhook-Atomarität/Rate-Limit im EntitlementService.

Verbindlich: AGENTS.md (TDD, Tests nur in `__tests__/`, deutsche Testtitel, `[REGRESSION]`/`[INTEGRITY]`/`[SECURITY]`-Tags, Absicht vor Auftrag). Reihenfolge WP1 → WP2 → WP3 → WP4 → WP5 → WP6; WP7 unabhängig. Je WP ein eigener Commit mit Ziel + Testabdeckung in der Nachricht.

> **Prüfung des Plans gegen den Code, 2026-09-01.** Sechs Stellen tragen einen
> eingerückten Kasten (`KORREKTUR` / `ERGÄNZUNG` / `GRENZE` / `AUFLAGE`); sie
> gehen dem umgebenden Absatz vor. Der schwerste Fund steht in **WP1**: die
> dort beschriebene Umsetzung verklemmt jeden Schreibvorgang auf jeder
> Installation ohne v3-Blob dauerhaft, und die drei genannten Tests würden das
> nicht rot melden, sondern hängen. Die übrigen: ein dritter, ungesperrter
> Chunk-Schreiber, den der neue Wächter per Vokabular nicht sieht (WP2) · ein
> Wächter, dessen Reichweite die Hälfte der eigenen Umbauten auslässt (WP4) ·
> die Laufzeit-Multiplikation aus WP1 + WP4 + WP6 · ein Idempotenz-Grenzfall,
> den der Vorkommenszähler nicht lösen kann (WP6) · eine Verhaltensänderung an
> einer Datengrenze ohne benannten Fänger (WP7.2).

---

## WP1 — Chunk- und Legacy-Schreibpfade serialisieren (F1) — M

**Dateien:** `src/services/transaction-storage-service.ts`, `src/services/local-storage-keys.ts` (neu: `TRANSACTION_STORE_LOCK_KEY`).

**Entscheidung:** EIN store-weiter Lock-Key statt Lock pro Quartal. Grund: `save` dedupliziert per `knownIds` über alle Quartale, `update` mit Datumsänderung berührt zwei Chunks. AGENTS.md: Dubletten-Prüfungen gehören INNERHALB des Locks. Schreibvorgänge sind selten, Quartals-Parallelität bringt nichts.

**Tests zuerst** (`src/services/__tests__/transaction-storage-service.chunk-mode.test.ts`, neues `describe('[REGRESSION] Serialisierung der Chunk-Schreibpfade')`):
- `[REGRESSION] sollte bei zwei gleichzeitigen saveTransactions im selben Quartal beide Buchungen behalten` (`Promise.all([save([a]), save([b])])`)
- `[REGRESSION] sollte gleichzeitiges update und delete verschiedener Buchungen desselben Quartals nicht gegenseitig überschreiben`
- `[REGRESSION] sollte ein Quartalswechsel per update nicht mit einem gleichzeitigen save kollidieren`
- Legacy v3 (`transaction-storage-service.security.test.ts`, v3-Block mit `LOCAL_TRANSACTIONS_KEY` geseedet): gleiche Zwei-Saves-Prüfung.

**Umsetzung:** `withKeyLock` aus `@/lib/key-mutex`; den **gesamten Rumpf** der sechs Methoden (`saveLocalTransactionsChunked`, `updateLocalTransactionChunked`, `deleteLocalTransactionChunked`, `saveLocalTransactions`, `updateLocalTransaction`, `deleteLocalTransaction`) in `withKeyLock(TRANSACTION_STORE_LOCK_KEY, …)` legen, inkl. `readAllTransactionChunks`/`knownIds`/`find`-Vorspann. Index-Lock (`INDEX_KEY` in `mutiereIndex`) bleibt; andere Keys, Schachtelung ist sicher (`withKeyLock` ist nicht reentrant, aber die Keys unterscheiden sich).

> **KORREKTUR (Prüfung 2026-09-01): So umgesetzt verklemmt sich die App beim
> ersten Schreibvorgang — dauerhaft.** Die drei Legacy-Methoden delegieren in
> ihrer **ersten Zeile** an ihre Chunk-Schwester:
> `transaction-storage-service.ts:412` (`saveLocalTransactions` →
> `saveLocalTransactionsChunked`), `:429`, `:449`, jeweils
> `if (!(await hasLegacyV3Blob())) return this.…Chunked(…)`. Legt man **alle
> sechs** Rümpfe auf **denselben** Schlüssel, nimmt die äußere Methode den Lock
> und ruft die innere, die auf denselben Schlüssel wartet — auf einen Ablauf,
> der erst endet, wenn sie selbst fertig ist. `withKeyLock` ist nicht
> reentrant (`lib/key-mutex.ts`: der neue Ablauf hängt sich an den vorherigen),
> also löst sich das nie auf. Betroffen ist der **Normalfall**, nicht der
> Randfall: Ohne v3-Blob — jede frische Installation — greift die Delegation
> bei jedem Speichern, Ändern und Löschen. Der Satz „Schachtelung ist sicher,
> die Keys unterscheiden sich" gilt für Store-Lock gegen Index-Lock; hier
> schachtelt derselbe Key in sich selbst.
>
> **Stattdessen:** Der Lock gehört an **genau eine** Ebene. Zwei tragfähige
> Formen, im PR eine davon begründet wählen:
> 1. **Nur die drei Chunk-Methoden sperren**, die Legacy-Methoden ungesperrt
>    lassen, solange sie nur delegieren — und ihren v3-Rumpf in einen eigenen,
>    lokal gerufenen Helfer ziehen, der ebenfalls unter demselben Lock läuft
>    (die Delegation entscheidet sich dann **vor** dem Lock).
> 2. **Am gemeinsamen Einstieg sperren** (`:200`, `:215`, `:230` — die
>    öffentlichen Methoden, die auf die Legacy-Ebene zeigen); dann liegt der
>    Lock über beiden Zweigen und darunter gar keiner.
> Form 1 ist die kleinere Änderung, Form 2 die, die auch künftige
> Delegationen erschlägt. Beide brauchen denselben Test: **zwei gleichzeitige
> Aufrufe müssen zurückkehren** — ein Deadlock-Test mit Zeitschranke
> (`[REGRESSION] sollte bei zwei gleichzeitigen Speichervorgängen ohne
> v3-Blob nicht verklemmen`) gehört in die Testliste oben, denn die drei
> dortigen Tests wären bei einem Deadlock nicht rot, sondern würden
> **hängen**.

Lesepfade nicht sperren.

## WP2 — Wächter-Familien für Buchungs-Chunks und v3-Blob (F1) — S

**Dateien:** `scripts/store-serialization-core.mjs` (`FAMILIEN`), `scripts/__tests__/store-serialization-core.test.mjs`, AGENTS.md-Zeile `check:store-serialization` (4 → 6 Familien).

**Tests zuerst:**
- `sollte die Buchungs-Chunk-Familie kennen (readTransactionChunk → writeTransactionChunk ohne Lock)`
- `sollte readAllTransactionChunks gefolgt von writeTransactionChunk als Paar werten`
- `sollte den v3-Blob (getLocalTransactions → setLocalTransactions) als Familie kennen`
- `sollte schweigen, wenn der Chunk-Ablauf in withKeyLock steht`

**Umsetzung:** zwei Einträge: `{ name: 'Buchungs-Chunks', lesen: ['readTransactionChunk','readAllTransactionChunks'], schreiben: ['writeTransactionChunk'], hinweis: 'Gesamten Ablauf in withKeyLock(TRANSACTION_STORE_LOCK_KEY, …) legen — inkl. Dubletten-/Quartalssuche.' }` und `{ name: 'Buchungs-Blob (v3)', lesen: ['getLocalTransactions'], schreiben: ['setLocalTransactions'] }`.

> **ERGÄNZUNG (Prüfung 2026-09-01): Ein dritter Schreiber bleibt unsichtbar.**
> `local-store-migrations.ts:102` schreibt Chunks (`writeTransactionChunk` je
> Quartal) **ohne** Lock, und der Wächter wird ihn auch nach WP2 nicht melden:
> Gelesen wird dort über `readLegacyV3Transactions`, das in keiner der beiden
> Leseverben-Listen steht. Der Lauf startet in `App.tsx`, sobald der Tresor
> entsperrt ist — also potenziell parallel zu einem Schreibvorgang der
> Oberfläche, und er überschreibt ganze Quartale aus dem v3-Blob. Das ist
> genau die Familie, gegen die WP1 antritt.
> **Zu entscheiden und im PR zu benennen** — eines von beidem, nicht keines:
> entweder `readLegacyV3Transactions` in die Leseverben aufnehmen und den
> Migrationsschritt unter denselben Lock legen, oder die Ausnahme ausdrücklich
> begründen (etwa: der Läufer hält seinerseits eine Schranke, die verhindert,
> dass nebenher geschrieben wird) und diese Begründung im Wächter-Hinweis
> festhalten. Eine Familie, die den dritten Schreiber per Vokabular nicht
> sieht, misst weniger, als ihr Name verspricht. Vor dem WP1-Commit lokal einmal laufen lassen und im PR belegen, dass der Wächter rot wird; nach WP1 grün.

## WP3 — Generationszähler für den Chunk-Cache (F1) — S

**Datei:** `src/services/transaction-chunk-store.ts`.

**Tests zuerst** (`src/services/__tests__/transaction-chunk-store.test.ts`):
- `[REGRESSION] sollte nach einem Schreibvorgang während eines laufenden Vollesens keinen veralteten Chunk in den Cache legen` (`localEncryption.loadAndMaybeDecrypt` mit deferred Promise für Quartal Q; währenddessen `writeTransactionChunk(Q,[x])`; auflösen; `readTransactionChunk(Q)` muss `[x]` liefern)
- dasselbe für den Pfad `readTransactionChunk`.

**Umsetzung:** `cacheGeneration: Map<QuarterKey, number>`; `writeTransactionChunk`, `clearAllTransactionChunks` und der Lock-Listener erhöhen sie. In beiden Lesepfaden `gen` vor dem `await` merken und `chunkCache.set` nur bei unveränderter Generation. Gelesene Items trotzdem zurückgeben.

## WP4 — Speicher-API: echtes „alle" vs. begrenzte Liste (F2) — L

**Dateien:** `src/services/transaction-storage-service.ts`, `src/services/transaction-service.ts`, `src/lib/constants.ts` (`MAX_QUERY_LIMIT` entfernen), alle Aufrufer aus `grep -rn "getTransactions([0-9]" src`.

**API-Entscheidung:**
- `transaction-service.ts`: neu `getAllTransactions(): Promise<Transaction[]>` (unbegrenzt, datum-absteigend) und `getTransactionsPage(limit, offset): Promise<{ transactions, total, hasMore }>` (Form der toten `getTransactionsPaginated` wiederverwenden, diese entfernen). `getTransactions(limit)` bleibt ein Release als deprecated Alias.
- Storage: `limit` optional; `undefined` → kein `slice`. Private `getAllTransactions()`-Kappung bei 10.000 entfernen; `remapCategoryInLocalTransactions` über den ganzen Bestand.

**Aufrufer-Kategorien:**
- **Analyse → `getAllTransactions()`:** alle Service-Aufrufer mit 10000 (backup, demo-data, debt/receivable, gocardless, reconcile, analytics, forecast, net-worth, coach, financial-health, cloud-mcp-sync, special-category, budget, waterfall, finance-foundation, contract/debt detection, data-readiness) sowie `useCategoryModel*`, `useAutomationSuggestions`, `useLumpyRisk`, `TaxReportPage`, `EuerPage`, `IncomeWrappedPage`, `DataExport`, `ContractsDashboard` (Vertragsableitung braucht den ganzen Bestand).
- **Echte Scroll-Listen → `getTransactionsPage`:** `CashSection`, `ReceivablesPanel` (`DEBT_ASSIGNABLE_TRANSACTION_LIMIT`), `ReviewTable`, `IncomeStreamsPanel`, `ResponsivePremiumDashboard`. Bei `hasMore` einen i18n-Hinweis „n weitere" rendern (Key in allen `SUPPORTED_LOCALES`). `CoachPage getTransactions(1)` → `getTransactionsPage(1,0).total > 0`.

**Tests zuerst:**
- `chunk-mode.test.ts`: `[REGRESSION] sollte ohne Limit auch mehr als 10000 Buchungen vollständig liefern` (10.001 über zwei Quartale)
- `transaction-service.ordering.test.ts`: `sollte getAllTransactions datum-absteigend und unbeschnitten liefern`, `sollte getTransactionsPage hasMore korrekt setzen`
- `[REGRESSION] remapCategoryInLocalTransactions sollte auch Buchungen jenseits der 10000 jüngsten umhängen`

**Neuer Wächter:** `scripts/check-transaction-limits.mjs` + `transaction-limits-core.mjs` (TS-AST, Vorbild `store-serialization-core.mjs`): verbietet numerisches Literal als erstes Argument von `getTransactions(` unter `src/services/**`, `src/hooks/**` **sowie `src/components/**` und `src/pages/**`**. Ohne Ausnahmeliste.

> **KORREKTUR (Prüfung 2026-09-01): Die Reichweite deckte die Arbeit nicht ab.**
> Der Wächter sollte `services` und `hooks` prüfen — die Hälfte der Aufrufer,
> die WP4 selbst umstellt, liegt aber in der Oberfläche: `TaxReportPage`,
> `EuerPage`, `IncomeWrappedPage`, `ContractsDashboard`, `ReviewTable`,
> `DataExport`, `CashSection`, `ReceivablesPanel`, `IncomeStreamsPanel`,
> `ResponsivePremiumDashboard` (gemessen: zehn Dateien unter
> `src/components/` und `src/pages/`). Ein Wächter, der genau dort nicht
> hinsieht, wo die Steuersumme und die EÜR entstehen, lässt den teuersten Fall
> zurückkommen — dieselbe Lehre wie bei `check:money-format`: Eine Datei ist
> nicht erledigt, weil *anderswo* richtig gearbeitet wird. Tests unter
> `__tests__/` bleiben ausgenommen (dort ist ein festes Limit der Prüfgegenstand). Unit-Test `scripts/__tests__/transaction-limits-core.test.mjs`. Eintragen in `package.json`, `.githooks/pre-commit`, CI-Workflow, AGENTS.md §2-Tabelle und §12.

> **ERGÄNZUNG (Prüfung 2026-09-01): WP1, WP4 und WP6 multiplizieren sich —
> das gehört gemessen, nicht gehofft.** Einzeln ist jedes Paket richtig;
> zusammen bekommt **jeder** Schreibvorgang einen serialisierten Vollzugriff:
> WP1 legt den ganzen Rumpf inklusive `readAllTransactionChunks` unter EINEN
> store-weiten Lock, WP4 nimmt die 10.000er-Kappung heraus, und WP6 setzt
> zusätzlich eine inhaltliche Dedup „über den Bestand" **innerhalb** dieses
> Locks. Ein CSV-Import von 10.000 Zeilen in Stapeln entschlüsselt damit je
> Stapel den kompletten Buchungsbestand (AES-GCM + IndexedDB — die teuerste
> Operation der App, AGENTS.md §3), und zwar nacheinander. Die Asymptotik ist
> in Ordnung, die **Konstante** ist die Frage.
> **Auflage für WP6:** Die Dedup-Menge wird **einmal vor** der Schleife
> aufgebaut (`Set` von `buildCsvContentKey`), nie je Zeile — und die
> Import-Laufzeit wird mit `@/test-utils/synthetic-transactions` gegen einen
> realistischen Bestand **gemessen** und im PR beziffert (Vorbild:
> `src/lib/__tests__/categorizer.test.ts` zählt Zugriffe statt die Uhr zu
> lesen). Wer eine Laufzeit behauptet, misst sie.

**Phase 2 (eigener PR, nicht hier):** `financeKeys.transactionsAll = ['transactions','all']` in `features/shared/data/finance-query-keys.ts`, Verbraucher mit `select:`-Projektion; `['transactions', locale]` in Tax/EÜR dort einfalten.

## WP5 — GoCardless-Dedup über den ganzen Bestand (F3b) — S, nach WP4

**Datei:** `src/services/gocardless-sync-service.ts:288`. `getTransactions(5000)` → `getAllTransactions()` gefiltert auf `account_id === account.id`.
**Test** (`gocardless-dedupe-identifier.test.ts`): `[REGRESSION] sollte eine Buchung erkennen, die älter ist als die 5000 jüngsten Buchungen`.

## WP6 — CSV-Import idempotent (F3a) — M

**Dateien:** `src/services/csv-service.ts:187-196`, `src/services/transaction-storage-service.ts` (Save-Dedup, innerhalb des WP1-Locks), neu `src/lib/transaction-identity.ts` (rein).

**Tests zuerst** (`csv-service.test.ts`, Tag `[INTEGRITY]`):
- `[INTEGRITY] sollte für dieselbe Buchung in zwei überlappenden Exporten dieselbe ID erzeugen`
- `[INTEGRITY] sollte zwei inhaltlich identische Zeilen derselben Datei unterschiedlich identifizieren` (Vorkommenszähler 0/1)
- `[INTEGRITY] sollte die ID nicht von der Zeilenposition abhängen`
- Storage: `[REGRESSION] sollte einen Reimport mit neuer ID-Form nicht neben einer Alt-ID-Buchung gleichen Inhalts anlegen`

**Umsetzung:**
1. `index` in den Hash-Teilen durch `occurrence` ersetzen: `Map<string, number>` über `[date, amount, payee, description, currency, iban].join('\u001f')`, synchron vor dem `Promise.all` gezählt (Reihenfolge = Zeilenreihenfolge, deterministisch).

   > **GRENZE (Prüfung 2026-09-01), benannt statt verschwiegen:** Der Zähler
   > läuft **je Datei**. Zwei Exporte, die dieselbe Zeile an derselben Stelle
   > ihrer Wiederholungsreihe enthalten, ergeben dieselbe ID — der Regelfall
   > und der Zweck des Pakets. Enthält ein Bestand aber **mehrere inhaltlich
   > identische** Buchungen desselben Tages (zweimal derselbe Betrag beim
   > selben Händler) und schneidet der zweite Export mitten in diese Reihe,
   > steht dieselbe Buchung dort auf Position 0 statt 1 — und wird dupliziert.
   > Der Zähler löst das nicht und kann es nicht: Ohne ein Merkmal, das die
   > beiden Zeilen unterscheidet, sind sie ununterscheidbar. Aufgefangen wird
   > der Fall von der inhaltlichen Zweit-Dedup unter Punkt 2, die genau
   > deshalb **nicht** als Bestandsnutzer-Sonderweg geführt werden darf,
   > sondern als der eigentliche Wächter der Idempotenz. Test dazu:
   > `[INTEGRITY] sollte eine wiederholte identische Zeile nicht duplizieren,
   > wenn der zweite Export mitten in der Wiederholungsreihe beginnt`.
2. Bestandsnutzer: alte `csv-…`-IDs bleiben (Allocations/Schulden referenzieren sie, keine Migration). Innerhalb des Save-Locks eine inhaltliche Zweit-Dedup: `buildCsvContentKey(tx)` aus `lib/transaction-identity.ts` über den Bestand, eingehende Zeile überspringen, wenn Inhalt existiert **und** die eingehende ID mit `csv-` beginnt. Nicht mit `buildTxIdentifier` (GoCardless) verschmelzen, andere Felder. Übersprungene Zeilen im Import-Ergebnis zählen, nicht still.

## WP7 — Kleine Härtungen — je S, unabhängig

1. `local-crypto.ts enable()` (~488-496): erst `CHECK_KEY`, dann `saveConfig`. Test `local-crypto.test.ts`: `[SECURITY] sollte bei Abbruch nach der Konfiguration keinen Tresor ohne Prüfblob hinterlassen`.
2. `idb-kv.ts:80`: `idbSet`/`idbRemove` werfen `IndexedDbUnavailableError` statt No-op (`idbGet`/`idbKeys` bleiben leer).

   > **AUFLAGE (Prüfung 2026-09-01):** Aus einem stillen No-op einen Wurf zu
   > machen, ist richtig — aber es ist eine Verhaltensänderung an **jeder**
   > Aufrufstelle, und der Plan sagt nicht, wer den Fehler fängt. Ungefangen
   > wird aus „Einstellung wurde nicht gespeichert" ein abgebrochener
   > Speicherlauf oder eine unbehandelte Promise-Ablehnung, also aus einem
   > leisen Fehler ein lauter Absturz — im Zweifel schlechter. Deshalb gehört
   > in dasselbe Paket: die Aufrufstellen zählen, den Fehler an der
   > **Oberfläche** in eine benannte Meldung übersetzen (i18n, alle
   > `SUPPORTED_LOCALES`) und einen Test, der beweist, dass ein Schreibversuch
   > ohne IndexedDB **benannt** scheitert statt die App zu beenden. `local-crypto.ts:95-107 readDataRaw`: `localStorage.removeItem` erst nach `await idbGet(key) === legacy`. Tests: `idb-kv.test.ts`, `local-crypto.migration-crash.test.ts`: `[REGRESSION] sollte den localStorage-Altbestand erst löschen, wenn IndexedDB ihn nachweislich hält`.
3. `snapshot-sync-service.ts:334`: fremdes Gerät → `requiresConfirmation = localMeta !== null` (immer bestätigen; Änderungszeiten werden nicht verfolgt). Test: `[INTEGRITY] sollte einen fremden Snapshot auch dann bestätigen lassen, wenn er jünger als der letzte Sync ist`; bestehenden Gegen-Test anpassen. i18n-Text der Rückfrage prüfen.

---

## Verifikation

```
pnpm vitest run scripts/__tests__/store-serialization-core.test.mjs src/services/__tests__/transaction-chunk-store.test.ts src/services/__tests__/transaction-storage-service.chunk-mode.test.ts src/services/__tests__/transaction-storage-service.security.test.ts
pnpm vitest run src/services/__tests__/csv-service.test.ts src/services/__tests__/gocardless-dedupe-identifier.test.ts src/services/__tests__/transaction-service.ordering.test.ts src/services/__tests__/snapshot-sync-service.test.ts src/services/__tests__/local-crypto.test.ts src/services/__tests__/idb-kv.test.ts
pnpm check:store-serialization && pnpm check:transaction-limits && pnpm check:layers && pnpm check:query-errors && pnpm check:i18n --all && pnpm check:view-data
pnpm lint && pnpm build && pnpm test:integrity && pnpm test:security && pnpm security:secrets && pnpm test
```

Nachweise im PR: (a) Wächter aus WP2 rot vor WP1, grün danach; (b) 10.001-Buchungen-Test rot vor WP4; (c) `pnpm test` vollständig grün (~10 min). CHANGELOG `[Unreleased]` unter **Behoben** je Fund eine Zeile.
