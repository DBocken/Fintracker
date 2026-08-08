# Qualitäts-Audit — Protokoll, 2026-08-08

> **Protokoll, keine Regel.** Ist-Aufnahme von `main@067244f` am 2026-08-08.
> Zeilennummern und Zählwerte altern absichtlich — vor jedem Eingriff neu
> verifizieren. Die daraus folgende Arbeit steht in [`plan.md`](plan.md);
> sobald sie abgeschlossen ist, wandert dieses Verzeichnis nach `docs/archive/`.

**Methode:** Acht parallele, nur lesende Analysen (Architektur, Domänenmodell,
Testqualität, Resilienz, Komplexität, Performance, Sicherheitstiefe,
Governance), anschließend Gegenprüfung jedes Befunds gegen den Use-Case
(local-first Finanz-App, Solo-Maintainer, agentengestützte Entwicklung, elf
bestehende Wächter). Befunde, die bereits durch Wächter/Ratschen abgedeckt oder
reines Enterprise-Dogma sind, wurden aussortiert oder entsprechend eingeordnet.
Maßstab: *Bei 10/10 ist jedes Versprechen des Systems eine maschinell geprüfte
Wahrheit, und kein einzelnes korruptes Byte kann Nutzerdaten vernichten.*

**Gesamturteil zum Stichtag: ~7,5–8/10.** Die Lücken sind unten je Dimension
mit Beleg, Begründung und Schwere (blocker / wesentlich / kür) festgehalten.
Jeder Befund trägt eine ID, auf die der Plan verweist.

---

## Resilienz & Datenlebenszyklus

### RES-1 · Korruptes Envelope → stiller Datenverlust beim nächsten Schreiben · **blocker**
`src/services/local-crypto.ts:344-349` (`loadAndMaybeDecrypt`): `try { parsed =
JSON.parse(raw) } catch { return null }` — kombiniert mit
`src/services/local-finance-store.ts:60-67` (`readLocalFinanceList`:
`Array.isArray(data) ? data : []`) und dem Read-Modify-Write in
`upsertLocalFinanceItem` (`:79-102`). Ist ein gespeicherter Envelope beschädigt,
wird das als „keine Daten" gelesen; der nächste Schreibvorgang persistiert die
fälschlich leere Liste plus einen Eintrag — **der Bestand der Collection ist
dauerhaft überschrieben, ohne Nutzerbenachrichtigung**. Inkonsistent dazu: im
Klartext-Zweig (`:333`) wirft derselbe Parse sichtbar.

### RES-2 · Keine Schema-Validierung an der Kern-Lesegrenze · **blocker**
`src/services/transaction-storage-service.ts:295` liest mit reinem
TypeScript-Cast (`loadAndMaybeDecrypt<Transaction[]>`). Die eigens gebaute
harte Grenze `parseAtBoundary` (`src/lib/schemas/boundary.ts:46-61`) wird nur
für `contract-record`, `household-settlement`, `replacement-plan`,
`entity-ref` und Snapshots genutzt — nicht für Transaction / Category /
Account / Budget / Debt. Ein fehlerhafter Datensatz fließt bis in die
Render-Schicht. Siehe auch DOM-2.

