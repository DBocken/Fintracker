# Qualitätsprogramm 10/10 — geltender Arbeitsplan

> **Geltend, bis abgearbeitet.** Grundlage ist das Audit vom 2026-08-08
> ([`audit.md`](audit.md), Stand `main@067244f`) — dort stehen alle Belege.
> Befund-IDs (RES-1, DOM-2, …) verweisen dorthin. Nach Abschluss wandert das
> Verzeichnis nach `docs/archive/`.
>
> **Wo das Programm gerade steht und wie man wieder einsteigt:**
> [`status.md`](status.md). **Wo dieser Plan an der Wirklichkeit vorbeizielte
> und was stattdessen gilt:** [`nachpruefung.md`](nachpruefung.md) — dort
> stehen unter anderem die Abweichungen von Arbeitsregel 2 (ein PR je Paket)
> und Arbeitsregel 5 (Modellwahl), die in dieser Ausführungsumgebung nötig
> waren.

## Arbeitsregeln für den ausführenden Agenten

1. **`AGENTS.md` zuerst lesen — sie gilt auch gegenüber diesem Plan.**
   „Absicht vor Auftrag" heißt hier: Stimmt ein Beleg nicht mehr (Code hat
   sich bewegt), wird das *Ziel* des Pakets geprüft, nicht der Wortlaut
   abgearbeitet. Zeilennummern im Audit altern absichtlich — vor jedem Edit
   neu verifizieren.
2. **Ein Arbeitspaket = ein PR.** Logische Commits mit Tests, Commit-Message
   nennt Ziel + Test-Abdeckung (§11). Innerhalb einer Phase ist die
   Reihenfolge frei, Abhängigkeiten (unten je Paket) sind bindend.
3. **Jeder PR hakt sein Kästchen in diesem Plan ab** (im selben PR) und
   ergänzt hinter dem Kästchen die PR-Nummer. Der Plan ist damit zugleich
   Fortschrittsprotokoll.
4. **Definition of Done, global:** alle Wächter grün (`pnpm lint`, `pnpm
   test`, `pnpm exec tsc --noEmit`, die `check:*`-Batterie) · neue UI-Texte in
   allen `SUPPORTED_LOCALES` **plus** everyday-Overlays, bilinguale Tests ·
   `[REGRESSION]` für jeden behobenen Bug, `[SECURITY]` in §10-Klassen im
   selben Commit, `[ZUSTAND …]`-Tags wo Flächenzustände entstehen/ändern ·
   TDD: Test zuerst rot, dann Implementierung.
5. **Modell-Hinweise je Paket:** (H) mechanisch, Haiku genügt · (S) Sonnet ·
   (O) Entwurfs-/Entscheidungsarbeit, Opus selbst. Der Orchestrator darf
   delegieren, verantwortet aber Review und Selbst-Review-Punkte.
6. **Nichts stapeln:** Pakete, die dieselben Dateien berühren (z. B. 1.1/1.2
   in `local-finance-store.ts`), nacheinander mergen, nicht parallel.

## Vorentschiedenes (nicht neu aufrollen)

Diese Entscheidungen sind nach Einwand-Abwägung getroffen; wer abweichen
will, braucht neue Fakten, nicht neuen Geschmack:

- **Persistenzformat von `Transaction.amount` bleibt Euro-Float.** Eingelöst
  wird Invariante 5 über cent-genaue Validierung an der Schreibgrenze
  (WP 2.5) plus Branded Types (WP 5.1). Eine Umstellung der Persistenz auf
  Integer-Cent wäre eine Migration durch Backups, CSV, Sync und alle
  Konsumenten — sie ist **außerhalb dieses Programms** und bräuchte eine
  eigene ADR.
- **Kein clientseitiges Verschlüsseln des MCP-Payloads** (SEC-5): der
  Serverless-Endpunkt muss den Payload lesen, um MCP-Antworten zu bauen —
  Verschlüsselung bräche das Feature. Stattdessen UI-Kennzeichnung (WP 3.5)
  und schärferer RLS-Wächter (WP 3.4).
- **Blob-Ablösung als Zeit-Chunks, nicht Einzeleinträge** (PERF-1):
  *Körnung revidiert in WP 4.1a: **Quartal**, nicht Monat — gemessen, Zahlen in
  `docs/architecture/transaction-storage-chunks.md`. Die Begründung unten bleibt
  unberührt, sie richtet sich gegen Einzeleinträge.*
  Einzeleinträge bedeuten 5 000 Crypto-Operationen je Import und je
  Vollexport; Monats-Chunks begrenzen die Größe je Schreibvorgang auf einen
  Monat und bleiben beim Vollexport in ~120 Operationen. Details klärt die
  ADR in WP 4.1 — das ist die Vorgabe, gegen die sie argumentieren müsste.
- **CSP `style-src 'unsafe-inline'` wird akzeptiert und dokumentiert**
  (SEC-6): mit Tailwind + dynamischen Inline-Styles ist ein Nonce-Umbau
  unverhältnismäßig (WP 7.6).
- **Pre-Commit-Bypass wird akzeptiert und dokumentiert** (GOV-6): CI ist der
  verbindliche Zaun; Telemetrie über lokale Hook-Ausführung lohnt den Aufwand
  nicht (WP 7.6).

## Reihenfolge für den Einstieg

Phase 1 und 2 zuerst (P0), untereinander so: **1.1 → 2.1 → 2.2 → 1.2 → 1.3 →
Rest von Phase 1 → Rest von Phase 2**. Danach sind Phase 3 und 4 unabhängig
voneinander; Phase 5–7 folgen. Einzige harte Kanten: 1.3 vor 4.1 · 2.3 vor
allen Phase-6-Migrationen · 3.2 vor 7.3 · 5.1 vor 5.2.

