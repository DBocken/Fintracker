# Umsetzungsleitfaden zum Audit (2026-07-02)

Begleitdokument zu `docs/codequalitaet-audit-2026-07-02.md`. Ziel: Jedes Finding
ist als **Task-Card** so vorbereitet, dass ein günstigeres/kleineres Modell (oder
ein Junior) es ohne weitere Architekturklärung umsetzen kann. Alle
Randbedingungen sind **vorab entschieden** (Abschnitt C) — ein Umsetzer soll
nicht mehr „designen", sondern nur noch ausführen und testen.

---

## Teil A — Reihenfolge: Was zuerst? (die eigentliche Frage)

**Kurzantwort: Weder „erst alle Features" noch „erst großer Refactor".** Die
richtige Reihenfolge ist **risikogetrieben** in vier Wellen — und die ersten
Fixes *sind* bereits die wichtigsten Refactorings.

### Warum nicht „Features zuerst, dann refaktorieren"
Jedes neue Feature (#52 Stripe, #53 Gating, #54 Design, #37/#38 Sync) würde die
**heute kaputten Muster kopieren**: noch mehr Aufrufer der laxen
`saveTransactions` (F-MONEY-4), noch mehr eigene Summen-Reduces mit
Transfer-Fehler (F-MONEY-3), noch mehr `localStorage`-Finanzdaten (F-PRIV-3). Du
würdest **Geld- und Datenschutz-Bugs in Serie ausliefern** und die technische
Schuld zementieren. Anti-Muster.

### Warum nicht „großer Refactor zuerst, dann Features"
Ein Big-Bang-Refactor ist **blind**, solange (a) die CI auf `main` rot ist
(F-CI-1) und (b) es **keine E2E-Tests** gibt. Du hättest kein Sicherheitsnetz,
das beweist, dass der Refactor nichts kaputt macht. Ebenfalls Anti-Muster.

### Die empfohlene Reihenfolge

```
Welle 0  LEITPLANKEN (blockierend, ~1–2 Tage)
         → CI grün + Branch-Protection (F-CI-1)
         → Coding Guide als Dokument (Audit Abschnitt 8 ausformulieren)
         → Vorentscheidungen aus Teil C dieses Dokuments absegnen
   Grund: Ohne grüne CI kein verlässliches Netz; ohne Guide kein Zielbild,
          an dem sich JEDER folgende Fix/Feature ausrichtet.

Welle 1  STABILISIEREN = „Fixen durch Refaktorieren" der Geld-/Krypto-Pfade
         → alle Critical + korrektheits-/datenschutzkritischen High-Findings
   Grund: Diese Fixes SIND die wichtigsten Refactorings. Beispiel: F-MONEY-3
          korrekt lösen = eine zentrale Aggregationsfunktion extrahieren.
          F-MONEY-1 lösen = einen zentralen Euro-Parser einführen. Du fixst den
          Bug UND beseitigst die Duplikation in einem Zug — und jeder dieser
          Fixes kommt mit einem Regressionstest, der Welle 2/3 absichert.

Welle 2  STRUKTURIEREN (nur was Features tragen müssen)
         → zentrale Validierung (zod), eine Storage-Schicht, Domänen-Ordner,
           Dedupe der doppelten Pfade, Feature-Gates zentral, Privacy zentral
   Grund: Features sollen auf sauberen Fundamenten aufsetzen, nicht daneben.

Welle 3  FEATURES nach neuem Guide
         → #52/#53/#54/#37/#38 auf der stabilisierten, strukturierten Basis
   Grund: Jetzt „billig" umsetzbar, weil Randbedingungen und Muster feststehen.

Querschnitt: Trackingverse-Modulgrenzen wachsen ab Welle 2 kontinuierlich mit.
```

**Merksatz:** *Erst die Leitplanken (Guide + CI + Tests), dann Fixen-durch-
Refaktorieren der Geld- & Krypto-Pfade, dann Features auf sauberer Basis.*

**Ausnahme #54 (Design-System/„Ruhe"-Theme):** Das ist überwiegend
Tokens/CSS/Copy und kollidiert kaum mit der Geldlogik — es kann **parallel** zu
Welle 1/2 laufen, weil es andere Dateien berührt. Alle anderen Features (#52,
#53, #37, #38) gehören in Welle 3.

---

## Teil B — Aufbau einer Task-Card (für den Umsetzer)

Jede Card hat: **ID · Ziel · Vorentscheidung · Dateien · Schritte · Tests ·
Aufwand · Abhängigkeiten · Definition of Done (DoD)**. Regeln für den Umsetzer:

1. Lies die genannte Datei **vollständig**, bevor du änderst.
2. Halte dich strikt an die *Vorentscheidung* — nicht neu diskutieren.
3. Schreibe **zuerst** den unter *Tests* genannten Test (rot), dann den Fix (grün).
4. Ändere **nur** die genannten Dateien; andere Änderungen brauchen ein eigenes Ticket.
5. Kommentiere nur das WARUM, wenn es nicht offensichtlich ist.
6. DoD ist die Abnahmebedingung — erst dann gilt die Card als fertig.

---

## Teil C — Querschnitts-Vorentscheidungen (einmal entscheiden, überall gültig)

Diese Punkte tauchen in mehreren Cards auf. Damit kein Umsetzer sie neu erfindet,
sind sie hier **einmal verbindlich** festgelegt. (Wo „⚠ bestätigen" steht, sollte
der Product Owner das kurz absegnen — es ist die einzige echte Produktentscheidung.)

- **VE-1 Währung:** Die App ist **EUR-only** bis auf Weiteres. Nicht-EUR-Buchungen
  (aus GoCardless/CSV) werden beim Import **abgewiesen** oder sichtbar als
  „nicht verrechnet" markiert, **nie** stumm 1:1 als EUR summiert. (⚠ bestätigen)
- **VE-2 Geldbetrags-Parsing:** Es gibt **genau einen** Euro-Eingabe-Parser
  (`parseEuroInput` in `src/lib/money.ts`), der deutsche Formate inkl.
  Tausenderpunkt korrekt liest. Alle UI-/Service-Eingaben nutzen ihn. Roh-
  `parseFloat(x.replace(',','.'))` ist **verboten**.
- **VE-3 Ungültige Beträge/Daten an der Persistenzgrenze:** `saveTransactions`
  **wirft** bei nicht-parsebarem Betrag/Datum (wie der CSV-Pfad), statt still 0
  bzw. „heute" zu setzen. Jeder Aufrufer fängt den Fehler und zeigt ihn dem
  Nutzer. Kein stiller Nullwert (Invariante 18).
- **VE-4 Aggregation (Einnahmen/Ausgaben/Saldo):** Es gibt **genau eine** Quelle
  der Wahrheit: `src/lib/analysis-data.ts`. Transfers werden über das bestehende
  `excludeTransfers()` (transaction-service.ts:286) **immer** ausgeschlossen.
  Komponenten-lokale `reduce`-Ketten über Beträge sind **verboten**.
- **VE-5 Backup-Restore-Semantik:** Restore ist **idempotenter Merge per ID**
  (Original-IDs behalten, Store dedupliziert). Ein echtes „Ersetzen" gibt es nur
  als separaten, explizit bestätigten „Gerät zurücksetzen + importieren"-Pfad.
  Die UI-Texte werden an das reale (Merge-)Verhalten angeglichen. (⚠ bestätigen)
- **VE-6 Storage-Key-Registry:** Alle `ausgabentracker_*`-Keys leben in **einer**
  Konstante. Um Zirkular-Imports zu vermeiden, wird eine neue Datei
  `src/services/local-storage-keys.ts` angelegt, die `LOCAL_FINANCE_KEYS`,
  `LOCAL_CATEGORIES_KEY`, `LOCAL_SETTINGS_KEY` exportiert; `local-crypto.ts` und
  `local-finance-store.ts` importieren daraus. Kein Key wird mehr dupliziert.
- **VE-7 Deployment-Zielplattform:** **Vercel** ist produktiv (Preview-Deploys
  bestätigt). `netlify.toml` wird **entfernt** (oder als „nicht genutzt"
  dokumentiert), damit CSP/`/api`-Redirect nicht divergieren. (⚠ bestätigen)
- **VE-8 localStorage-Grenze:** In `localStorage` liegen **keine** Finanzdaten
  oder daraus abgeleiteten Klartexte. Betroffene Daten wandern in den
  verschlüsselbaren `local-finance-store`. Ein Lint-/Test-Guard verhindert
  Rückfall.
- **VE-9 Ladelimits:** Aggregations-/Saldo-/Export-Pfade laden **ungedeckelt**
  (Chunk-Iteration), nicht `getTransactions(5000/10000)`. Anzeige-Listen behalten
  ein Limit, aber **entkoppelt** von den Berechnungen.
- **VE-10 Validierung:** Neue Datengrenzen werden mit **zod** validiert
  (Dependency `zod@^4` ist bereits vorhanden). Ein Schema pro Entität in
  `src/lib/schemas/`.

---

## Teil D — Task-Cards

### WELLE 0 — Leitplanken

#### T0.1 — CI grün machen (F-CI-1) · Aufwand S
- **Ziel:** `pnpm test` läuft grün; CI ist als Required Check aktivierbar.
- **Vorentscheidung:** Die 4 fehlschlagenden Tests in
  `src/components/budgets/__tests__/BudgetFormDialog.test.tsx` scheitern, weil
  `BudgetFormDialog.tsx:280` die Rollover-/Adaptive-Controls hinter
  `<FeatureGate feature="budgetPremium">` legt und die Tests ohne Premium-Tier
  rendern. **Fix im Test**, nicht im Feature.
- **Dateien:** `src/components/budgets/__tests__/BudgetFormDialog.test.tsx`.
- **Schritte:**
  1. Sieh dir `src/lib/tier.gating-matrix.test.ts` an: dort wird ein Premium-Tier
     gemockt/gesetzt. Übernimm dasselbe Muster.
  2. Vor dem Rendern der betroffenen Tests Premium-Tier aktiv setzen (Tier-Mock
     bzw. `FEATURES`-Override), sodass `getByLabelText(/Max\. Übertrag/)` die
     Controls findet.
  3. Für Tests, die das **Free**-Verhalten prüfen sollen, einen expliziten
     „ohne Premium → Controls fehlen"-Test ergänzen.
- **Tests:** `pnpm test` = 0 failed. Der `[REGRESSION]`-Test zur
  `rollover:true→'accumulate'`-Migration ist grün.
- **DoD:** Lokaler `pnpm test` grün; danach im GitHub-Repo Branch-Protection auf
  `main` mit Required-Check „Lint, Typecheck & Tests" aktivieren (Repo-Setting,
  kein Code).
- **Abhängigkeiten:** keine. **Muss zuerst.**

#### T0.2 — CI härten (Testplan-Lücken) · Aufwand S
- **Ziel:** CI misst Build + Coverage und läuft nicht doppelt/leer.
- **Dateien:** `.github/workflows/ci.yml`, `vitest.config.ts`, `package.json`.
- **Schritte:**
  1. `pnpm build` (= `tsc && vite build`) als CI-Schritt ergänzen (fängt
     Prod-Build-Fehler, die `tsc --noEmit` nicht sieht).
  2. `@vitest/coverage-v8` als devDependency; `coverage`-Block in
     `vitest.config.ts`; Coverage-Schritt in CI (Schwelle zunächst nur berichten).
  3. Doppelten Trigger entschärfen: `on: [push, pull_request]` → nur
     `pull_request` **plus** `push` auf `main`, damit PR-Branches nicht doppelt laufen.
  4. Red-Team-Gates gegen Leerlauf sichern: sicherstellen, dass ein leeres
     `--testNamePattern`-Match **fehlschlägt** (z. B. Sentinel-Test je Suite).
  5. `api/` und `mcp-poc/` in den Typecheck aufnehmen (eigene tsconfig-Referenz).
- **DoD:** CI enthält Build + Coverage; PR-Branch löst genau einen CI-Lauf aus.
- **Abhängigkeiten:** T0.1.

#### T0.3 — Coding Guide als Dokument · Aufwand S
- **Ziel:** `docs/coding-guide.md` existiert (Audit Abschnitt 8 ausformuliert +
  Teil C dieses Dokuments als „verbindliche Entscheidungen").
- **DoD:** Dokument im Repo, in `CLAUDE.md`/`AI_RULES.md` verlinkt; veraltete
  Root-Dokus (TECHNICAL_IMPROVEMENTS/PERFORMANCE_OPTIMIZATIONS) mit Warnhinweis
  „veraltet, siehe Audit" versehen oder entfernt.
- **Abhängigkeiten:** keine (parallel zu T0.1).

---

### WELLE 1 — Stabilisieren (Fixen durch Refaktorieren)

#### T1.1 — Verschlüsselungs-Migration vervollständigen (F-CRYPTO-1, F-PRIV-2) · Aufwand M · **Critical**
- **Ziel:** `enable()`/`disable()` verschlüsseln bzw. entschlüsseln **alle**
  Finanz-Keys — kein Datenverlust beim Deaktivieren.
- **Vorentscheidung:** VE-6. Die Migrationsliste `sensitiveKeys`
  (`local-crypto.ts:344`) kennt nur 7 Keys; real gibt es 22 in
  `LOCAL_FINANCE_KEYS` (local-finance-store.ts:3-26) plus
  `LOCAL_CATEGORIES_KEY` (`ausgabentracker_categories_v1`) und
  `LOCAL_SETTINGS_KEY` (`ausgabentracker_user_settings_v1`) in
  `local-settings-service.ts`.
- **Dateien:** neu `src/services/local-storage-keys.ts`; `src/services/local-crypto.ts`;
  `src/services/local-finance-store.ts`; `src/services/local-settings-service.ts`.
- **Schritte:**
  1. `local-storage-keys.ts` anlegen und `LOCAL_FINANCE_KEYS`,
     `LOCAL_CATEGORIES_KEY`, `LOCAL_SETTINGS_KEY` dorthin verschieben (Re-Export
     aus den alten Dateien für Rückwärtskompatibilität lassen).
  2. In `migrateFinanceKeys` (local-crypto.ts:338) `sensitiveKeys` ersetzen durch:
     ```ts
     const sensitiveKeys = new Set<string>([
       ...Object.values(LOCAL_FINANCE_KEYS),
       LOCAL_CATEGORIES_KEY,
       LOCAL_SETTINGS_KEY,
     ])
     ```
     Das `transactions_v2__`-Präfix-Handling (Zeile 355) beibehalten.
  3. Defensiv-Guard: In `readLocalFinanceList`/`loadAndMaybeDecrypt`
     (local-crypto.ts:310) wenn ein Envelope erkannt wird, aber `cfg` fehlt
     (Verschlüsselung deaktiviert) → **werfen** statt `null`/leere Liste
     zurückzugeben. Verhindert stilles Überschreiben.
  4. Nach `enable()` (im `LocalEncryptionProvider`, F-PRIV-2) eine Assertion
     `hasPlaintextFinanceStorage() === false` laufen lassen; bei Verstoß
     Fehler-Toast statt Erfolg.
- **Tests:** `[REGRESSION]` Enable→Disable-Roundtrip mit befüllten Kollektionen
  (Budgets, Allocations, Receivables, Categories, Settings): nach `disable()`
  sind **alle** wieder als Klartext lesbar, kein Envelope-Rest, keine leere Liste.
  Falsche Passphrase wirft weiterhin.
- **DoD:** Roundtrip-Test grün über alle Keys aus `LOCAL_FINANCE_KEYS`; kein
  Zirkular-Import (Build grün).
- **Abhängigkeiten:** T0.1.

#### T1.2 — Zentraler Euro-Parser (F-MONEY-1) · Aufwand S · High
- **Ziel:** „1.200" → 1200 €, „1.234,56" → 1234.56, „12,34" → 12.34; ungültig → Fehler.
- **Vorentscheidung:** VE-2. Die **korrekte** Logik existiert bereits in
  `csv-service.ts` `parseGermanAmount` (Zeile 154): bei vorhandenem Komma erst
  Tausenderpunkte entfernen, dann Komma→Punkt. Diese Logik wird nach `money.ts`
  gehoben.
- **Dateien:** `src/lib/money.ts` (neu `parseEuroInput`);
  `src/components/transactions/TransactionFormDialog.tsx:102`;
  `src/services/transaction-service.ts:45` (`parseGermanAmount`);
  `src/components/transactions/HouseholdSplitPanel.tsx:21` (F-MONEY-6, gleiches Muster).
- **Schritte:**
  1. In `money.ts`:
     ```ts
     /** Deutsche Euro-Eingabe -> Float-Euro. Wirft bei ungültiger Eingabe. */
     export function parseEuroInput(input: string | number): number {
       if (typeof input === 'number') return input
       let s = String(input).trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '')
       if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
       const n = parseFloat(s)
       if (!Number.isFinite(n)) throw new Error('Ungültiger Betrag')
       return n
     }
     ```
  2. `TransactionFormDialog.handleSave`: `parseFloat(amount.replace(',','.'))`
     durch `parseEuroInput(amount)` ersetzen; Fehler abfangen und als Feldfehler zeigen.
  3. `csv-service.parseGermanAmount` durch `parseEuroInput` ersetzen (null→throw
     dort bereits gehandhabt; Verhalten angleichen).
  4. `HouseholdSplitPanel` (Zeile 21) ebenso.
- **Tests:** `money.test.ts` erweitern: `parseEuroInput('1.200')===1200`,
  `('1.234,56')===1234.56`, `('12,34')===12.34`, `('abc')` wirft, `('')` wirft.
- **DoD:** Kein `replace(',', '.')` mehr in UI/Services (grep leer); Tests grün.
- **Abhängigkeiten:** T0.1.

#### T1.3 — Strikte Validierung an der Persistenzgrenze (F-MONEY-4) · Aufwand M · High
- **Ziel:** `saveTransactions` speichert **nie** still 0 €/„heute".
- **Vorentscheidung:** VE-3. Betrifft alle Nicht-CSV-Pfade (Bank-Callback,
  Restore, Receipt/Letter, programmatisch).
- **Dateien:** `src/services/transaction-service.ts` (`parseGermanDate`:19,
  `parseGermanAmount`:45, `saveTransactions`:~250); Aufrufer für Fehlerbehandlung.
- **Schritte:**
  1. `parseGermanAmount`/`parseGermanDate` in `saveTransactions` durch
     werfende Varianten ersetzen (Betrag: `parseEuroInput`; Datum: bei
     unparsebar **werfen** statt `new Date()`).
  2. Den `toISOString().split('T')[0]`-Fallback (Zeile 40) durch eine
     UTC-basierte Formatierung ersetzen (kein Tag-Rückversatz in TZ > UTC).
  3. Aufrufer (BankCallback via T1.6, Restore via T1.4, Receipt/Letter) fangen
     den Fehler und melden die betroffene Buchung, statt sie zu verschlucken.
- **Tests:** `[REGRESSION]` `saveTransactions` mit kaputtem Datum wirft (statt
  „heute"); mit kaputtem Betrag wirft (statt 0). Gültige Buchung unverändert.
- **DoD:** Kein stiller Nullwert-Pfad mehr (Invariante 18 auch außerhalb CSV).
- **Abhängigkeiten:** T1.2.

#### T1.4 — Backup-Restore idempotent (F-BACKUP-1) · Aufwand M · **Critical**
- **Ziel:** Restore verdoppelt keine Daten; UI-Text = reales Verhalten.
- **Vorentscheidung:** VE-5 (Merge per ID). `restoreTransactions`
  (backup-service.ts:415) macht `{ ...tx, id: undefined }` → neue UUID → Anhängen.
  `restoreAccounts`/`restoreCategories` analog.
- **Dateien:** `src/services/backup-service.ts` (restore*);
  `src/components/BackupManager.tsx` (UI-Texte).
- **Schritte:**
  1. In `restoreTransactions` das ID-Stripping entfernen → **Original-`id`
     behalten**. Der Store dedupliziert per `knownIds`
     (transaction-storage-service.ts:320) → identische Buchung wird
     übersprungen statt dupliziert.
  2. `restoreAccounts`/`restoreCategories`: ebenfalls Original-IDs behalten
     (`createAccount`/`saveCategory` mit ID; falls die keine ID akzeptieren,
     eine `upsertById`-Variante ergänzen).
  3. Vor Restore ein automatisches lokales Sicherungs-Backup anlegen (Snapshot
     der aktuellen Kollektionen).
  4. UI-Texte in `BackupManager.tsx` von „überschreiben/ersetzen" auf
     „zusammenführen (bestehende bleiben, fehlende werden ergänzt)" ändern.
- **Tests:** `[INTEGRITY]` Restore-Roundtrip: Backup → Restore auf **gleiche**
  Daten → Anzahl unverändert (nicht verdoppelt). Restore auf leeres Gerät →
  Kategorie-IDs der Buchungen bleiben gültig.
- **DoD:** Zweifaches Restore ändert die Anzahl nicht; UI-Text stimmt.
- **Abhängigkeiten:** T1.3 (nutzt striktes `saveTransactions`).

#### T1.5 — CSV-Export reparieren (F-MONEY-2) · Aufwand S · High
- **Ziel:** Negative Beträge bleiben Zahlen; Formel-Injection nicht umgehbar;
  Spaltenstruktur bei `;`/Newline intakt; Kategorienamen statt IDs.
- **Vorentscheidung:** RFC-4180-Quoting + Formel-Präfix **nach** dem Quoting;
  numerische Zellen vom Präfix ausnehmen. Export-Delimiter bleibt `;`.
- **Dateien:** `src/services/transaction-storage-service.ts` (`exportToCSV`:184,
  `sanitizeCell`:192); Kategorien-Auflösung.
- **Schritte:**
  1. Zentrale `escapeCsvCell(value)`:
     ```ts
     function escapeCsvCell(value: unknown): string {
       let s = String(value ?? '')
       const isNumeric = /^-?\d+(?:[.,]\d+)?$/.test(s)
       if (!isNumeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`   // Formel neutralisieren
       if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"` // RFC-4180-Quoting
       return s
     }
     ```
  2. In `exportToCSV` `sanitizeCell` durch `escapeCsvCell` ersetzen; Betragszelle
     bleibt Zahl (kein Präfix, da `isNumeric`).
  3. `category`-Spalte: `tx.category` ist nie gesetzt → über eine Kategorien-Map
     den **Namen** aus `category_id`/`subcategory_id` auflösen.
- **Tests:** `[REGRESSION]` Export mit `amount:-12,34` → enthält `;-12,34;`
  (kein `'`). `[SECURITY]` `payee='Shop;=HYPERLINK("x","y")'` → Zelle gequotet,
  Formel neutralisiert, Spaltenzahl stimmt. `\t=1+1` wird neutralisiert.
- **DoD:** Excel-Summe über Betragsspalte stimmt; Injection-Test grün.
- **Abhängigkeiten:** keine.

#### T1.6 — Bank-Import vereinheitlichen (F-ARCH-1 + Dedupe F-ARCH-2) · Aufwand M · **Critical**
- **Ziel:** Ein Import-Pfad; keine Doppelbuchungen bei Reload/Erst-Sync.
- **Vorentscheidung:** `BankCallbackPage.importTransactionsForAccount`
  (BankCallbackPage.tsx:220) wird **gelöscht** und durch
  `syncAccountTransactions(account)` aus `gocardless-sync-service.ts` ersetzt
  (enthält Dedupe, `counterparty_iban`, `reconcileInternalTransfers`,
  `opening_balance`, `last_sync_at`).
- **Dateien:** `src/pages/BankCallbackPage.tsx`;
  `src/services/gocardless-sync-service.ts` (Dedupe-Identifier:278).
- **Schritte:**
  1. In `BankCallbackPage` nach dem Verknüpfen je Konto `syncAccountTransactions`
     aufrufen; die UI-eigene Import-Schleife (220–~275) entfernen.
  2. Dedupe-Identifier-Fix (F-ARCH-2): Identifier (Zeile 278) und gespeicherten
     `original_text` (Zeile 289/301) aus **derselben** normalisierten
     (auf 200 Zeichen gesliceten) Description bilden.
- **Tests:** `[INTEGRITY]` Callback-Import, dann `syncAccountTransactions` über
  dasselbe Fenster (Bankdaten ohne `remittanceInformationUnstructured`) → Anzahl
  unverändert. `[REGRESSION]` zweifacher Sync mit 250-Zeichen-Verwendungszweck →
  `skippedCount=1`, keine zweite Buchung.
- **DoD:** Zweiter Callback-Durchlauf erzeugt keine Duplikate.
- **Abhängigkeiten:** T1.3.

#### T1.7 — Aggregation zentralisieren (F-MONEY-3) · Aufwand S · High
- **Ziel:** PDF-Export, Premium-Dashboard, Dashboard, Sankey nutzen **dieselbe**
  transferbereinigte Summenlogik.
- **Vorentscheidung:** VE-4. `excludeTransfers()` existiert bereits
  (transaction-service.ts:286).
- **Dateien:** `src/components/DataExport.tsx:102` (`downloadPDF`);
  `src/components/premium-dashboard/ResponsivePremiumDashboard.tsx:71`;
  ggf. eine `sumIncome/sumExpenses`-Helper in `lib/analysis-data.ts`.
- **Schritte:**
  1. In `lib/analysis-data.ts` `sumIncome(txs)`/`sumExpenses(txs)` exportieren,
     die intern `excludeTransfers` anwenden.
  2. `DataExport.downloadPDF` und `ResponsivePremiumDashboard.financialData` auf
     diese Helper umstellen; lokale `reduce`-Ketten entfernen.
- **Tests:** `[INTEGRITY]` mit Transfer-Paar (+1000/−1000, `is_transfer`) →
  `totalIncome`/`totalExpenses` in PDF **und** Premium-Dashboard identisch zum
  Datensatz ohne Transfer und identisch zum Dashboard.
- **DoD:** Alle vier Ansichten liefern für denselben Datensatz gleiche Summen.
- **Abhängigkeiten:** keine.

#### T1.8 — Gemischt-signierte Splits ablehnen (F-MONEY-5) · Aufwand S · High
- **Ziel:** Split-Anteile haben alle das Vorzeichen der Originalbuchung.
- **Dateien:** `src/services/transaction-allocation-service.ts:63`
  (`validateAllocations`); `src/components/transactions/TransactionSplitPanel.tsx:136`.
- **Schritte:**
  1. In `validateAllocations` zusätzlich prüfen: alle `amount_minor` haben
     dasselbe Vorzeichen wie `toMinor(tx.amount)` (0 erlaubt) → sonst werfen.
  2. Im Panel Eingaben als Absolutwerte behandeln und beim Speichern mit dem
     Transaktionsvorzeichen versehen.
- **Tests:** `[INTEGRITY]` `validateAllocations({amount:-10}, [600, -1600])` wirft.
- **DoD:** „Rest hier eintragen"-Fluss erzeugt keine gemischten Vorzeichen mehr.
- **Abhängigkeiten:** keine.

#### T1.9 — Vertragsentscheidung überlebt IBAN-Merge (F-CONTRACT-1) · Aufwand M · High
- **Ziel:** Ein abgelehnter/beendeter Vertrag reaktiviert sich nicht bei zweiter IBAN.
- **Dateien:** `src/lib/contract-derivation.ts:194`.
- **Schritte:** Beim Merge mehrerer IBAN-Gruppen die Entscheidungen **aller**
  Quell-Fingerprints auflösen (alle IBAN-Keys + Merchant-Key), Priorität
  `rejected/ended > paused > active`. Alternativ: Entscheidung beim Speichern
  zusätzlich unter dem Merchant-Fingerprint ablegen.
- **Tests:** `[REGRESSION]` als `rejected` markierte Familie bleibt nach Auftauchen
  einer zweiten IBAN `rejected`; `isActiveForTotals === false`.
- **DoD:** Test grün; kein stiller Reaktivierungspfad (Invariante 9).
- **Abhängigkeiten:** keine.

#### T1.10 — eToro-Credentials schützen (F-DEBT-1) · Aufwand M · High
- **Ziel:** API-Keys nie im Klartext/in unverschlüsselten Backups; UI-Text wahr.
- **Vorentscheidung:** Credentials werden **nur** gespeichert, wenn lokale
  Verschlüsselung aktiv ist; sonst Speicherung verweigern (klarer Hinweis).
  Portfolio-`provider_config` wird aus unverschlüsselten Backups ausgeschlossen.
- **Dateien:** `src/services/etoro-service.ts:161`;
  `src/services/backup-service.ts` (Portfolio-Serialisierung);
  `src/components/.../EtoroConnectDialog.tsx:140` (Text).
- **Schritte:**
  1. In `connectEtoroAccount` `provider_config` mit Keys nur schreiben, wenn
     `localEncryption` aktiv; sonst werfen mit Hinweis „Bitte zuerst lokale
     Verschlüsselung aktivieren".
  2. Beim **unverschlüsselten** Backup `provider_config` (Keys) redigieren.
  3. Dialog-Text: entweder „verschlüsselt gespeichert (nur bei aktiver lokaler
     Verschlüsselung)" oder ehrlich „im Klartext auf diesem Gerät".
- **Tests:** eToro-Connect ohne aktive Verschlüsselung wirft; unverschlüsseltes
  Backup enthält keine `apiKey`/`userKey`.
- **DoD:** Kein Klartext-Key in unverschlüsseltem Storage/Backup.
- **Abhängigkeiten:** T1.1.

#### T1.11 — Fremdwährung im Nettovermögen (F-DEBT-2) · Aufwand M · High
- **Ziel:** USD-Positionen verfälschen das EUR-Nettovermögen nicht.
- **Vorentscheidung:** VE-1 (EUR-only). Positionen mit `currency ≠ portfolio.currency`
  werden aus `total_value` **ausgeschlossen** und in der UI als „nicht
  umgerechnet" markiert (keine FX-Integration in dieser Welle).
- **Dateien:** `src/services/portfolio-service.ts:151` (`getPortfolioSummary`);
  `src/services/net-worth-service.ts:112`; `src/pages/NetWorthPage.tsx`.
- **Schritte:** In `getPortfolioSummary` Mischwährung erkennen, Nicht-Basiswährung
  aus der Summe nehmen, Flag `hasUnconvertedPositions` zurückgeben; UI kennzeichnet.
- **Tests:** Portfolio mit USD-Position → `total_value` enthält sie nicht; Flag true.
- **DoD:** Nettovermögen ohne stille Fremdwährungs-Vermischung.
- **Abhängigkeiten:** VE-1 bestätigt.

#### T1.12 — DSGVO: Bank-Consent-Widerruf + accounts-Löschung (F-PRIV-4, F-SEC-4-Nachbar) · Aufwand M · High
- **Ziel:** Konto-Löschung beendet GoCardless-Requisitionen und löscht `accounts`.
- **Dateien:** `supabase/functions/delete-account/index.ts` (:25 USER_SCOPED_TABLES,
  :134 Requisition-Suche).
- **Schritte:**
  1. Requisitionen direkt bei GoCardless über die Reference-Konvention suchen
     (`reference` startsWith `${userId}:`) und beenden — statt in leerer
     Cloud-Tabelle `bank_connections`.
  2. `accounts` (und alle user-scoped Tabellen) explizit in `USER_SCOPED_TABLES`
     aufnehmen und in Kind→Eltern-Reihenfolge **vor** `deleteUser` löschen.
- **Tests:** `[INTEGRITY]` nach `delete-account` keine Zeile der uid in
  irgendeiner Tabelle (information_schema-getrieben); Requisition-Beendigung
  aufgerufen (GoCardless-Client gemockt).
- **DoD:** Löschung widerruft Bankzugriff nachweislich.
- **Abhängigkeiten:** T1.13 (DDL für `accounts`).

#### T1.13 — Fehlende Supabase-DDL versionieren (F-SEC-4) · Aufwand M · High
- **Ziel:** RLS/FK/CASCADE der sensibelsten Tabellen sind auditierbar.
- **Dateien:** neue Migration in `supabase/migrations/` für `accounts`,
  `bank_connections` (+ ggf. `milestones`, `sync_metadata`, `analytics_consent`,
  `encrypted_analytics_blobs`, `user_category_priorities`, Basis-DDL
  `user_settings`/`categories`).
- **Schritte:** Ist-Zustand aus dem Supabase-Dashboard exportieren, als Migration
  festschreiben; sicherstellen: RLS on, `auth.uid()=user_id`-Policies mit
  `WITH CHECK`, FK `ON DELETE CASCADE` auf `auth.users`.
- **Tests:** `[SECURITY]` pg_policies-Dump: jede `user_id`-Tabelle hat RLS on +
  Policies mit WITH CHECK (als CI-fähiger Test gegen eine lokale Supabase-Instanz
  oder als dokumentierter manueller Check).
- **DoD:** Keine user-Tabelle ohne versionierte RLS.
- **Abhängigkeiten:** Zugriff aufs Supabase-Dashboard (⚠ Klärung nötig).

#### T1.14 — get-balances absichern + Rate-Limit fixen (F-SEC-2, F-SEC-3) · Aufwand M · High
- **Dateien:** `supabase/functions/gocardless-sync/index.ts:593`;
  `supabase/functions/refresh-balances/index.ts:158`.
- **Schritte:**
  1. `get-balances`: vor `getAccountBalances` dieselbe Ownership-Prüfung wie
     `get-transactions` (`assertRequisitionBoundToUser` + `allowedAccounts.includes`)
     — oder die ungenutzte Aktion entfernen.
  2. `balance_refresh_limits`: Zähler mit `service_role`-Client schreiben und das
     RLS-Schreibrecht des Nutzers auf `SELECT` der eigenen Zeile reduzieren
     (Migration + Function).
- **Tests:** `[SECURITY]` Nutzer B → `get-balances` mit A's `account_id` → 403;
  Nutzer kann `daily_count` nicht per anon-Client zurücksetzen.
- **DoD:** Kein IDOR; Rate-Limit nicht mehr umgehbar.
- **Abhängigkeiten:** T1.13.

#### T1.15 — CSP härten (F-SEC-1) · Aufwand S · High
- **Vorentscheidung:** VE-7 (Vercel produktiv, Netlify entfernen).
- **Dateien:** `vercel.json:30`; `netlify.toml` (entfernen); `SECURITY_HEADERS.md`.
- **Schritte:** `ws: wss:` entfernen; `*.supabase.co` auf die eigene Projekt-URL;
  `img-src https:` auf konkrete Hosts; jsdelivr durch selbst gehostete
  Tesseract-/pdfjs-Assets ersetzen; `Permissions-Policy` ergänzen. Doku angleichen.
- **Tests:** Manueller Header-Check am Preview-Deploy; kein `ws:` in Prod-CSP.
- **DoD:** CSP minimal; nur eine Deployment-Config.
- **Abhängigkeiten:** VE-7 bestätigt.

#### T1.16 — Privacy-Seite an reale Flüsse angleichen (F-PRIV-1, F-PRIV-3, F-MCP-2) · Aufwand M · High
- **Ziel:** Privacy-Seite ↔ Code deckungsgleich (Kernversprechen der App).
- **Dateien:** `src/lib/privacy-status.ts:31` (`derivePrivacyStatus`,
  `NEVER_SHARED`); `src/pages/PrivacyPage.tsx`; `src/components/privacy/*`;
  `src/services/forecast-overrides-service.ts:87` (localStorage → Store).
- **Schritte:**
  1. `derivePrivacyStatus` um MCP-Sync-Status, Bank-Sync (eingeloggt) und
     Kursabruf erweitern; bei aktivem MCP-Sync „Kategorien & Budgets" aus
     `neverShared` nehmen und als „Finanz-Aggregate (MCP, Opt-in)" unter
     `sharedWithServer` führen.
  2. `forecast_forecast_overrides_v1` und Dismiss-Keys mit Klartext-Namen aus
     `localStorage` in den `local-finance-store` verschieben (VE-8) bzw. hashen;
     `clearAllLocalData` deckt sie ab.
  3. Analytics-Aussage korrigieren (Code sendet aktuell nie).
- **Tests:** `[REGRESSION]` `derivePrivacyStatus(..., mcpSyncEnabled=true)` →
  `sharedWithServer` enthält MCP-Eintrag; `neverShared` ohne „Kategorien & Budgets".
  Guard-Test: kein Finanzdaten-Key in `localStorage`.
- **DoD:** Jede Aussage der Privacy-Seite ist am Code belegbar.
- **Abhängigkeiten:** T1.1 (Store-Verschiebung).

---

### WELLE 1 (UX-Korrektheit — gleiche Welle, geringeres Risiko)

#### T1.17 — Echtes Undo / Löschbestätigung / Bulk-Recategorize (F-UX-1, F-UX-2, F-UX-4) · Aufwand M · High
- **Dateien:** `src/components/settings/EnhancedSettings.tsx:168` (Fake-Undo);
  `src/services/transaction-service.ts:461` (Bulk-Recategorize);
  `src/pages/TransactionsPage.tsx:194` (Löschen ohne Dialog).
- **Schritte:**
  1. Fake-`handleUndo` durch echtes Undo ersetzen (Snapshot von
     `{id, category_id, subcategory_id, auto_mapped, confirmed}` vor
     `recategorizeTransactions`) **oder** Button entfernen, bis Undo existiert.
  2. Bulk-Recategorize: `subcategory_id` konsistent setzen/nullen;
     `confirmed`-Buchungen nur mit explizitem Opt-in überschreiben.
  3. `TransactionsPage` nutzt `DeleteConfirmationDialog` (wie Dashboard);
     Löschung als Audit-Eintrag.
- **Tests:** Undo stellt Kategorien wieder her (Invariante 12); Bulk-Recategorize
  aktualisiert `subcategory_id`; Löschen erfordert Bestätigung.
- **DoD:** Keine irreversible Sammeländerung ohne echtes Undo.
- **Abhängigkeiten:** keine.

#### T1.18 — Coach-Kennzahlen korrigieren (F-UX-3) · Aufwand M · High
- **Dateien:** `src/services/coach-service.ts:66`.
- **Schritte:** Monatswerte über `computeTypicalMonth`/`monthlyAverages` ableiten
  (nicht All-time-Summen als Monat); „Notgroschen" aus `netWorth.cash /
  Monatsausgaben`; Berechnung als **pure Funktion** `computeCoachOverview`
  extrahieren (analog `computeFinancialHealth`).
- **Tests:** Roadmap-Stufe bei 12 Monaten Historie vs. 3 Buchungen plausibel und
  konsistent zum Health-Score.
- **DoD:** Coach-Stufe widerspricht dem Health-Score nicht mehr.
- **Abhängigkeiten:** keine.

#### T1.19 — Filter-/Chart-Klassifikation vereinheitlichen (F-UX-5) · Aufwand M · High
- **Dateien:** `src/components/dashboard/filter-utils.ts:125`.
- **Schritte:** Filter auf `assignedId = subcategory_id ?? category_id` umstellen;
  `resolveAusgabenklasse`/`essenziell`-Vererbung nutzen; `toSuperId`-Mapping und
  Filter-Mapping in **eine** Funktion ziehen; allocation-bewusst filtern.
- **Tests:** Klick auf Sunburst-Segment → Summe der gefilterten Liste = Segment.
- **DoD:** Drilldown-Summe = Segmentsumme (auch bei Sub-Overrides/Splits).
- **Abhängigkeiten:** keine.

---

### WELLE 1 (Performance-Basis — verhindert, dass Welle 3 auf langsamer Basis baut)

#### T1.20 — Chunked Base64 (F-PERF-1) · Aufwand S · High
- **Dateien:** `src/services/local-crypto.ts:70` (`b64encode`).
- **Schritte:** Byteweise String-Konkatenation ersetzen durch
  `String.fromCharCode.apply` über 8-KB-Blöcke oder `Uint8Array.prototype.toBase64`
  (mit Feature-Detection + Fallback).
- **Tests:** Roundtrip-Korrektheit (bestehende Crypto-Tests bleiben grün);
  Micro-Benchmark optional.
- **DoD:** Write-Latenz bei 50k Buchungen deutlich < 6 s.
- **Abhängigkeiten:** T1.1 (gleiche Datei).

#### T1.21 — Query-Key-Kollision + Ladelimits (F-PERF-3, F-DATA-1) · Aufwand M · High
- **Vorentscheidung:** VE-9.
- **Dateien:** `src/hooks/useAutomationSuggestions.ts:26`;
  `src/pages/Dashboard*`, `TransactionsPage`, `ResponsivePremiumDashboard`;
  `src/services/net-worth-service.ts`, `finance-foundation-service.ts`.
- **Schritte:**
  1. Query-Key um Limit erweitern (`['transactions', limit]`) **oder** eine
     gemeinsame `useTransactions()`-Hook mit einheitlichem Limit.
  2. Saldo-/Export-Pfade auf ungedeckelte Chunk-Iteration umstellen; Anzeige-Listen
     behalten Limit, entkoppelt von Berechnungen.
- **Tests:** Coach-zuerst-Öffnen verändert Dashboard-Summen nicht; Kontostand
  korrekt bei > Limit Buchungen.
- **DoD:** Keine still falschen Summen durch Cache/Limit.
- **Abhängigkeiten:** keine.

#### T1.22 — Virtualisierung (F-PERF-2) · Aufwand M · High
- **Dateien:** `src/components/dashboard/TransactionTable.tsx:110`;
  `package.json`; `src/lib/performance.ts` (Debounce existiert).
- **Schritte:** `@tanstack/react-virtual` in TransactionTable einsetzen;
  `react-window` + `@types/react-window` entfernen; Suchfeld mit 300 ms debouncen.
- **Tests:** Render-Smoke mit 5000 Zeilen; nur ~Fenstergröße im DOM.
- **DoD:** Buchungsseite flüssig bei mehreren Tausend Zeilen.
- **Abhängigkeiten:** keine.

---

### WELLE 2 — Strukturieren (nur was Features tragen)

Kompakte Cards (Detailtiefe wie oben on demand):

- **T2.1 Zentrale zod-Schemas (VE-10):** Schemas in `src/lib/schemas/` für
  Transaction, Backup, Vault, Import, Snapshot; blindes `JSON.parse as T` an
  Storage-/Datei-Grenzen ersetzen. (F-VAL-*: local-finance-store, snapshot-sync,
  backup-service.) *Test:* manipuliertes Feld/`__proto__`-Key wird abgewiesen.
- **T2.2 Ein Sync-Format:** UI-Sync auf `vault-format.ts` (getestet, mit Merge +
  KDF-aus-Envelope, F-CRYPTO-2/F-SYNC-1) umstellen; `snapshot-sync-service`
  destruktiven Import ersetzen (Versionsvergleich + Sicherungs-Snapshot).
- **T2.3 Zeichensatzerkennung CSV:** ISO-8859-1/Windows-1252/BOM erkennen
  (`csv-service`), statt immer UTF-8. *Test:* Latin-1-CSV mit Umlauten.
- **T2.4 Domänen-Ordner:** `services/` (77) und `lib/` (61) nach Domänen ordnen
  (`transactions/`, `debts/`, `budgets/`, …); Domänentypen aus `components/`
  (contract-types) nach `lib/`/`types` ziehen.
- **T2.5 Doppelte Testdateien bereinigen:** je Paar
  (`services/*.test.ts` vs. `__tests__/*.test.ts`) zusammenführen; nur eine Quelle.
- **T2.6 Feature-Gate-Konsistenz:** ungebundene FeatureKeys (`basicForecast`,
  `advancedForecast`, `receiptLineItems`) an echte Gates binden oder aus der
  Matrix entfernen (F-GATE-2); Trading-Route reaktiv lesen (F-GATE-1,
  `App.tsx:116` → `useFeatureFlag`).
- **T2.7 MCP-Korrektheit:** `cashflow.month` = aktueller Monat (F-MCP-1);
  `generated_at` in jede Tool-Antwort (F-MCP-2); Klartext-Token nicht dauerhaft
  in localStorage (F-MCP-3); Consent-Text um „Kategorie-/Budgetnamen" ergänzen
  (F-MCP-4).
- **T2.8 God-Components entflechten:** `DebtsPage` (681), `LiquidityReport` (1009)
  in Präsentation + Logik-Hooks aufteilen; Logik nach `lib/`.

---

### WELLE 3 — Features (nach neuem Guide)

Reihenfolge innerhalb Welle 3 nach Abhängigkeiten:

1. **#52 Stripe + Entitlements (RLS):** setzt saubere Supabase-DDL (T1.13) und
   DSGVO-Löschung (T1.12) voraus. `useTier()` liest Entitlements; Webhook
   idempotent. *Guide:* Edge-Function prüft Tier serverseitig (heute nur JWT).
2. **#53 Gating scharf schalten:** setzt #52 + T2.6 voraus. Gating-Matrix-Test um
   die neuen Features erweitern; Locked-Preview mit echten (geblurrten) Daten.
3. **#54 Design-System „Ruhe":** kann **parallel ab Welle 1** laufen (andere
   Dateien): Tokens in `tailwind.config.js`, Monochrom-Chart-Rampe,
   Schwellenwert-Delta-Färbung als getestete util, Copy-Audit, `tabular-nums`.
4. **#37 Desktop-Vault-Sync (File System Access API):** setzt T2.2 (ein
   Vault-Format mit Merge) voraus.
5. **#38 Android-Vault-Sync (SAF/Share-Sheet):** setzt #37 + Fix des stillen
   Android-Download-Fehlschlags (F-BACKUP-Android: `@capacitor/filesystem` +
   Share/SAF statt Blob-Anchor) voraus.

---

## Teil E — Trackingverse-Modulgrenzen (Querschnitt ab Welle 2)

- **Router-Basename:** App muss unter einem Pfadpräfix lauffähig sein
  (`<BrowserRouter basename>`), damit sie als Sub-Route eines Host-Produkts läuft.
- **Key-Namespacing:** alle Storage-Keys über die Registry (VE-6) mit
  Modulpräfix; kein globaler unpräfixierter Key (`skin`, `gentleMode`, `error_log`).
- **Keine globalen Singletons** mit App-weitem Zustand außerhalb der Provider.
- **Shared vs. Modul:** `lib/money`, `lib/schemas`, Krypto, Storage-Abstraktion
  sind Shared-Kandidaten (eigenes Package); FinTrack-spezifische Domänen bleiben
  im Modul.
- **Ein öffentliches Modul-Interface** (Entry-Point), das der Host einbindet —
  keine tiefen Imports in interne Dateien.

---

## Teil F — Abhängigkeits-Kurzübersicht (was blockiert was)

```
T0.1 (CI grün) ── blockiert ──> alle Wellen-1-Tests verlässlich
T0.3 (Guide)   ── Zielbild ──> jeder Fix/jedes Feature
VE-6 Registry  ──> T1.1 (Krypto-Keys)
T1.2 (Parser)  ──> T1.3 (strikte Persistenz) ──> T1.4 (Restore), T1.6 (Bank)
T1.1 (Krypto)  ──> T1.10 (eToro), T1.16 (Privacy/localStorage), T1.20 (Base64)
T1.13 (DDL)    ──> T1.12 (DSGVO), T1.14 (get-balances) ──> #52 (Stripe)
T2.2 (Vault)   ──> #37 ──> #38
#52 ──> #53
#54 parallel ab Welle 1
```

**Empfohlener erster Sprint (1 Woche):** T0.1, T0.3, T1.2, T1.5, T1.7, T1.1.
Alle sechs sind S/M, testbar, ohne externe Klärung (außer VE-6, das trivial ist)
— und beseitigen die sichtbarsten Geld-/Datenverlust-Risiken plus das CI-Gate.