### RES-3 · `LOCAL_STORE_SCHEMA_VERSION` ist ein Stempel, kein Migrationsläufer · **wesentlich**
`src/services/local-finance-store.ts:35-51` (`assertCompatibleStore`): der
`'migrate'`-Zweig schreibt nur die Versionsnummer fest, transformiert nichts.
Die vorhandenen Feld-Migrationen (`local-settings-service.ts:58-82`) laufen
lazy und hängen an keinem Versionszähler; es gibt keine geordnete, getestete
Migrationskette („alte Form rein → neue raus").

### RES-4 · Geräte-Sync-Import: blinder Overwrite ohne Versions-/Konfliktprüfung · **wesentlich**
`src/services/snapshot-sync-service.ts:210-222` (`importEncryptedSnapshot`)
überschreibt jedes Segment unbedingt; kein Vergleich von `snapshot_version`
mit dem lokalen Stand, kein Bestätigungsdialog
(`PrivacySyncAnalyticsSettings.tsx:283-294`). Ein versehentlich gewählter
älterer Snapshot löscht neuere Daten kommentarlos.

### RES-5 · Backup ohne Prüfsumme, Versionscheck nur Major-Ziffer · **wesentlich**
`src/services/backup-service.ts:314-328` (`validateBackup`, nur
Top-Level-Struktur) und `:443-448` (`isVersionCompatible`, erste Ziffer).
Teilkorrupte, strukturell gültige Dateien importieren „erfolgreich"; einzelne
Items werden beim Restore nicht schema-geprüft (gleiche Lücke wie RES-2).

### RES-6 · IndexedDB-Laufzeitfehler (Quota, transient) faktisch unbehandelt · **wesentlich**
`ERROR_CODES.STORAGE_QUOTA_EXCEEDED` (`src/lib/constants.ts:241`) wird nirgends
referenziert (toter Code). `src/services/idb-kv.ts:42-53` reicht rohe
`DOMException` durch; `openDb()` (`:23-40`) cached das Promise dauerhaft — ein
fehlgeschlagener Erstaufruf lässt den KV-Store für die Session tot, kein Retry.

### RES-7 · Nur ein globaler ErrorBoundary; geräumter Browser-Storage unerkannt · **kür**
`<ErrorBoundary>` nur in `src/main.tsx:55`; `withErrorBoundary`
(`ErrorBoundary.tsx:192-204`) hat keinen Aufrufer. Kein Code unterscheidet
„neuer Nutzer" von „Browser hat IndexedDB geräumt" (Safari ITP, manuelles
Löschen); der Rückgabewert von `requestPersistentStorage()` (`idb-kv.ts:142-150`)
wird nicht ausgewertet.

**Solide:** Backup-Restore additiv/idempotent per stabiler ID mit
Roundtrip-/Regressionstests (`backup-restore-idempotent.test.ts` u. a.);
`FOREIGN_BACKUP`-Abfangen; Umschlüsselungs-Migration bei `enable()`/`disable()`
per Lazy-Read selbstheilend — letzteres allerdings nur code-analytisch belegt,
ohne Crash-mid-Migration-Test.

---

## Domänenmodell

### DOM-1 · Geld ist nackter `number` — Cent und Euro compiler-ununterscheidbar · **blocker**
`src/lib/money.ts:14-23` (kein Brand); `src/types.ts:47`
(`Transaction.amount`: Euro-Float) vs. `:100` (`amount_minor`: Integer-Cent);
gleiches Muster `:314`, `:551`, `:570`; Ad-hoc-Cent-Arithmetik in
`src/services/girocode-service.ts:60-61`. Eine Faktor-100-Verwechslung
kompiliert widerspruchslos.

### DOM-2 · zod-Versprechen aus AGENTS.md §8 gilt für ~3 von ~30 Collections · **blocker**
`readLocalFinanceList` prüft nur `Array.isArray`
(`local-finance-store.ts:60-68`) — betrifft u. a. `debts`, `receivables`,
`budgets`, `milestones` (`local-storage-keys.ts:10-40`); `csv-service.ts`
importiert kein zod. Deckungsgleich mit RES-2.

### DOM-3 · `types.ts` (722 Zeilen) bündelt ≥9 Fachdomänen, IDs ohne Brand · **wesentlich**
Konten/Buchungen, Kategorisierung, Settings, Steuer, Budget (7 Interfaces),
Schulden, Forderungen, Meilensteine, Coaching, Portfolio in einer Datei; alle
`id`-Felder nackte `string`s; Datumsrepräsentation gemischt (`date: string`
vs. `Date`-Parameter in Services).

### DOM-4 · Invariante 5 (Cent-Validierung an fachlichen Grenzen) nicht eingelöst · **wesentlich**
`docs/domain-invariants.md:11` vs. `src/services/transaction-service.ts:163-172`
(`saveTransactions` validiert via `parseGermanNumber` und speichert
Euro-Float). Kontrast: Invariante 6 (Split-Summe, `transaction-allocation-service.ts:42-84`)
und 16 (kein Klartext im Vault, `vault-format.test.ts:45-59`) sind hart
erzwungen — das Schutzniveau schwankt unangekündigt.

### DOM-5 · Request-Zustand als unabhängige Booleans statt discriminated union · **kür**
`use-city-model.ts:48-56` (`isLoading`/`isError`/`isEmpty` unabhängig;
`isError && isEmpty` gleichzeitig möglich); Priorität existiert nur als
if/else-Reihenfolge in `CityPage.tsx:790-801`.

---

## Testqualität

### TEST-1 · Puffer-Grenze `<` in `belowSafetyBuffer` nie exakt getestet · **wesentlich**
`src/lib/forecast.ts:540`; `forecast.test.ts:452-467` testet nur klar
drunter/drüber. Eine `<`→`<=`-Mutation bliebe suite-weit grün (verifiziert) —
und genau diese Kennzahl trägt die Kern-Warnung der App.

### TEST-2 · Budget-Grenze `spent > limit` doppelt verwendet, nie exakt getestet · **wesentlich**
`src/lib/budget-logic.ts:113`, gespeist in Budget-Ampeln **und**
`disposable-budget.ts:90`; `budget-logic.test.ts:224-272` testet nie
`spent === limit`.

### TEST-3 · `parseGermanNumber`: negative Tausender ungeschützt (Faktor 1000) · **wesentlich**
`src/lib/money.ts:52`; Nachweis durch Nachbau: ohne `-?` liefert
`parseGermanNumber("-1.200")` lautlos `-1.2` — keiner der 8 Tests in
`money.test.ts` schlägt an. Der Parser ist laut eigenem Docstring der einzige
gemeinsame für UI, CSV und programmatische Pfade.

### TEST-4 · Error-State-Tests: halbe Familie prüft nur `role=alert`-Existenz · **wesentlich**
Schwach: `AnalysisPage.error-state.test.tsx:24-27`, `ExportPage…`, `CsvPage…`
(nur `findByRole('alert')`). Stark (gleiche Dateifamilie):
`EuerPage.error-state.test.tsx:30`, `ContractsPage…:26-27` prüfen zusätzlich,
dass die irreführende Leerzustand-Aussage **verschwunden** ist — genau der
dokumentierte Zweck dieser Tests.

### TEST-5 · Coverage-Schwellen konservieren den Ist-Stand global · **wesentlich**
`vitest.config.ts:39`: `lines 52 / branches 47 / functions 44`, laut Kommentar
„am Ist-Stand kalibriert". Kein gezielter Schutz der Geldlogik
(`money.ts`, `forecast.ts`, `budget-logic.ts`) über Datei-Schwellen.

### TEST-6 · E2E deckt keinen geldkritischen Fluss ab · **wesentlich**
`e2e-tests/` (7 Specs): Onboarding-Slice, A11y, Performance, Motion — kein
Treffer für „backup"/„encrypt"/„Passwort". Verschlüsselung und Backup/Restore
laufen nie durch den echten Browser-Pfad (Passwort-Dialog, Datei-Roundtrip,
Reload).

**Solide:** Stichprobe überwiegend verhaltensprüfend mit exakten Werten;
`fake-indexeddb/auto` global — Crypto- und Backup-Roundtrips laufen über die
echte IndexedDB-API statt Mocks; 0 `@ts-ignore` im Produktionscode.

---

## Architektur

### ARCH-1 · 22 von 26 Routen unzerlegt — zwei gleich lebendige Architekturen · **blocker** *(als Ratsche bekannt)*
`view-data-budget.json:13-14` (Eigenmessung des Projekts) + Nachzählung an
`src/App.tsx`: nur `/transactions`, `/occasions`, `/city`, `/dashboard` laufen
vollständig über `src/features/*/presentation`. Die Ratsche (282) macht es
messbar; die Ambiguität „welcher Architektur folgt neuer Code?" bleibt, solange
beide gleichwertig nebeneinander stehen.

### ARCH-2 · Drei „Feature"-Ordner sind verwaiste Domain-Snippets · **wesentlich**
`src/features/contract-records/domain/*`,
`src/features/household-settlement/domain/balances.ts`: keine Importer
außerhalb eigener Tests; `replacement-planning/domain/*` nur von Services
konsumiert; `trading` hat keine `presentation` (UI in
`TradingDashboard.tsx`). Die Verzeichnisstruktur täuscht Fortschritt vor.

### ARCH-3 · Referenz-Slice `dashboard` leckt in Alt-`components` — Wächter blind · **wesentlich**
`DashboardDesktopView.tsx:3` / `DashboardMobileStory.tsx:8` importieren aus
`src/components/dashboard/TransactionCharts.tsx` (564 Zeilen);
`scripts/layers-core.mjs` (RULES, Z. 16-68) hat **keine** Regel für
`features/*/presentation/`.

### ARCH-4 · `hooks`-Schicht ist Blindstelle des Layer-Wächters · **wesentlich**
AGENTS.md §3 nennt `lib → services → hooks → components → pages`;
`layers-core.mjs` kennt keine `src/hooks/`-Regel. Live-Fund:
`src/hooks/useKpiPreferences.ts:6` importiert `KPI_DEFINITIONS` (Fachdaten)
aus `src/components/kpi/kpis.ts`.

### ARCH-5 · God-Components überleben die Migration · **wesentlich**
`CityPage.tsx` 1205 Zeilen (Komponente: 1106) trotz vollständiger Slice;
`TradingDashboard.tsx` 732 (sauberes ViewModel, keine
`presentation/`-Aufteilung); `createCityScene` 933 Zeilen
(`city-scene.ts:445-1377`). Die Migration extrahierte die Datenschicht, nicht
die UI-Komplexität.

### ARCH-6 · Gott-Module `analysis-data.ts` (960) und `local-settings-service.ts` (849) · **kür**
≥5 getrennte Themen bzw. 8 Migrationsfunktionen + zwei CRUD-Verantwortungen
je Datei; die Migrationsfunktionen sind reine Funktionen und gehörten nach
`lib/` (Ablage-Gewohnheit, AGENTS.md §3).

---

## Komplexität & Duplikate

### KOMP-1 · God-Functions bei den Top-Hotspots · **blocker**
Siehe ARCH-5; dazu `TransactionDetailsPanel.tsx` (580),
`use-etoro-account.ts` (557), `BackupManager.tsx` (521),
`AccountManager.tsx` (501), `LiquidityReport.tsx` (490),
`SankeyChart.tsx` (485), `RiskDensityChart.tsx` (482).

### KOMP-2 · `TransactionFilters` (25 Flat-Props) zweimal wortgleich verdrahtet · **blocker**
`TransactionFilters.tsx:21-49`; identische 21-Prop-Verdrahtung in
`Dashboard.tsx:193-218` **und** `TransactionsListPane.tsx:80-105` — die
frühere Desktop/Mobile-Duplikation ist eine Ebene tiefer gewandert.

### KOMP-3 · Tagesgruppierung zweimal implementiert, sichtbar anderes Ergebnis · **wesentlich**
`transaction-day-groups.ts:29-49,106-120` (mit „Heute/Gestern") vs.
`TransactionListMobile.tsx:52-72` (eigenes `reduce`, ohne Relativierung) —
identische Daten, je Einstiegspunkt anders formatiert.

### KOMP-4 · `new Intl.NumberFormat('de-DE'…)` 18× dekliniert · **kür**
18 Dateien statt `useMoneyFormat().format()` (kapselt bereits
Sanfter-Modus-Maskierung); `Dashboard.tsx` hält eine dritte eigene
`formatBalance`-Variante.

### KOMP-5 · Cast-Last konzentriert: fehlende typisierte Bausteine · **wesentlich**
~309 `as`-Casts (ohne `as const`/Tests/Kataloge); Hotspots
`TradingDashboard.tsx` (17× `as Error | null`), `backup-service.ts` (12),
`gocardless-service.ts` (11); systemisch: `onValueChange={(v) => set(v as
Union)}` je `<Select>`-Feld (`BudgetFormDialog` 10×, `DebtFormDialog` 9×) —
es fehlt ein `TypedSelect<T>`; 21× `eslint-disable react-hooks/exhaustive-deps`.
Positiv: nur 8× `: any`, 0 `@ts-ignore` im Produktionscode.

### KOMP-6 · Toter Code: exportierte Symbole ohne Aufrufer · **kür**
`useSkin` (`SkinProvider.tsx:62`), `BulkActions` (`BulkActions.tsx:17`),
`withErrorBoundary`/`useErrorHandler` (`ErrorBoundary.tsx:192,217`),
`matchContractsToTransactions` (`contract-detection-service.ts:107`),
`getMilestoneDefinitions` (`milestones-service.ts:12`). 0 TODO/FIXME im Baum —
es gibt keinerlei Backlog-Markierung im Code.

---

## Performance

### PERF-1 · Transaktionsbestand ist EIN verschlüsselter Blob — O(n) je Einzeländerung · **blocker**
`transaction-storage-service.ts:288-311`, `local-crypto.ts:315-325`,
Eigenkommentar `transaction-service.ts:92-97` („KEIN Storage-Level-Paging").
Bei den produktseitig vorgesehenen 5 000 Buchungen
(`FINANCE_TRANSACTION_LIMIT`) löst jede Kategorie-Änderung Voll-Parse +
AES-Decrypt + Stringify + Encrypt über den Gesamtbestand aus — synchron im
Pfad einer Nutzeraktion.

### PERF-2 · Root-Invalidierung `['transactions']` kaskadiert auf zwei parallele Großqueries · **blocker**
`finance-query-keys.ts:4-5`; Verbraucher `['transactions', 5000]` und
`['transactions', 1000]`. Root-Invalidierungen u. a. in `CashSection.tsx:69-72`,
`CashWithdrawalDialog.tsx:68-71`, `AccountManager.tsx:258-261`,
`gocardless-sync-service.ts:30-34`, `BankCallbackPage.tsx:231-233` — je
Fundstelle zu verifizieren, ob Buchungen wirklich betroffen sind; wo nicht,
multipliziert der Prefix-Match die Kosten aus PERF-1.

### PERF-3 · Alle Sprachen (inkl. `tlh`) statisch im Startbündel · **wesentlich**
`translations.ts` (18 404 Zeilen, ~965 KB Quelle) statisch importiert in
`I18nProvider.tsx:1-7`, gemountet vor jedem `React.lazy`-Split
(`main.tsx:18,56`); Overlays ebenso statisch (`overlays/index.ts:4-6`). Kein
eigener i18n-Chunk im `bundle-size-budget.json`.

### PERF-4 · Recharts-Datenarrays ohne `useMemo` (3 Fundstellen) · **wesentlich**
`EtoroCandlestickChart.tsx:90-94`, `EtoroPerformanceTab.tsx:49-52`,
`TradingDashboard.tsx:675` (Array-Erzeugung inline im JSX) — bei live
gepollten Positionsdaten baut Recharts Skalen/Pfade je Render neu.

### PERF-5 · `invalidateQueries()` ganz ohne Key — kompletter Cache-Wipe · **kür**
`FinanceEmptyState.tsx:33`, `DemoDataBanner.tsx:41`,
`DataSourceDialog.tsx:96`.

**Solide:** Route-Splitting vollständig (alle Seiten `lazy()`, three.js/City
als eigener Chunk, 176 128 B gzip separat budgetiert); `/transactions` echt
fenster-virtualisiert (`useWindowVirtualizer`); Dashboard-Vorschau bewusst auf
5 Zeilen begrenzt.

---

## Sicherheitstiefe

### SEC-1 · PBKDF2 falsch kalibriert: 210 000 Iterationen bei SHA-256 · **wesentlich**
`local-crypto.ts:218-221` und `:416-419`. OWASP empfiehlt für
PBKDF2-HMAC-SHA256 ≥ 600 000; 210 000 ist der SHA-512-Wert — das Passwort ist
~2,8× schneller offline brute-forcebar als beabsichtigt.

### SEC-2 · Kein Auto-Lock — entsperrter Schlüssel lebt unbegrenzt · **wesentlich**
`local-crypto.ts:192,206-208` (`_key` nur via explizitem `lock()`);
`LocalEncryptionProvider.tsx` ohne Idle-/`visibilitychange`-Listener. Das
eigene Threat Model (`docs/security/threat-model.md:73`) nennt lokalen
Gerätezugriff als Angreiferprofil.

### SEC-3 · Schwache Passwörter werden angezeigt, nicht verhindert · **wesentlich**
`LocalEncryptionSettings.tsx:163`: Setup-Button nur an `!password || password
!== confirm` gebunden; `estimatePasswordStrength` hat keine Gate-Funktion.

### SEC-4 · RLS-Wächter prüft Existenz, nicht Restriktivität · **wesentlich**
`supabase-rls.security.test.ts:71-74,89-91` zählt nur `CREATE POLICY`-Treffer;
`USING (true)` bestünde. Die realen Policies sind korrekt
(`auth.uid() = user_id` mit `WITH CHECK`) — das Netz gegen Regressionen ist
das Problem.

### SEC-5 · Cloud-MCP-Sync legt Aggregate im Klartext (nur RLS-geschützt) ab · **wesentlich**
`cloud-mcp-sync-service.ts:384-389` (`payload` Klartext-jsonb); Token im
URL-Pfad (`docs/mcp-poc.md:73-75`, dort ehrlich als POC-Grenze benannt).
Transparent dokumentiert und doppelt bestätigt — aber nur in `docs/`, nicht in
der UI selbst gekennzeichnet.

### SEC-6 · CSP erlaubt `style-src 'unsafe-inline'` · **kür**
`vercel.json:30`, `netlify.toml:8` — mit Tailwind praktisch schwer vermeidbar;
Kandidat für „entschieden dokumentieren" statt Nonce-Umbau.

**Solide:** Zufalls-IV je Verschlüsselung (`crypto.getRandomValues`, 12 Byte);
Schlüssel nie in localStorage/sessionStorage; Backup-Export standardmäßig
verschlüsselt, Klartext nur mit expliziter `acknowledgeUnencrypted`-Bestätigung;
Vault-Format ohne Klartext-Codepfad; Threat Model und POC-Grenzen ungewöhnlich
ehrlich; `pnpm.overrides` durchgängig nach oben begrenzt.

---

## Governance & Meta-System

### GOV-1 · Dokumentiert Verbotenes passiert real — ohne Wächter · **blocker**
`coding-guide.md:42-43` verbietet Roh-`parseFloat(x.replace(',','.'))` →
verletzt in `AskYourMoney.tsx:52` (getippter Geldbetrag). `coding-guide.md:33`
verbietet `as unknown as` an Datengrenzen → verletzt in
`BankCallbackPage.tsx:119` (GoCardless-Bankdaten ohne zod) und
`letter-ocr-service.ts:151,155`. Für keine der beiden Regeln existiert ein
Wächter — i18n hat drei Erkennungsformen, die Geld-Parsing-Regel null.

### GOV-2 · `api/` entgegen Doku nicht im Typecheck · **wesentlich**
`coding-guide.md:36` behauptet es; `tsconfig.json:30` includiert nur `src` +
`vitest.setup.ts`; `api/mcp/[token].ts` (Token-Endpunkt!) hat kein eigenes
tsconfig, `mcp-poc/tsconfig.json` ruft kein CI-Schritt auf.

### GOV-3 · Keinerlei Versionierung · **wesentlich**
`package.json:4` = `0.0.0`; `android/app/build.gradle:10-11` = `versionCode 1`;
0 Git-Tags; kein CHANGELOG — bei 284 Commits ist kein Stand rückwirkend
menschenlesbar benennbar.

### GOV-4 · ADRs nur für ein 3-Tage-Programm, nicht für die Grundarchitektur · **wesentlich**
`docs/aaa-plus/decisions/decision-log.md`: 12 vorbildliche Einträge, alle
2026-08-05 bis -07, thematisch Animation/Telemetrie. Warum EUR-only, warum
IndexedDB-KV, warum die Doppel-Schichtung — nirgends datiert festgehalten;
einzig `architecture/entity-references.md` hat ADR-Form.

### GOV-5 · Schulden-Buchhaltung uneinheitlich: die größte Zahl fällt durchs Raster · **kür**
Summe „offener Zahlen" über alle Allowlists = 17 — während
`view-data-budget.json` mit 282/282 die dominante Schuld hält, aber nicht der
Zahl/Objekt-Konvention folgt und in keiner Summe auftaucht.

### GOV-6 · Pre-Commit hat stille Vollumgehung ohne bewusstes `--no-verify` · **kür**
`.githooks/pre-commit:9`: fehlt `pnpm` im PATH (GUI-Git-Clients), werden alle
Wächter mit Exit 0 übersprungen — unbeobachtet. CI bleibt der verbindliche
Zaun; Laufzeit der Batterie lokal ~6,6 s.

**Solide:** Das Wächter-System selbst (Ratschen, Zahl/Objekt-Konvention,
Zustands-Matrix) ist über Industrie-Standard; `docs/README.md` trennt geltend
von Protokoll; 8× `any` / 30× `eslint-disable` / 0 TODO bei ~114 000 LOC.