---

## Phase 1 — Datenverlust unmöglich machen (P0)

### - [x] WP 1.1 · Envelope-Korruption wirft statt schluckt (RES-1) · S — `2c3d5de`
**Ziel:** Ein korrupter verschlüsselter Envelope darf nie wieder als „keine
Daten" gelesen und beim nächsten Schreiben überschrieben werden.
**Vorgehen (Test-First):**
1. `[REGRESSION]`-Test, der die heutige Fehlkette nachstellt: korrupten
   Envelope in fake-IndexedDB legen → `upsertLocalFinanceItem` → Bestand ist
   weg. Test dokumentiert das Soll: Fehler statt Leerliste.
2. `loadAndMaybeDecrypt`: Parse-/Decrypt-Fehler bei vorhandenem Rohwert wird
   ein typisierter Fehler (z. B. `VaultCorruptError`) — spiegelbildlich zum
   Klartext-Zweig, der schon wirft. `null` bleibt ausschließlich „Key
   existiert nicht".
3. `readLocalFinanceList`/Aufrufer: Der Fehler erreicht die Fläche als
   Fehlerzustand (Query-Error), nie als Leerzustand. Schreiboperationen auf
   eine Collection im Fehlerzustand werden verweigert.
4. UI-Text („Daten dieser Kategorie sind beschädigt — Backup einspielen")
   i18n-vollständig; `[ZUSTAND /route:fehler]`-Tags wo betroffen.
**Akzeptanz:** Regressionstest grün · kein Codepfad macht aus Korruption ein
leeres Array · `pnpm check:state-coverage` unverändert grün.

### - [x] WP 1.2 · zod an der Kern-Lesegrenze (RES-2, DOM-2) · S — `6404429` (Teil A)
**Ziel:** `parseAtBoundary` gilt für den Bestand, nicht nur für drei neue
Domänen — AGENTS.md §8 wird wahr.
**Vorgehen:** Schemata für `Transaction`, `Account`, `Category`, `Budget`,
`Debt`, `Receivable` und die übrigen `LOCAL_FINANCE_KEYS`-Collections in
`src/lib/schemas/`; Einbau in `readLocalFinanceList` und
`transaction-storage-service`. **Verhalten je ungültigem Item:** überspringen,
zählen, dem Nutzer melden („3 Einträge unlesbar, Backup prüfen") — nie still
verwerfen, nie alles-oder-nichts. Backup-Restore (WP 1.5) und CSV-Import
nutzen dieselben Schemata. Performance messen (5 000 Items): Budget ≤ 50 ms
zusätzlich beim Kaltstart, sonst Validierung in den bestehenden Worker
verlagern und das im PR belegen.
**Akzeptanz:** Manipulierter Einzeldatensatz erreicht nie die Render-Schicht
(`[REGRESSION]`-Test) · Meldung i18n-vollständig · Kaltstart-Messung im PR.

### - [x] WP 1.3 · Echter Migrationsläufer an `LOCAL_STORE_SCHEMA_VERSION` (RES-3) · S/O — `c765da1`
**Ziel:** Strukturänderungen persistierter Daten haben einen Aufhänger:
nummerierte, getestete, genau einmal laufende Schritte.
**Vorgehen:** Läufer in `src/services/` (Liste `migrations[n]`, läuft
lückenlos von gespeicherter zu aktueller Version, schreibt die Version erst
nach Erfolg); die bestehenden Lazy-Feld-Migrationen bleiben unberührt, neue
strukturelle Migrationen gehen nur noch über den Läufer. Je Schritt ein
Roundtrip-Test „alte Form rein → neue Form raus". Zusätzlich den fehlenden
**Crash-mid-Migration-Test** für die Umschlüsselung nachrüsten (Audit,
„Solide"-Absatz Resilienz).
**Akzeptanz:** Läufer mit Test je Schritt · Abbruch mitten im Lauf lässt den
Store lesbar zurück (Test) · genutzt von WP 4.1.

### - [x] WP 1.4 · Sync-Import: Versionsvergleich + Bestätigung (RES-4) · S — `ff348fa`
**Ziel:** Ein älterer Snapshot löscht nie unbestätigt neuere Daten.
**Vorgehen:** `snapshot_version`/Zeitstempel gegen lokalen Stand prüfen; bei
älter/abweichend expliziter Dialog mit beiden Ständen („Gerät: 12.08., Datei:
03.08."); Test-First inkl. `[REGRESSION]`; Dialog i18n-vollständig. Das
Replace-Verhalten selbst bleibt (dokumentierte Entscheidung), nur ungeschützt
ist es nicht mehr.
**Akzeptanz:** Import eines älteren Snapshots ohne Bestätigung unmöglich
(Test) · gleicher/neuerer Snapshot importiert wie bisher ohne Reibung.

### - [x] WP 1.5 · Backup: Prüfsumme + Item-Validierung beim Restore (RES-5) · S — `9f760db`
**Ziel:** Teilkorrupte Backups fallen beim Import auf, nicht Monate später.
**Vorgehen:** SHA-256 über den Payload beim Export mitschreiben; beim Restore
verifizieren; Items je Collection mit den Schemata aus WP 1.2 prüfen
(überspringen + melden). **Abwärtskompatibel:** Backups ohne Prüfsumme bleiben
importierbar, mit Hinweis. `isVersionCompatible` bleibt Major-basiert, wird
aber um einen Warnhinweis bei Minor-Differenz ergänzt.
**Akzeptanz:** Manipulierte Datei wird erkannt (`[INTEGRITY]`-Test) · alte
Backups importieren weiter (Test) · bestehende Roundtrip-Tests unverändert grün.

### - [x] WP 1.6 · Speicher-Laufzeitfehler behandeln (RES-6, RES-7) · S — `080b0ae`
**Ziel:** Quota-Erschöpfung und IndexedDB-Ausfälle haben definiertes,
nutzerverständliches Verhalten.
**Vorgehen:** In `idb-kv.ts` `QuotaExceededError` erkennen und
`ERROR_CODES.STORAGE_QUOTA_EXCEEDED` endlich verwenden (Meldung mit
Handlungsoption „Backup exportieren / Daten aufräumen", i18n); `openDb()`
verwirft das gecachte Promise bei Fehlschlag (Retry beim nächsten Zugriff);
Route-Level-ErrorBoundaries über das vorhandene `withErrorBoundary` um die
Hauptbereiche; Rückgabewert von `requestPersistentStorage()` auswerten — bei
Verweigerung dezenter Hinweis auf Backup.
**Akzeptanz:** Quota-Fehler zeigt die Meldung statt roher `DOMException`
(Test) · Render-Crash einer Fläche legt nicht mehr die ganze App lahm (Test).

### - [x] WP 1.2b · Die Integritätsmeldung erreicht die Fläche · S — `a13adf7`
**Herkunft:** Teilung von WP 1.2, begründet in [`nachpruefung.md`](nachpruefung.md) 1.c.
**Ziel:** Was `data-integrity-report.ts` zählt, sieht auch der Nutzer.
**Vorgehen:** `src/services/data-integrity-report.ts` hält je Collection die
Zahl der beim Lesen übersprungenen Items; die Texte (`dataIntegrity.*`) liegen
i18n-vollständig bereit. Es fehlt die Fläche: ein Hinweis im Stil von
`FinanceErrorState` — **kein** Fehlerzustand (die Daten sind ja da), sondern
eine Warnung mit Handlungsoption („Backup prüfen"). Bilingualer Test, der die
Zahl und die Handlungsoption prüft, nicht nur die Existenz.
**Akzeptanz:** Ein übersprungenes Item ist auf der betroffenen Fläche sichtbar ·
kein Fund ⇒ kein Hinweis (kein Dauerbanner) · `check:i18n --all` und
`check:card-rule` grün.

### - [x] WP 1.7 · `forecastOverrides` schluckt den Korruptionsfehler weiter · S — `bba49ae`
**Herkunft:** kein Audit-Befund — bei WP 1.1 aufgefallen, begründet in
[`nachpruefung.md`](nachpruefung.md) 1.a.
**Ziel:** Auch die letzte Collection meldet Korruption, statt sie in Defaults
zu verwandeln. Phase 1 ist erst dann wirklich abgeschlossen.
**Vorgehen:** `getForecastOverrides()` (`src/services/forecast-overrides-service.ts`)
fängt heute **jeden** Fehler und liefert `cloneDefaults()` — ein
`VaultCorruptError` (WP 1.1) verschwindet darin spurlos. Der Rethrow allein
genügt nicht: `src/hooks/useForecastOverrides.ts` konsumiert per
`void promise.then(...)` **ohne `.catch`**, ein Wurf wäre also eine unhandled
Rejection. Also zuerst die Fläche auf das Query-Error-Muster umbauen
(`FinanceErrorState` wie in `EuerPage.tsx`), dann den Fehler durchreichen.
Unterscheide dabei „Key existiert nicht" (Defaults sind richtig) von
„Envelope kaputt" (Fehlerzustand) — genau die Unterscheidung, die WP 1.1
überhaupt erst möglich gemacht hat.
**Akzeptanz:** `[REGRESSION]`-Test (korrupter Envelope ⇒ Fehler statt
Defaults) · `[ZUSTAND …:fehler]`-Test der betroffenen Fläche ·
`pnpm check:state-coverage` und `pnpm check:query-errors` grün ohne neuen
Allowlist-Eintrag.

---

## Phase 2 — Geld-Korrektheit & Wächterlöcher (P0, klein)

### - [x] WP 2.1 · Drei Mutations-Löcher schließen (TEST-1/2/3) · H — `c4bed98`
**Ziel:** Die exakten Grenzwerte der Geldlogik sind getestet — eine
`<`↔`<=`-Mutation wird rot.
**Vorgehen:** Testfälle: `basis === bufferCents` in `forecast.test.ts`
(gewünschtes Verhalten im Test dokumentieren: exakt auf dem Puffer ist
**nicht** „unter dem Puffer"), `spent === limit` in `budget-logic.test.ts`
(= „warn", nicht „over"), `parseGermanNumber("-1.200")` → −1200 und
`parseGermanNumber("-1.234,56")` → −1234,56 in `money.test.ts`.
**Akzeptanz:** Alle vier Fälle grün; im PR je Fall der Nachweis, welche
Mutation jetzt gefangen würde.

### - [x] WP 2.2 · Regelverstöße beheben + Wächter `check:money-parsing` (GOV-1) · S — `51accd2`
**Ziel:** Die zwei real verletzten Verbote sind behoben und maschinell bewacht.
**Vorgehen:**
1. `AskYourMoney.tsx:52` auf `parseGermanNumber` umstellen ([REGRESSION]-Test
   mit „1.200"); `BankCallbackPage.tsx:119` und `letter-ocr-service.ts:151,155`
   auf zod-Validierung statt `as unknown as` (Schemata für die
   GoCardless-/OCR-Antworten).
2. Neuer Wächter nach dem Muster von `check-decimal-inputs.mjs`: findet
   Roh-`parseFloat`/`Number.parseFloat` mit `replace(',', '.')` sowie
   `as unknown as` unter `src/` (außer Tests). Allowlist nach
   Zahl/Objekt-Konvention, Start: leer. Pre-Commit + CI + Zeile in der
   AGENTS.md-§2-Tabelle.
**Akzeptanz:** Wächter schlägt auf die (vor dem Fix) bestehenden Fundstellen
an (im PR belegen) · danach 0 Fundstellen · beide Fixes mit Tests.

### - [x] WP 2.3 · Layer-Wächter: `hooks`- und Slice-Presentation-Regel (ARCH-3/4) · S — `3e00d3f`
**Ziel:** Die in AGENTS.md §3 benannte Kette ist vollständig bewacht, bevor
weitere Slices migriert werden.
**Vorgehen:** In `scripts/layers-core.mjs` zwei Regeln ergänzen:
`hooks-ohne-components` (Ausnahme: Context-Provider-Reads laut
„Wohin ein Typ gehört"-Tabelle) und
`feature-presentation-ohne-legacy-components` (Slice-Presentation importiert
nicht aus `src/components/`/`src/pages/`). Bestand: `KPI_DEFINITIONS` aus
`components/kpi/kpis.ts` nach `src/lib/` verschieben (klein, sofort); die zwei
`TransactionCharts`-Importe der Dashboard-Slice kommen mit `reason` +
Verweis auf WP 6.2 in `layer-allowlist.json` — die Regel ist damit sofort
scharf für Neues, und WP 6.2 leert die Liste wieder.
**Akzeptanz:** `pnpm check:layers` grün · Allowlist enthält genau die zwei
begründeten Einträge · Tests der verschobenen `KPI_DEFINITIONS` laufen.

### - [x] WP 2.4 · `api/` und `mcp-poc/` in den Typecheck (GOV-2) · H — `eafe761`
**Ziel:** Der Token-Endpunkt kompiliert nachweislich; die Doku-Aussage stimmt.
**Vorgehen:** Eigenes `api/tsconfig.json`; CI-Schritt `tsc --noEmit` für
beide; Fehler, die dabei auftauchen, beheben (gehören zum Paket).
**Akzeptanz:** CI-Schritt läuft und ist grün · `coding-guide.md:36` stimmt
wieder wörtlich.

### - [x] WP 2.5 · Invariante 5 einlösen (DOM-4) · S — `9bf65fd`
**Ziel:** Die zentrale Schreibgrenze validiert cent-genau — Invariante 5 wird
von Prosa zu geprüfter Wahrheit.
**Vorgehen:** `saveTransactions` prüft jeden Betrag per
`toMinor`-Roundtrip (Betrag × 100 muss nach Rundung verlustfrei zurückführen);
Abweichung ⇒ Validierungsfehler, nie stilles Runden. `[REGRESSION]`-Test mit
einem Betrag wie `0.005`. `docs/domain-invariants.md` präzisieren:
Persistenzformat Euro-Float, Validierung cent-genau (siehe „Vorentschiedenes").
**Akzeptanz:** Test grün · Invariante-5-Text und Code sagen dasselbe.

---

## Phase 3 — Sicherheitstiefe (P1)

### - [x] WP 3.1 · PBKDF2 ≥ 600 000 Iterationen + kdf-Versionierung (SEC-1) · S — `dd07c67`
**Ziel:** OWASP-konforme Schlüsselableitung, ohne Altvaults auszusperren.
**Vorgehen:** Neue Vaults mit ≥ 600 000 Iterationen (SHA-256); `kdf`-Feld im
Envelope versionieren; beim erfolgreichen Unlock eines Alt-Vaults automatisch
auf die neuen Parameter umschlüsseln (Rewrap). `[SECURITY]`-Tests: Alt-Vault
öffnet, ist danach auf neuem Stand; falsches Passwort verhält sich unverändert.
**Akzeptanz:** Beide Tests grün · `pnpm test:security` grün · Iterationszahl
an genau einer Stelle definiert.

### - [x] WP 3.2 · Auto-Lock (SEC-2) · S — `14c4600`
**Ziel:** Ein unbeaufsichtigtes, entsperrtes Gerät bleibt nicht unbegrenzt
lesbar — das eigene Threat Model wird eingelöst.
**Vorgehen:** Inaktivitäts-Timer (Default 10 min, in den
Verschlüsselungs-Einstellungen wählbar inkl. „nie"), löst
`localEncryption.lock()` aus; zusätzlich Lock bei `visibilitychange` →
`hidden` optional (Default aus, sonst nervt es beim Tab-Wechsel). Alle Texte
i18n; Tests für Timer-Reset bei Aktivität und für den Lock-Durchgriff.
**Akzeptanz:** `[SECURITY]`-Test: nach Ablauf ist `_key` weg und die UI im
Sperrzustand · Einstellung persistiert · `[ZUSTAND]`-Abdeckung der
Einstellungsfläche unverändert.

### - [x] WP 3.3 · Passwort-Mindeststärke als Gate (SEC-3) · S — `db1260e`
**Ziel:** `1234` verschlüsselt keine Finanzdaten mehr ohne bewusste Entscheidung.
**Vorgehen:** Unter der „schwach"-Schwelle von `estimatePasswordStrength`
blockiert der Setup-Button; Override nur über explizite zusätzliche
Bestätigung („Ich verstehe das Risiko"). Texte i18n (auch everyday-Overlays —
Zielgruppe!); bilinguale Tests.
**Akzeptanz:** Test: schwaches Passwort ohne Override unmöglich, mit Override
möglich · bestehende Setup-Tests angepasst statt gelöscht.

### - [x] WP 3.4 · RLS-Wächter prüft Restriktivität (SEC-4) · H — `c084fa4`
**Ziel:** Eine versehentlich permissive Policy (`USING (true)`) fällt im Test.
**Vorgehen:** `supabase-rls.security.test.ts` erweitern: je Policy muss
`USING`/`WITH CHECK` ein `auth.uid() = user_id`-Muster enthalten (Regex über
die Migrationsdateien); Negativ-Fixture als Testfall. pgTAP-/Zwei-Nutzer-Test
gegen echte Instanz nur als dokumentierter Folgepunkt, nicht Teil des Pakets.
**Akzeptanz:** Eingeschleuste `USING (true)`-Policy macht den Test rot
(im PR demonstrieren, dann entfernen).

### - [x] WP 3.5 · MCP-Klartext in der UI kennzeichnen (SEC-5) · H — `77319fc`
**Ziel:** Die Opt-in-Fläche selbst sagt, was `docs/mcp-poc.md` sagt.
**Vorgehen:** Hinweis am Cloud-MCP-Opt-in: Aggregate liegen bei Supabase
unverschlüsselt (RLS-geschützt), Umfang benennen. i18n-vollständig, bilingual
getestet. Keine clientseitige Verschlüsselung (siehe „Vorentschiedenes").
**Akzeptanz:** Hinweis sichtbar vor Aktivierung · Test prüft die Aussage, nicht
nur Existenz.

---

## Phase 4 — Speicher & Query-Effizienz (P1)

### - [x] WP 4.1a · ADR Chunk-Ablage + Baseline-Messung (PERF-1) · O — `edd7e6e`
**Ergebnis:** `docs/architecture/transaction-storage-chunks.md`.
Der Entwurf wurde durch einen Befund bestimmt, den das Audit nicht nennt:
`getTransactions()` hat **53 Aufrufstellen**, und die meisten lesen mit Limit
10 000, also alles — sogar `getTransactionsPaginated()` holt intern den
Gesamtbestand. Chunking allein hätte die Kosten deshalb nur verlagert
(billigeres Schreiben, teureres kaltes Vollesen). Die ADR entscheidet
deshalb **Chunks + Index + Chunk-Cache** als Einheit und bindet den Cache an
den Entsperrzustand (sonst überlebte ein entschlüsselter Bestand den
Auto-Lock aus WP 3.2).
**Und sie korrigiert die Vorentscheidung „Monats-Chunks" auf Quartale** — die
Messung zeigt, dass der Monat das eigene Abnahmekriterium reißt (kaltes
Vollesen 1,76× bei drei Jahren, 2,84× bei neun) und gegenüber dem Quartal beim
Schreiben kaum etwas gewinnt. Zahlen in der ADR. Die Begründung der
Vorentscheidung („nicht je Eintrag") bleibt unberührt.

### - [x] WP 4.1b · Chunk-Speicherschicht + Index (PERF-1) · S — `877bf71`
**Abhängigkeit:** 4.1a. **Berührt noch keinen Bestand.**
**Ziel:** Lesen/Schreiben je Quartals-Chunk, Index-Pflege und Chunk-Cache als
eigenständige, vollständig getestete Schicht — hinter der Fassade, aber noch
nicht scharf geschaltet.
**Akzeptanz:** Roundtrip je Chunk · Index wird aus den Chunks abgeleitet, nie
fortgeschrieben · fehlender Chunk trotz Index-Eintrag **wirft** (RES-1-Regel),
wird nicht zur Leerliste · Cache verwirft beim `lock()` genau den Bestand ·
eine Einzeländerung verwirft **ein** Quartal, nicht die ganze Karte.

### - [x] WP 4.1c · Migration, Umschaltung und die drei Messungen (PERF-1) · S — `6858756`
**Abhängigkeit:** 4.1b, WP 1.3 (Läufer).
**Ziel:** v3-Blob → v4-Chunks als nummerierter Migrationsschritt, Fassade
schaltet um, Aufrufer bleiben unberührt.
**Akzeptanz:** Alle bestehenden Transaktions-, Backup-, Sync-Roundtrip-Tests
unverändert grün · Migrations-Roundtrip **und** Crash-Test (Abbruch vor dem
Index lässt den v3-Blob als Wahrheit stehen) · **alle drei** Messungen aus dem
ADR-Abschnitt „Wonach das hier zu beurteilen ist" im PR, nicht nur die
schmeichelhafte · **das Vollesen bestimmt die Chunk-Menge über `idbKeys()`,
nicht über den Index** (ADR-Abschnitt „Der Index bestimmt die Zählung, nicht
die Menge"), mit Test: ein Chunk ohne Index-Eintrag darf beim Vollesen **nicht**
fehlen.

### - [x] WP 4.2 · Query-Key-Invalidierungen verifizieren und präzisieren (PERF-2) · S — `08b77bb`
**Ziel:** `['transactions']` wird nur invalidiert, wenn Buchungen sich ändern
können.
**Vorgehen:** Je Fundstelle (Liste in PERF-2) **erst verifizieren**: eine
Bargeldabhebung legt vermutlich eine Buchung an — dort ist die
Root-Invalidierung korrekt und bleibt. Nur echte Fehlinvalidierungen (reine
Konto-/Sync-Metadaten) auf präzise Keys umstellen. Im PR je Stelle eine Zeile
Begründung („bleibt, weil …" / „präzisiert, weil …").
**Akzeptanz:** Keine Fläche zeigt veraltete Daten (bestehende Tests grün) ·
Begründungsliste vollständig.

### - [x] WP 4.3 · `invalidateQueries()` ohne Key eliminieren (PERF-5) · H — `f80e317`
Drei Fundstellen (PERF-5) auf gezielte Keys; kurzer Test je Stelle, dass die
betroffene Fläche weiterhin frisch lädt.

### - [x] WP 4.4 · Chart-Daten memoisieren (PERF-4) · H — `dfe2c94`
Drei Fundstellen mit `useMemo` an die Quell-Arrays binden; keine
Verhaltensänderung, bestehende Tests genügen als Netz.

### - [x] WP 4.5 · i18n-Bundle je Locale splitten (PERF-3) · O/S — `71f3cdf`
**Ziel:** Der Startpfad lädt eine Sprache, nicht vier.
**Vorgehen:** `translations.ts` je Locale in ein eigenes Modul; aktive Sprache
(+ `de`-Fallback) dynamisch importieren, `tlh` nur bei Aktivierung.
**Risiko-Checkliste, vorher lesen:** `locale-parity.test.ts` und
`overlay-coverage.test.ts` lesen die Quelle — sie müssen auf die neue Struktur
umgezogen werden, ohne ihre Prüfkraft zu verlieren; `check:i18n` und
`check:i18n-module-consts` dürfen nicht erblinden; Sprachwechsel zur Laufzeit
(Suspense/Nachladen) bleibt möglich. Danach `bundle-size-budget.json` neu
vermessen (Budget darf sinken, nie steigen).
**Akzeptanz:** Eigener Chunk je Locale im Budget sichtbar · Startbündel
messbar kleiner (Zahl im PR) · Paritäts- und Overlay-Tests weiter scharf
(Mutationsprobe im PR: fehlender Key macht rot).

---

## Phase 5 — Typen & Entdopplung (P2)

### - [x] WP 5.1 · Branded Types für Geld (DOM-1) · S — `cc9783e`
**Ziel:** Cent-Euro-Verwechslung ist ein Compile-Fehler.
**Vorgehen:** `type Cents = number & { readonly __brand: 'Cents' }` (und
`EuroAmount`) in `money.ts`; `toMinor`/`toMajor` als einzige Konstruktoren;
Felder schrittweise umstellen (`amount_minor` zuerst, dann die
Euro-Felder), Ad-hoc-Arithmetik in `girocode-service.ts:60-61` auf `money.ts`.
Reine Typ-Arbeit, keine Laufzeitänderung — `tsc` ist der Test; je Teilschritt
kompilierender Stand.
**Akzeptanz:** Demonstrations-Testdatei: `sumMinor([euroWert])` kompiliert
nicht (per `@ts-expect-error` im Test festgehalten) · 0 Laufzeit-Diffs.

### - [x] WP 5.2 · `types.ts` entlang der Domänen aufteilen (DOM-3) · S — `3cca9d5`
**Abhängigkeit:** WP 5.1. Aufteilen nach der „Wohin ein Typ gehört"-Tabelle
(AGENTS.md §3): persistierte Formen nach `src/lib/` bzw.
`features/<slice>/domain/`; `TransactionId`/`AccountId`/`CategoryId` als
Branded Types. Re-Exports aus `types.ts` übergangsweise erlaubt, mit
Abbaudatum im Kommentar.
**Akzeptanz:** `check:layers` grün · kein Import zeigt mehr auf die alte
Sammeldatei außer über die Übergangs-Re-Exports.

### - [x] WP 5.2b · Branded IDs auf die realen Felder anwenden (DOM-3, Rest) · S — `42f4617`
**Abhängigkeit:** WP 5.2 (`src/lib/ids.ts` existiert, ist aber auf kein Feld
angewendet).
**Warum getrennt:** Gemessen in WP 5.2 — `Transaction.id` allein ergibt **447
Fehler in 84 Dateien**, mit `Account.id`/`Category.id` zusammen **812 in 129**.
Der Großteil sind rohe `id: 'tx1'`-Literale in Tests, die auf Konstruktoren
umgestellt werden müssen.
**Ziel:** Die Brands greifen an den realen Feldern, nicht nur im Vorrat.
Solange sie ungenutzt sind, sind sie die Fehlerklasse aus `nachpruefung.md` 3.b
(„der Mechanismus war da, nur fragte ihn niemand").
**Vorgehen:** Feld für Feld, je Feld ein kompilierender Stand. Testliterale über
die Konstruktoren (`asTransactionId`) — das macht die Konstruktion typrichtig
und schwächt keine Zusicherung. **`tsc --noEmit` muss nach jedem Teilschritt
null Fehler haben.**
**Akzeptanz:** mindestens `Transaction.id` vollständig gebrandet · kein
`as unknown as` · Demonstrationstest aus WP 5.2 weiterhin grün.

### - [x] WP 5.3 · `TypedSelect<T>` + Query-Error-Helfer (KOMP-5) · S — `b43c2c9`
Wrapper um `<Select>` mit typisiertem `onValueChange`; Helfer für den
`useQuery`-Fehlertyp. Die Hotspots (`BudgetFormDialog`, `DebtFormDialog`,
`TradingDashboard`) umstellen; die 21 `exhaustive-deps`-Disables dabei je
Fundstelle prüfen: beheben oder mit Ein-Satz-Begründung stehen lassen.
**Akzeptanz:** Cast-Zahl der drei Hotspots im PR vorher/nachher · keine neuen
Disables.

### - [x] WP 5.4 · `TransactionFilters` aufs ViewModel reduzieren (KOMP-2) · S — `3ba8c0b`
Props auf `{ filters: FilterViewModel; showSearch?; stacked? }`; beide
Aufrufer reichen das Objekt durch. `[REGRESSION]`-Test: Dashboard-Vorschau und
`/transactions` filtern identisch.

### - [x] WP 5.5 · Tagesgruppierung konsolidieren (KOMP-3) · H — `b1dd8e6`
`TransactionListMobile` auf `buildDayGroups`/`formatDayHeading` umstellen;
bilingualer Test für den Tageskopf inkl. „Heute/Gestern". Sichtbare
Vereinheitlichung — im PR einen Screenshot-Vergleich oder Test-Assertion der
neuen Köpfe.

### - [ ] WP 5.6 · `currencyFormatter`-Kopien → `useMoneyFormat` (KOMP-4) · H
18 Fundstellen (grep `new Intl.NumberFormat('de-DE'`) auf `money.format(…)`;
Achtung: dadurch greift die Sanfter-Modus-Maskierung überall — das ist gewollt
und wird je umgestellter Fläche einmal getestet.

### - [ ] WP 5.7 · Toter Code entscheiden (KOMP-6) · H
Fünf Symbole (Liste in KOMP-6): entfernen oder — falls bewusst vorgehalten —
mit Verweis auf ein GitHub-Issue kennzeichnen. Für `BulkActions` erst die
Absicht klären (Rest einer Migration?); `withErrorBoundary` wird durch WP 1.6
wieder lebendig — vorher nicht löschen.

---

### - [x] WP 5.5b · Wochentag und Datum folgen der App-Sprache · S — `998e5fe`
**Befund aus WP 5.5:** `formatDayHeading` formatiert das
Wochentagskürzel mit fest verdrahtetem `{ locale: de }`. Seit WP 5.5 liest ein
englischer Nutzer deshalb **„Today · Mi 3.7."** — englischer Kopf, deutscher
Wochentag. Bestand (Desktop hatte es schon), aber jetzt auch auf Mobil sichtbar.
**Umfang:** rund **vierzehn** weitere Dateien verdrahten `date-fns` genauso fest
— gezählt in WP 5.5, vor dem Umbau neu verifizieren.
**Vorgehen:** Eine Stelle, die das `date-fns`-Locale aus der App-Sprache
ableitet (`de`/`en`/`ru`), statt es je Aufrufstelle zu importieren. Bilinguale
Tests für mindestens den Tageskopf.
**Akzeptanz:** kein `{ locale: de }` mehr in einer Datei, die nutzersichtbaren
Text formatiert · bilingualer Test zeigt „Wed" statt „Mi" · `check:i18n`
unverändert grün.

## Phase 6 — Architektur-Konvergenz (P2, fortlaufend)

**Abhängigkeit für alle Pakete: WP 2.3** (sonst migriert man in die alten
Wächterlöcher hinein). Kochrezept: `docs/architecture/feature-structure.md`.

### - [x] WP 6.1 · Verwaiste Slices entscheiden (ARCH-2) · O — `a08f940`
Je Ordner (`contract-records`, `household-settlement`,
`replacement-planning`): anschließen (erster echter Konsument) **oder** im
Slice-README als „vorbereitet, ungenutzt seit <Datum>" kennzeichnen **oder**
löschen (Git vergisst nichts). Keine stille dritte Option.

### - [x] WP 6.2 · `TransactionCharts` in die Dashboard-Slice (ARCH-3) · S — `f3af49c`
Migration nach `features/dashboard/presentation/`; hebt die zwei
Allowlist-Einträge aus WP 2.3 wieder auf. **Akzeptanz:**
`layer-allowlist.json` ist wieder leer.

### - [x] WP 6.3 · `TradingDashboard` → `features/trading/presentation` (ARCH-5, KOMP-1) · S — `302b134`
Aufspaltung entlang der Tabs (Portfolio/News/Discover); vervollständigt die
Trading-Slice-Kette. ViewModel (`use-etoro-account`) bleibt unverändert — das
ist der Beweis, dass die Trennung trägt.

### - [x] WP 6.3b · `ProviderSelector`: gespeicherten Favoriten wirklich lesen · S — `3b90058`
**Befund aus WP 6.3 (Bestandsfehler, nicht durch den Umzug entstanden):**
`favoriteProvider` startet fest auf `'yahoo'` und liest den gespeicherten Wert
nie, obwohl `useTradingPortfolio` ihn kennt — der Stern steht nach jedem Reload
am falschen Anbieter. `[REGRESSION]`-Test Pflicht.

### - [x] WP 6.7 · `components/common/` → `features/shared/presentation/` · H — `fdf233e`
**Befund aus WP 6.3:** Die Baustein-Spalte der Slice-Ratsche (`maxBausteine`,
Stand 36) erreicht erst mit diesem Umzug die 0. Neun Bausteine, **~110
betroffene Dateien** (in WP 6.3 gemessen — vorher neu zählen). EIN Umzug für
die ganze App; danach ist `components/common/` leer und die Frage „Alt-
Oberfläche oder gemeinsamer Baustein?" beantwortet sich über den Pfad.
**Akzeptanz:** `maxBausteine` auf 0 · `check:layers` grün · keine Zusicherung
in umziehenden Tests geändert.

### - [x] WP 6.4 · `CityPage` entkernen (ARCH-5, KOMP-1) · S — `067cf8b`
Interaktions-/Kamera-Logik nach `features/finance-city/application`;
`createCityScene` in benannte Teilschritte (Layout, Aufbau, Interaktion,
Rendering); Page wird Orchestrierung. Zielgröße: Page < 300 Zeilen, keine
Funktion > 100.

### - [x] WP 6.5 · Slice-Migration, nächste Kandidaten (ARCH-1) · S — `95c6ce3` (Settings) + `f7dcb7c` (Accounts)
Je Route ein PR, Reihenfolge nach view-data-Hotspots: `AccountManager`
(7 Queries), `EnhancedSettings` (7), dann absteigend. Jeder PR senkt
`view-data-budget.json` messbar (Ratsche nachziehen — sie darf nur sinken).

### - [ ] WP 6.8 · `check:i18n`-Blindstellen schließen · S
**Befunde aus WP 6.5a/b, je gegen HEAD nachgewiesen:** Der Wächter sieht drei
Formen sichtbaren UI-Texts nicht: **Props-Objekte** (`{ label: "Aufbewahrung" }`),
**Einzelwort mit Doppelpunkt** (`<strong>Hinweis:</strong>`) und
**Template-Literal ohne führendes Leerzeichen** (`` `Verbindungsfehler: ${e.message}` ``).
Dieselbe Familie wie die WP-12.2-Blindstellen (Template-Literal, JSX-Text).
Die konkreten Fundstellen sind behoben bzw. unverändert übernommen; hier geht
es um den **Wächter** (`i18n-core.mjs`), inklusive Mutationsprobe je Form und
Neuvermessung der Allowlist.

### - [ ] WP 6.6 · Gott-Module lib-seitig teilen (ARCH-6) · S (kür)
Migrationsfunktionen aus `local-settings-service.ts` nach
`src/lib/category-migrations.ts` (reine Funktionen); Sankey-/Sunburst-Aufbau
aus `analysis-data.ts` in `lib/chart-data/`-Module; `sumIncome`/`sumExpenses`
bleiben schmaler Kern. Tests wandern mit.

---

## Phase 7 — Test- & Meta-Härtung (P2/P3)

### - [ ] WP 7.1 · Error-State-Tests verschärfen (TEST-4) · H
Die schwachen `*.error-state.test.tsx` (Liste in TEST-4) auf das Muster der
starken heben: Fehlertext-Assertion **plus**
`queryByText(<irreführender Leerzustand>)).toBeNull()`.

### - [ ] WP 7.2 · Datei-Schwellen für die Geldlogik (TEST-5) · H
Per-Glob-Thresholds in `vitest.config.ts`: ≥ 90 % Branches für `money.ts`,
`forecast.ts`, `budget-logic.ts`, `analysis-data.ts`,
`transaction-allocation-service.ts`. Fehlende Abdeckung, die dabei auffällt,
gehört zum Paket.

### - [ ] WP 7.3 · E2E: Verschlüsselung + Backup-Roundtrip (TEST-6) · S
**Abhängigkeit:** WP 3.2 (Auto-Lock ändert den Flow). Zwei schlanke Specs:
„aktivieren → sperren → entsperren" und „Backup exportieren → reimportieren →
Daten identisch" — durch den echten Browser-Pfad (Dialog, Datei, Reload).

### - [ ] WP 7.4 · Versionierung einführen (GOV-3) · H
CalVer passend zur Datumskultur des Projekts: Tag `v2026.08.0`,
`CHANGELOG.md` (rückwirkend grob ab #287), `package.json`-Version,
`android/app/build.gradle` `versionCode`/`versionName` mitziehen; Absatz in
AGENTS.md §11 („jeder Merge-Meilenstein bekommt Tag + CHANGELOG-Eintrag").

### - [ ] WP 7.5 · ADRs für Grundentscheidungen nachtragen (GOV-4) · O
Datierte Kurz-ADRs in `docs/architecture/` nach dem Muster von
`entity-references.md`: EUR-only · IndexedDB-KV statt SQLite ·
Doppel-Schichtung (klassisch + Slices) · Wächter-System als
Durchsetzungsstrategie · Euro-Float-Persistenz (aus WP 2.5). Je ADR: Kontext,
Entscheidung, verworfene Alternative, Preis.

### - [ ] WP 7.6 · Buchhaltung & entschiedene Restpunkte (GOV-5, GOV-6, SEC-6, DOM-5) · H
`view-data-budget.json`: Kommentar, dass 282 selbst die offene Schuld ist
(Zahl/Objekt-Konvention verlinken) · `security-headers.md`: `style-src
'unsafe-inline'` als entschieden dokumentieren (Begründung Tailwind) ·
Pre-Commit-Bypass ebenda als entschieden dokumentieren (CI ist der Zaun) ·
optional (kür): `use-city-model` auf discriminated union.

---

## Was dieses Programm bewusst NICHT tut

- **Keine Integer-Cent-Persistenz-Migration** (siehe Vorentschiedenes).
- **Kein pgTAP-/Live-RLS-Test** — nur als Folgepunkt dokumentiert (WP 3.4).
- **Keine Multi-Currency-Vorbereitung** — EUR-only bleibt, bekommt aber eine
  ADR (WP 7.5).
- **Kein Umbau der AAA+-Artefakte** — das Programm läuft parallel und bleibt
  unberührt.

## Erfolgskriterium des Gesamtprogramms

Nach Abschluss aller Phasen gilt, prüfbar:
1. Kein Codepfad macht aus einem Lese-/Entschlüsselungsfehler einen
   Leerzustand (Phase 1).
2. Jede in `docs/` behauptete Regel hat entweder einen Wächter/Test oder
   steht als bewusste Entscheidung markiert (Phasen 2, 3, 7).
3. Eine Einzeländerung an einer Buchung kostet nicht mehr O(Gesamtbestand)
   (Phase 4).
4. Cent/Euro und fremde IDs sind Compile-Fehler, nicht Laufzeit-Glück
   (Phase 5).
5. `layer-allowlist.json` ist leer, die view-data-Ratsche messbar gesunken,
   kein `features/`-Ordner täuscht Vollständigkeit vor (Phase 6).
6. Ein benennbarer Versionsstand existiert (`v2026.xx`), und die
   Grundentscheidungen sind datiert nachlesbar (Phase 7).
