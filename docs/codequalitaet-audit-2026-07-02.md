# Ganzheitlicher Code-, Sicherheits-, Datenschutz- und Finanzlogik-Audit

**Datum:** 2026-07-02
**Umfang:** gesamtes Repository (513 Quelldateien, 165 Testdateien / 1408 Tests, 9 Supabase-Migrationen, 4 Edge Functions, Vercel-/Netlify-Config, MCP-PoC, Android/Capacitor)
**Methode:** 15 parallele Prüf-Agenten (je eine Dimension), jedes Critical/High-Finding anschließend durch einen unabhängigen Agenten adversarial gegengeprüft (Auftrag: widerlegen). Verdikt-Kennzeichnung pro Finding: **CONFIRMED** (mit Datei:Zeile belegt), **ADJUSTED** (real, aber Kritikalität korrigiert), **PLAUSIBLE** (Verifizierer wegen Session-Limit ausgefallen — Fund am Code belegt, aber nicht zweitgeprüft), **UNVERIFIED** (Medium/Low, nicht gegengeprüft).
**Bezugsdokumente:** `docs/domain-invariants.md` (Invarianten 1–20), `docs/security-boundaries.md`, `docs/red-team-ergebnisse-2026-06-21.md`, `docs/FEATURES.md`.

> Hinweis zur Verifikation: Der Session-Token-Pool wurde während des Laufs zweimal erschöpft. 12 der 15 Gebiete wurden mit aktiver Zweitprüfung abgeschlossen (CONFIRMED/ADJUSTED-Verdikte), die Gebiete **Geldlogik**, **Supabase** und **MCP** liegen als am Code belegte, aber nicht zweitgeprüfte Erstanalyse vor (PLAUSIBLE). Der geplante Vollständigkeits-Kritiker wurde durch manuelle Quervernetzung ersetzt; die schwersten Befunde decken sich ohnehin über mehrere unabhängige Agenten (z. B. CSV-Export-Korruption, Backup-Restore-Duplizierung, Transfer-in-Summen).

---

## 1. Executive Summary

**Gesamtzustand:** Fintracker ist ein **überdurchschnittlich sorgfältig gebautes, aber an den Rändern gefährlich inkonsistentes** Local-first-Produkt. Der harte Kern ist stark: Integer-Cent-Geldarithmetik mit einem einzigen Rundungspunkt (`money.ts`), atomare Split-Invariante (`transaction-allocation-service.ts`), konservative Transfer-Erkennung, ein kryptografisch solides AES-GCM/PBKDF2-Fundament (`local-crypto.ts`), eine echte Storage-Abstraktion, zentrale Tier-/Feature-Gate-Logik und 1408 überwiegend scharfe Tests inkl. der Red-Team-Regressionssuiten. Die Probleme liegen fast durchweg **eine Ebene über dem Kern**: in duplizierten Pfaden, in UI-Flows, die den Kern umgehen, und in Doku/Privacy-Aussagen, die dem Code widersprechen.

**Einschätzung: eingeschränkt produktionsreif.** Für den aktuellen Alpha-/Anonym-Betrieb tragbar, aber **nicht** für einen breiteren Launch mit Bankanbindung, Zahlung und Multi-Device-Sync, bevor die Critical/High-Punkte behoben sind. Die Bankanbindung (GoCardless) und das Backup/Restore sind die riskantesten aktiven Pfade.

**Größte Risiken (Top 5):**
1. **Datenverlust beim Deaktivieren der lokalen Verschlüsselung** — die Migrationsliste kennt nur 7 von ~25 verschlüsselten Storage-Keys; Budgets, Splits, Forderungen, Kategorien u. v. m. bleiben als unlesbare Envelopes zurück und werden beim nächsten Schreiben überschrieben. (F-CRYPTO-1, Critical, CONFIRMED)
2. **Persistente Doppelbuchungen aus zwei Bank-Import-Pfaden** — `BankCallbackPage` baut den Initialimport ohne Dedupe/Transfer-Reconciliation/`last_sync_at` nach; Reload oder erster Sync verdoppeln die Historie. (F-ARCH-1, Critical, CONFIRMED)
3. **Backup-„Wiederherstellung" hängt an statt zu ersetzen** — die UI verspricht dreifach „überschreiben", der Code streift IDs und erzeugt Duplikate → verdoppelte Salden/Budgets. (F-BACKUP-1, Critical, PLAUSIBLE, von zwei Agenten unabhängig gemeldet)
4. **Privacy-Versprechen ≠ Codeverhalten** — die Privacy-Seite behauptet „Kategorien & Budgets verlassen dein Gerät nie", während aktiver MCP-Sync Kategorie-/Budgetnamen + Summen in die Cloud lädt; zusätzlich behauptet der Verschlüsselungs-Status Vollständigkeit, die die Migration nicht liefert. (F-PRIV-1/-2, High)
5. **Falsche Geldbeträge über gängige Nutzereingaben** — manuelle Eingabe „1.200" wird still als 1,20 € gespeichert (deutscher Tausenderpunkt); CSV-Export korrumpiert jeden negativen Betrag zu Text; PDF-Summen enthalten Transfers. (F-MONEY-1/-2/-3, High)

**Größte technische Schuld:** Doppelte Implementierungen desselben fachlichen Vorgangs (Bank-Import zweimal, Aggregations-/Summenlogik in mindestens vier Komponenten kopiert statt aus `lib/analysis-data.ts`, zwei MCP-Server, zwei Deployment-Configs, sechs Paare divergierender Testdateien). Jede Kopie driftet und bricht Invarianten unterschiedlich.

**Größtes Datenschutzrisiko:** Die Diskrepanz zwischen Privacy-Seite/Doku und tatsächlichen Datenflüssen (MCP-Aggregate mit Freitext-Namen, Bank-Umsätze durch die Edge Function, Kursabrufe, Finanzdaten in `localStorage` an Verschlüsselung **und** DSGVO-Wipe vorbei), plus die faktisch wirkungslose GoCardless-Consent-Widerrufung bei Kontolöschung.

**Größtes fachliches Finanzrisiko:** Mehrere unabhängige, gleichzeitig aktive Definitionen von „Einnahme/Ausgabe/Saldo" (Dashboard vs. Premium-Dashboard vs. PDF-Export vs. Sankey), kombiniert mit stillen 5000/10000-Transaktionslimits, die bei größeren Beständen ältere Buchungen aus Salden, Dedupe und Export fallen lassen — jeweils ohne Warnung.

---

## 2. Bewertungsmatrix (1–5)

| Dimension | Score | Begründung |
|---|---|---|
| **Architektur** | 3 | Saubere Schichtung (UI→Services→Storage), zentrale Tier-Logik, aber zwei duplizierte Geld-Pfade (Bank-Import, Aggregation) und zwei Deployment-Configs. |
| **Lesbarkeit** | 3,5 | Konsistenter, gut benannter TS-Kern; einzelne God-Components (`DebtsPage` 681, `LiquidityReport` 1009 Z.), Deutsch/Englisch-Mix in Bezeichnern. |
| **Wartbarkeit** | 3 | Gute Modulgrenzen, aber flache `services/`- (77) und `lib/`-Ordner (61), doppelte Testdateien, veraltete Root-Dokus als Agenten-Kontext. |
| **Testbarkeit** | 3,5 | Domänenlogik durchweg pure & getestet; **aber Suite auf `main` rot** und kein E2E/Coverage/RLS-Test. |
| **Sicherheit** | 3 | Solide Krypto, kein `service_role` im Client, saubere RLS im Repo — aber IDOR bei `get-balances`, umgehbares Rate-Limit, sehr weite CSP, plaintext eToro-Keys. |
| **Datenschutz** | 2,5 | Exzellente Substanz, aber mehrere Privacy-Aussagen widersprechen dem Code; Finanzdaten in `localStorage`; Bank-Consent-Widerruf wirkungslos. |
| **Finanzlogik** | 3 | Kern (Cents, Splits, Transfers) vorbildlich; Ränder (dt. Zahlenparsing, Transfer-in-Summen, gemischte Split-Vorzeichen, Währung) fehlerhaft. |
| **Supabase-Absicherung** | 3 | Repo-Tabellen sauber (RLS+WITH CHECK); die sensibelsten Tabellen (`accounts`, `bank_connections`) fehlen als Migration → nicht auditierbar. |
| **Validierung** | 3 | CSV-Import nach Red-Team hart; zentraler Speicherpfad lax (0/heute-Coercion), kein zod/zentrale Schemas, keine Zeichensatzerkennung. |
| **TypeScript-Qualität** | 4 | `strict` aktiv & praktisch nicht unterlaufen (0× `as any`, `tsc` grün); ESLint-Regelwerk minimal, `api/` außerhalb Typecheck. |
| **Deployment-Reife** | 2,5 | Zwei divergierende Configs, hartkodierte Supabase-URL (alle Envs teilen Prod), kein `vite build`/Coverage in CI, rote CI gemergt. |
| **Local-first-Konsistenz** | 3 | Starkes Fundament, aber `localStorage`-Lecks, gerätegebundene „Sync-Datei", ungenutztes (getestetes) Vault-Format als toter Code. |
| **Trackingverse-Erweiterbarkeit** | 3 | Kaum globale Singletons, zentrale Tier-Logik; braucht Router-Basename, Key-Namespacing, Domänen-Ordner, Modulgrenzen. |

---

## 3. Feature-gegen-Code-Abgleich

| Featurebereich | Erwartetes/dokumentiertes Verhalten | Tatsächliches Codeverhalten | Risiko | Empfehlung |
|---|---|---|---|---|
| **Privacy-Seite** | „Kategorien & Budgets verlassen dein Gerät nie" | Bei aktivem MCP-Sync verlassen Kategorie-/Budgetnamen + Monatssummen das Gerät; MCP wird auf der Seite nicht erwähnt | Hoch (Vertrauens-/Compliance-Bruch) | `derivePrivacyStatus` um MCP-/Bank-/Kurs-Flüsse erweitern |
| **Lokale Verschlüsselung** | „Deine Daten liegen AES-GCM-verschlüsselt" / „nur Envelopes in IndexedDB" | `enable()`/`disable()` migrieren nur 7 von ~25 Keys → Klartext bleibt bzw. geht verloren | **Critical** | Vollständige Key-Liste (`LOCAL_FINANCE_KEYS`) + Post-Assert |
| **Sync-Datei** | „ersetzt das Backup", Multi-Device, „neuester gewinnt pro ID" | Ausgeliefert wird `snapshot-sync-service` (gerätegebunden, destruktiv, kein Merge); das getestete `vault-format` mit Merge ist **toter Code** | Hoch (Datenverlust/kein Cross-Device) | Import auf `vault-format` + KDF-aus-Envelope umstellen |
| **Backup/Restore** | „vorhandene Daten werden überschrieben/ersetzt" | Restore streift IDs → **Anhängen** statt Ersetzen → Duplikate | **Critical** | Original-IDs behalten (Idempotenz) oder echtes Replace |
| **Datenexport (CSV)** | „enthält alle Transaktionen mit Kategorien" | Kategoriespalte leer (`tx.category` nie gesetzt), negative Beträge zu Text korrumpiert | Hoch | Kategoriename auflösen; Zahl-Zellen vom Escaping ausnehmen |
| **Datenexport (PDF)** | Summen = Dashboard | Summen enthalten Transfers, zeigen `category_id` statt Namen | Hoch | `excludeTransfers()` + gemeinsame Summenfunktion |
| **Cloud-MCP** | „nur Aggregate, keine Freitexte", „Token nur einmal angezeigt" | Kategorie-/Budgetnamen (Freitext) werden geladen; Klartext-Token dauerhaft in `localStorage` | Mittel–Hoch | Consent/Doku präzisieren oder Namen pseudonymisieren; Token nicht persistieren |
| **Supabase-Datengrenze** | „nur Metadaten" | Repo-Tabellen ok; `accounts`/`bank_connections` (Live-Salden, Requisition-IDs) fehlen als Migration → nicht belegbar | Hoch | DDL versionieren; RLS/CASCADE beweisen |
| **Trading (Beta)** | „in Einstellungen aktivieren → nutzbar" | Route liest Flag nicht-reaktiv → nach Aktivierung bis Reload Redirect auf `/coach` | Mittel | Reaktive Flag-Quelle im Route-Element |
| **Gesperrte Features (`/premium`, `/simulation`)** | gesperrt, laden keine Daten | Locked-State lädt nachweislich keine Daten (FeatureGate rendert Kinder nicht) — **korrekt** | — | Monte-Carlo-Band/Heatmap auf `/liquidity` sind für alle Tiers frei (klären) |
| **Route Guards** | Berechtigung an Route/Feature, nicht nur Menü (Inv. 14) | Zentrale `ROUTE_GUARDS`-Map, Locked-Preview statisch — **korrekt** | — | 3 FeatureKeys (`basicForecast` u. a.) sind definiert, aber an keinen Gate gebunden |
| **DSGVO-Löschung** | Konto + alle Daten + Bankzugriff weg | GoCardless-Requisition wird faktisch nie beendet (leere Cloud-Tabelle); `accounts` nur cascade-abhängig | Hoch | Requisition per Reference-Konvention beenden; `accounts` explizit löschen |
| **Anonym vs. Login** | sauber getrennt | Getrennt; Logout lockt Verschlüsselung, aber Provider-State bleibt stale (Desync) | Mittel | LocalEncryptionProvider bei Logout invalidieren |
| **Tresor-Sperre (Inv. 15)** | gesperrt → keine Finanzdaten | `LockedRedirect` entfernt alle Finanzrouten aus dem Baum + Store-Guard — **robust, kein Flash** | — | Vermuteter BankCallback-Bypass **widerlegt** |

---

## 4. Findings (priorisiert)

Kritikalität in Klammern; Verdikt = Ergebnis der adversarialen Gegenprüfung.

### Critical

| ID | Datei | Problem | Risiko | Empfehlung | Verdikt |
|---|---|---|---|---|---|
| **F-CRYPTO-1** | `services/local-crypto.ts:344` (`sensitiveKeys`) | Migrationsliste kennt nur 7 von ~25 verschlüsselten Keys; `disable()` entschlüsselt nur diese | Budgets, Splits (`transactionAllocations`!), Forderungen, Kategorien, Merchant-Regeln u. v. m. bleiben als unlesbare Envelopes → als leere Listen interpretiert → beim nächsten Schreiben **unwiederbringlich überschrieben** | Liste auf `Object.values(LOCAL_FINANCE_KEYS)` + Kategorien-/Settings-Key umstellen; Defensiv-Guard in `readLocalFinanceList` gegen Envelope-bei-deaktiviert | **CONFIRMED** |
| **F-ARCH-1** | `pages/BankCallbackPage.tsx:220` (`importTransactionsForAccount`) | Zweite, abgespeckte Import-Pipeline in der UI: kein Dedupe, kein `counterparty_iban`, keine Transfer-Reconciliation, kein `last_sync_at`, schwächerer Description-Fallback | Reload/erneutes Verknüpfen dupliziert 730 Tage; erster Sync re-importiert alles (Identifier ≠ gespeicherter Wert) → **falsche Salden** (Inv. 1/2/3) | Nach dem Verknüpfen `syncAccountTransactions()` aufrufen, UI-Schleife löschen; oder deterministische Import-IDs | **CONFIRMED** |
| **F-BACKUP-1** | `services/backup-service.ts:415` (`restore*`) | Restore streift alle IDs → `saveTransactions` vergibt neue UUIDs → Idempotenz-Guard unwirksam → **Anhängen** statt Ersetzen; UI verspricht dreifach „überschreiben" | Restore auf Gerät mit Bestandsdaten verdoppelt jede Buchung/jedes Konto; zweiter Restore vervierfacht → falsche Salden/Budgets/Analysen (Inv. 1/3). Auf neuem Gerät zeigen Buchungen auf verwaiste Kategorie-IDs | Original-IDs behalten (Idempotenz nutzen) **oder** echtes Replace mit Bestätigung; UI-Text angleichen | **PLAUSIBLE** (2 Agenten unabhängig) |

### High (Auswahl der schwersten; vollständige Liste im Anhang)

| ID | Datei | Problem | Empfehlung | Verdikt |
|---|---|---|---|---|
| **F-MONEY-1** | `components/transactions/TransactionFormDialog.tsx:102` + `transaction-service.ts:45` | Manuelle Eingabe „1.200" → 1,20 € (dt. Tausenderpunkt ignoriert; `parseFloat(x.replace(',','.'))`) | Robusten Parser aus `csv-service.ts:155` als `money.parseEuroInput` zentralisieren | PLAUSIBLE |
| **F-MONEY-2** | `services/transaction-storage-service.ts:195` (`sanitizeCell`) | CSV-Export: jeder negative Betrag wird zu `'-12,34` (Text); Formel-Injection über `Payee;=…` **umgehbar** (nur ganze Zelle geprüft, kein RFC-4180-Quoting) | Numerische Zellen ausnehmen; vollständiges Quoting; Präfix pro logischer Zelle | CONFIRMED (Injection-Bypass) / PLAUSIBLE (Zahl-Korruption) |
| **F-MONEY-3** | `components/DataExport.tsx:102` + `premium-dashboard/ResponsivePremiumDashboard.tsx:71` | PDF- **und** Premium-Dashboard-Summen enthalten interne Transfers (Inv. 2) → Basis- und Premium-Ansicht widersprechen sich | Gemeinsame `excludeTransfers`-basierte Summenfunktion | CONFIRMED (Premium-Dashboard) |
| **F-MONEY-4** | `services/transaction-service.ts:45` (`saveTransactions`) | Ungültiger Betrag → still 0, ungültiges Datum → still „heute" (nur CSV-Pfad ist streng); Bank-/Restore-/OCR-Pfad umgeht die Guard (Inv. 18) | Validierung an die fachliche Grenze ziehen: werfen statt normalisieren | CONFIRMED |
| **F-MONEY-5** | `services/transaction-allocation-service.ts:63` | Split-Validierung prüft nur signierte Summe; „Rest"-Button erzeugt gemischte Vorzeichen → 10-€-Ausgabe erscheint als 6+16=22 € in Analysen (Math.abs) | Gleiches Vorzeichen aller Anteile erzwingen; Panel-Eingaben als Absolutwerte | PLAUSIBLE |
| **F-CONTRACT-1** | `lib/contract-derivation.ts:194` | Abgelehnter Vertrag reaktiviert sich still, wenn zweite IBAN desselben Händlers auftaucht (Merge schlüsselt Fingerprint um, Entscheidung geht verloren) (Inv. 9) | Entscheidungen aller Quell-Fingerprints auflösen; Priorität rejected/ended > active | CONFIRMED |
| **F-DEBT-1** | `services/etoro-service.ts:161` | eToro API-/User-Keys im Klartext in IndexedDB **und in jedem Backup**; Dialog verspricht „verschlüsselt gespeichert" | Nur verschlüsselt speichern (oder verweigern solange Crypto aus) + aus Backup ausschließen; oder UI-Text korrigieren | CONFIRMED |
| **F-DEBT-2** | `services/portfolio-service.ts:151` | Marktwert summiert Fremdwährung (eToro immer USD) 1:1 als EUR ins Nettovermögen (~8 % Fehler bei EUR/USD) | Nicht-Basiswährung umrechnen oder ausschließen + kennzeichnen | ADJUSTED (real, High) |
| **F-PRIV-1** | `lib/privacy-status.ts:31` + `pages/PrivacyPage.tsx` | Privacy-Seite ignoriert aktiven MCP-Sync; behauptet „Kategorien & Budgets bleiben lokal", während Namen+Summen hochgeladen werden | MCP-Status in `derivePrivacyStatus` einbeziehen | PLAUSIBLE |
| **F-PRIV-2** | `providers/LocalEncryptionProvider.tsx:39` | `enable()` verschlüsselt nur 7 Keys sofort; Rest bleibt Klartext bis zum nächsten Read (Widerspruch zu security-boundaries.md Z.23) | Vollständige Key-Liste (wie F-CRYPTO-1) + `hasPlaintextFinanceStorage()`-Assert | CONFIRMED |
| **F-PRIV-3** | `services/forecast-overrides-service.ts:87` + Dismiss-Keys | Finanzdaten in `localStorage` an Verschlüsselung **und** DSGVO-Wipe vorbei (Forecast-Overrides mit Beträgen, Dismiss-Keys mit Klartext-Händlernamen+Beträgen) | Overrides in `local-finance-store`; Dismiss-Keys hashen; einheitliches App-Präfix per Lint-Guard | CONFIRMED |
| **F-PRIV-4** | `supabase/functions/delete-account/index.ts:134` | DSGVO-Löschung sucht Requisitionen in leerer Cloud-Tabelle → GoCardless-Bankzugriff wird **nie** widerrufen (bleibt bis Consent-Ablauf 90 Tage aktiv) | Requisitionen per `reference=${userId}:*` bei GoCardless beenden | CONFIRMED |
| **F-CRYPTO-2** | `services/local-crypto.ts:281` (`decryptEnvelope`) | Entschlüsselt immer mit In-Memory-Key, ignoriert Envelope-KDF → Cross-Device-Import („Sync-Datei") schlägt deterministisch fehl (neuer Salt pro Gerät) | KDF aus Envelope ableiten (wie `decryptJsonWithPassword`) | CONFIRMED |
| **F-SYNC-1** | `services/snapshot-sync-service.ts:170` | Import überschreibt destruktiv (kein Merge, kein Versionsvergleich, keine Bestätigung, kein Sicherungs-Snapshot); getestete Merge-Logik (`vault-format`) ungenutzt | Version/`created_at` prüfen, Sicherungs-Snapshot, mittelfristig `mergeVaultPayloads` | PLAUSIBLE |
| **F-SEC-1** | `vercel.json:30` (CSP) | `connect-src ws: wss:` (beliebige Hosts) + `img-src https:` + `*.supabase.co` → bei XSS volle Exfiltration lokaler Finanzdaten möglich | `ws:/wss:` entfernen, `*.supabase.co` auf Projekt-URL, `img-src` auf Hosts, jsdelivr selbst hosten | PLAUSIBLE |
| **F-SEC-2** | `supabase/functions/gocardless-sync/index.ts:593` (`get-balances`) | Keine Ownership-Prüfung (anders als Schwesteraktionen) → IDOR-Klasse auf fremde Kontostände (durch UUID-IDs praktisch erschwert) | `assertRequisitionBoundToUser` + `allowedAccounts.includes` erzwingen oder Aktion entfernen | PLAUSIBLE |
| **F-SEC-3** | `supabase/functions/refresh-balances/index.ts:158` | Rate-Limit-Zähler in `balance_refresh_limits` per RLS **vom Nutzer selbst zurücksetzbar** → wirkungslos | Zähler mit `service_role` schreiben, Nutzer nur SELECT; oder SECURITY-DEFINER-RPC | PLAUSIBLE |
| **F-SEC-4** | `supabase/migrations/` (fehlend) | `accounts`, `bank_connections` (Live-Salden, Requisition-IDs) haben **keine Migration** → RLS/FK/CASCADE nicht auditierbar | DDL versionieren; RLS + `auth.uid()=user_id` + WITH CHECK + CASCADE beweisen | PLAUSIBLE |
| **F-CI-1** | `components/budgets/__tests__/BudgetFormDialog.test.tsx:47` | **`main` ist rot** (4 Tests), da Commit `14e54da` Controls hinter FeatureGate legte; drei folgende Merges trotz roter CI | Tests mit Premium-Mock fixen; Branch-Protection mit Required-Check aktivieren | CONFIRMED |
| **F-PERF-1** | `services/local-crypto.ts:70` (b64encode) | Jede Einzeländerung ver-/entschlüsselt die **gesamte** Transaktionsliste; byteweises Base64 → Write 6,4 s @50k, 16,4 s @100k, Speicherspitzen >300 MB (Android-OOM) | Chunked Base64 / `Uint8Array.toBase64()`; mittelfristig Partitionierung pro Datensatz/Monat | PLAUSIBLE (benchmarkt) |
| **F-PERF-2** | `components/dashboard/TransactionTable.tsx:110` | Keine Virtualisierung (rendert bis 5000 Zeilen × ~40 DOM-Knoten); zwei Virtualisierungs-Libs installiert, **keine importiert**; Suche ohne Debounce | `@tanstack/react-virtual` einsetzen, `react-window` entfernen; Suche 300 ms debouncen | PLAUSIBLE |
| **F-PERF-3** | `hooks/useAutomationSuggestions.ts:26` | Query-Key-Kollision `['transactions']` mit Limits 1000 vs. 5000 → wer zuerst Coach öffnet, sieht 5 min lang Dashboard-Summen auf nur 1000 Buchungen → **falsche Geldbeträge** | Limit in Query-Key aufnehmen; gemeinsame `useTransactions()` | PLAUSIBLE |
| **F-DATA-1** | `services/transaction-service.ts:244` + `net-worth-service.ts:81` | Harte 5000/10000-Limits (Datum absteigend) lassen **älteste** Buchungen still aus Salden, Dedupe und Export fallen | Ungedeckelte Ladefunktion für Saldo/Export; sonst sichtbare „unvollständig"-Warnung | PLAUSIBLE |
| **F-UX-1** | `components/settings/EnhancedSettings.tsx:168` (`handleUndo`) | Undo nach Massen-Neukategorisierung ist eine **Attrappe** (nur Toast); `recategorizeTransactions` überschreibt manuelle Kategorien und lässt `subcategory_id` stale → Analysen zeigen Änderung nicht (Inv. 10/12) | Echtes Undo (Snapshot) oder Button entfernen; `subcategory_id` konsistent setzen | PLAUSIBLE |
| **F-UX-2** | `pages/TransactionsPage.tsx:194` | Ein-Klick-Löschung ohne Bestätigung/Undo (Dashboard hat Dialog); keine Audit-Log-Erfassung | `DeleteConfirmationDialog` auch hier; Löschung als reversibler Audit-Eintrag | PLAUSIBLE |
| **F-UX-3** | `services/coach-service.ts:66` | Roadmap-Stufe/„Notgroschen" aus All-time-Summen als Monatswerte + Cashflow statt `netWorth.cash` → systematisch falsche Stufe, widerspricht Health-Score derselben Seite | Monatswerte ableiten, Puffer aus `cash/Monatsausgaben`; als pure Funktion extrahieren+testen | PLAUSIBLE |
| **F-MCP-1** | `services/cloud-mcp-sync-service.ts:230` | `cashflow.month = months[0]` = **ältester** Monat (lastNMonths sortiert aufsteigend) → KI zeigt aktuellen Cashflow unter 5 Monate altem Label (live reproduziert) | `currentMonthKey(now)` verwenden; maskierenden Test korrigieren | PLAUSIBLE |

---

## 5. Kritische Sofortmaßnahmen (vor breiterem Launch / Ausbau)

1. **CI grün machen + Branch-Protection** (F-CI-1) — ohne durchgesetztes Gate maskiert jede rote Pipeline neue Regressionen. *Erste Maßnahme, blockiert alles andere.*
2. **Verschlüsselungs-Migration vervollständigen** (F-CRYPTO-1, F-PRIV-2) — akuter Datenverlust-Pfad. Vollständige Key-Liste + Regressionstest über Enable→Disable-Roundtrip aller Kollektionen.
3. **Backup-Restore-Semantik korrigieren** (F-BACKUP-1) — Duplizierung von Salden. Idempotenz-Roundtrip-Test.
4. **Bank-Import vereinheitlichen** (F-ARCH-1, plus Dedupe-Identifier `gocardless-sync-service.ts:278`) — Doppelbuchungen.
5. **Geldbetrags-Parsing zentralisieren** (F-MONEY-1/-4) — Faktor-1000-Fehler bei „1.200"; strikte Validierung an `saveTransactions`.
6. **CSV-Export reparieren** (F-MONEY-2) — RFC-4180-Quoting + numerische Zellen ausnehmen; Injection-Bypass schließen.
7. **PDF/Premium-Summen auf gemeinsame transferbereinigte Funktion** (F-MONEY-3).
8. **DSGVO: GoCardless-Consent-Widerruf + `accounts`-Löschung** (F-PRIV-4, F-SEC-4-Nachbar).
9. **Privacy-Seite gegen reale Flüsse abgleichen** (F-PRIV-1/-3, F-MCP-Namen) — Compliance.
10. **Supabase: `get-balances` absichern, Rate-Limit fixen, fehlende DDL versionieren** (F-SEC-2/-3/-4).
11. **CSP härten** (F-SEC-1).

---

## 6. Refactoring-Plan

### Phase 1 — Stabilisieren (Security, Validierung, kritische Finanzlogik)
- CI grün + Branch-Protection; `vite build` und Coverage in CI; Red-Team-Gates gegen Leerlauf absichern (`--passWithNoTests=false`-Äquivalent).
- F-CRYPTO-1/-2, F-BACKUP-1, F-ARCH-1, F-MONEY-1..5, F-CONTRACT-1.
- F-SEC-1..4, F-PRIV-4; `accounts`/`bank_connections` als Migration.
- Regressionstests für jeden dieser Punkte (siehe Testplan).

### Phase 2 — Strukturieren
- **Eine** Aggregations-Bibliothek (`income/expense/saldo/income_correction`) in `lib/analysis-data.ts`; alle Konsumenten (Dashboard, Premium-Dashboard, PDF, Sankey, Coach) darauf.
- **Ein** Bank-Import-Pfad (Callback → `syncAccountTransactions`).
- **Ein** Sync-Format (`vault-format` statt `snapshot-sync-service`) mit Merge.
- Zentrale zod-Schemas an allen Storage-/Datei-Grenzen (IndexedDB, Backup, Vault, Import); blindes `JSON.parse as T` ersetzen.
- Validierung an die fachliche Grenze (`saveTransactions`) statt nur im CSV-Pfad.
- `localStorage`-Namespacing erzwingen; Finanzdaten in den verschlüsselbaren Store.
- Doppelte Testdateien (`services/*.test.ts` vs. `__tests__/`) und zweiten MCP-Server bereinigen.

### Phase 3 — Standardisieren
- Coding Guide (Abschnitt 8) ins Repo; ESLint auf `recommended` + `@typescript-eslint/recommended` + `no-floating-promises`; Prettier; `--max-warnings 0`.
- `api/` und `mcp-poc/` in Typecheck aufnehmen (eigene tsconfig-Referenz).
- Root-Dokus (TECHNICAL_IMPROVEMENTS/PERFORMANCE_OPTIMIZATIONS/README/AI_RULES) gegen Code korrigieren oder entfernen — sie sind laut CLAUDE.md Agenten-Kontext und daher aktiv schädlich.
- Architekturübersicht + Datenschutzmodell dokumentieren; **eine** Deployment-Plattform festlegen.

### Phase 4 — Skalieren (Trackingverse)
- Store-Partitionierung (pro Datensatz/Monat) + chunked Base64 → 10k–100k Buchungen tragfähig.
- Virtualisierung real einsetzen.
- Modulgrenzen: Domänen-Ordner (`transactions/`, `debts/`, `budgets/`, …), Shared-Package-Kandidaten, Router-Basename, Key-Namespacing pro Modul.
- E2E (Playwright) + serverseitige RLS-/IDOR-Tests.

---

## 7. Testplan (konkret)

**Geld & Parsing**
- `parseEuroInput('1.200') === 1200`, `('1.234,56') === 1234.56`, `('12,34') === 12.34`, Buchstaben/leer → wirft.
- `toMinor`/`sumMinor`: 0.1+0.2, Vorzeichen, 3-Wege-Split 1,00 € = 0,34/0,33/0,33.
- `saveTransactions` wirft bei unparsebarem Datum/Betrag (statt heute/0).
- Extrembeträge (Number.MAX_SAFE_INTEGER-Nähe) → Obergrenze/Ablehnung.

**Transfers & Splits**
- `[INTEGRITY]` Transfer-Paar (+100/−100, `is_transfer`) → Einnahmen/Ausgaben unverändert in Dashboard, PDF, Premium-Dashboard, Sankey (alle identisch).
- `[INTEGRITY]` gemischt-signierte Aufteilung wird abgelehnt.

**Validierung / Injection**
- CSV-Export: negativer Betrag ohne `'`-Präfix; `Payee='Shop;=HYPERLINK(...)'` → gequotet, Formel neutralisiert; Tab-präfigierte Formel neutralisiert.
- XSS-Korpus (`<script>`, `"><img onerror>`) in Payee/Description → in UI escaped, in PDF kein Sink.
- ISO-8859-1-CSV mit Umlauten → korrekt oder klar abgewiesen.
- Kaputtes JSON-Backup, fremdes Backup, `__proto__`-Key → sicher abgewiesen.

**Budgets / Liquidität / Verträge**
- Rückwirkende Kategorieänderung propagiert; gelöschte Kategorie hinterlässt kein Zombie-Budget.
- `[REGRESSION]` abgelehnter Vertrag bleibt abgelehnt nach zweiter IBAN.
- Monatswechsel, Wochenend-Gehalt, überfällige Abbuchung, mehrere Einnahmequellen.

**Backup/Restore/Sync/Crypto**
- Restore-Idempotenz (Roundtrip → gleiche Anzahl), Restore über Bestand verdoppelt nicht.
- Enable→Disable-Roundtrip: **alle** Kollektionen lesbar, kein Envelope-Rest.
- Cross-Device: verschlüsseln Gerät A → Import Gerät B (andere Salt) → erfolgreich.
- Falsche Passphrase, beschädigte Envelope, Lock/Unlock.

**Supabase / Security (serverseitig)**
- `[SECURITY]` Nutzer B ruft `get-balances` mit A's `account_id` → 403.
- `[SECURITY]` RLS verhindert Reset von `balance_refresh_limits`.
- `information_schema`-getrieben: jede `user_id`-Tabelle hat RLS + Policies + WITH CHECK.
- Nach `delete-account` keine Zeile der uid in irgendeiner Tabelle; Requisition beendet.

**Gates / MCP**
- Direkt-URL `/premium` ohne Tier, `/trading` ohne Flag → kein Datenladen.
- Trading-Flag aktivieren → Route sofort erreichbar (ohne Reload).
- MCP `get_budget_status` enthält `generated_at`; `cashflow.month` = aktueller Monat; Kategorie-/Budgetnamen im Snapshot dokumentiert.

---

## 8. Coding-Guide-Vorschlag (Auszug — Vollfassung als eigenes Dokument empfohlen)

**Grundprinzipien:** Local-first ist Default; jede Server-/Cloud-Interaktion ist explizit, nutzerinitiiert und auf der Privacy-Seite deklariert. Der Code ist die Quelle der Wahrheit für jedes Privacy-Versprechen.

- **Ordnerstruktur:** nach Domäne (`transactions/`, `debts/`, `budgets/`, `net-worth/`, `imports/`, `exports/`, `privacy/`, `encryption/`, `backup/`, `sync/`, `mcp/`, `auth/`, `settings/`), je mit `logic`(pure)/`service`(I/O)/`ui`. Keine Domänentypen in `components/`.
- **Naming:** Bezeichner und UI-Texte konsistent (Projektentscheidung: UI Deutsch, Code Englisch). Tests immer in `__tests__/`.
- **TypeScript:** `strict` bleibt; kein `as any`, kein `as unknown as` an Datengrenzen — dort zod. Zentrale Domänentypen in `src/types.ts` (Transaction, Account, Category, Budget, Debt, Claim, Contract, Backup, Vault, EncryptionState, FeatureFlag, Tier).
- **Money:** ausschließlich Integer-Cent über `money.ts`; nie roher Float, nie `toFixed` für Berechnung. Ein Parser (`parseEuroInput`) für alle Eingaben.
- **Domain-Logik:** pure, UI-frei, deterministisch (Zeit/Zufall injizieren). Aggregation nur zentral; die 20 Invarianten sind Testpflicht.
- **Validierung:** zentrale zod-Schemas an **jeder** Storage-/Datei-/Netzgrenze; ungültige Werte werfen, nicht coercen.
- **Supabase:** Client nur anon-Key; `service_role` nie im Frontend; jede `user_id`-Tabelle hat RLS + `auth.uid()=user_id` + WITH CHECK; DDL immer als Migration.
- **Local-first/Datenschutz:** Finanzdaten nur im verschlüsselbaren Store, nie in `localStorage`; `localStorage` nur mit App-Präfix, nur Nicht-Finanz-Config; jede neue Cloud-Ausnahme erweitert `derivePrivacyStatus`.
- **Logging:** kein `console.log` mit Finanzinhalten/Symbolen/Quotes in Produktion.
- **Feature-Flags:** zentral, typisiert, Default aus, reaktiv gelesen; Gate an Route **und** Feature.
- **Kommentare:** nur WARUM (Fachregel/Sicherheit/Datenschritt), nicht WAS.
- **Trackingverse:** kein globaler Singleton-State; Router-Basename-fähig; Storage-Keys pro Modul namespacen.

---

## 9. Konkrete nächste Pull Requests

1. **fix(ci): BudgetFormDialog-Tests + Branch-Protection** (F-CI-1) — zuerst.
2. **fix(crypto): vollständige Key-Migration bei enable/disable + Roundtrip-Test** (F-CRYPTO-1, F-PRIV-2).
3. **fix(backup): Restore idempotent / echtes Replace + UI-Text** (F-BACKUP-1).
4. **refactor(import): Bank-Callback nutzt syncAccountTransactions** (F-ARCH-1) + Dedupe-Identifier-Fix.
5. **feat(money): parseEuroInput zentralisieren + strikte saveTransactions-Validierung** (F-MONEY-1/-4).
6. **fix(export): RFC-4180-CSV-Quoting, numerische Zellen, Kategorienamen** (F-MONEY-2).
7. **refactor(analysis): eine transferbereinigte Summenfunktion für alle Views** (F-MONEY-3).
8. **fix(privacy): derivePrivacyStatus um MCP/Bank/Kurs + localStorage-Finanzdaten migrieren** (F-PRIV-1/-3).
9. **fix(dsgvo): GoCardless-Consent-Widerruf + accounts-Löschung in delete-account** (F-PRIV-4).
10. **fix(supabase): get-balances-Ownership, Rate-Limit serverseitig, fehlende DDL** (F-SEC-2/-3/-4).
11. **chore(security): CSP härten** (F-SEC-1).
12. **fix(finrisk): gemischt-signierte Splits ablehnen** (F-MONEY-5); **fix(contracts): Entscheidung überlebt IBAN-Merge** (F-CONTRACT-1).
13. **fix(perf): chunked Base64 + Virtualisierung + Query-Key-Limit** (F-PERF-1/-2/-3).
14. **fix(ux): echtes Undo / Löschbestätigung / Coach-Monatswerte** (F-UX-1/-2/-3).
15. **docs: Root-Dokus gegen Code korrigieren; Architektur + Datenschutzmodell** (Phase 3).

---

## 10. Akzeptanzkriterien für das Issue „Codequalität" — Status

| Kriterium | Status |
|---|---|
| Coding Guide existiert | ⚠️ Entwurf hier (Abschnitt 8); als eigenes Dokument auszubauen |
| Architektur dokumentiert | ❌ offen (Root-Dokus teils falsch) |
| Featurebereiche gegen Code abgeglichen | ✅ (Abschnitt 3) |
| Privacy-Aussagen gegen Datenflüsse geprüft | ✅ geprüft — **Abweichungen gefunden** (F-PRIV-1/-3, F-MCP) |
| Lokale Verschlüsselung geprüft & getestet | ✅ geprüft — **Critical gefunden** (F-CRYPTO-1) |
| Export/Backup/Sync sicherheitlich geprüft | ✅ geprüft — **mehrere High/Critical** |
| Cloud-MCP dokumentiert & abgesichert | ⚠️ abgesichert, aber Doku/Privacy-Abweichungen |
| Supabase RLS aktiv & getestet | ⚠️ Repo-Tabellen ok; `accounts`/`bank_connections` nicht auditierbar; keine RLS-Tests |
| Keine service_role Secrets im Client | ✅ verifiziert |
| TypeScript strict / Migrationsplan | ✅ strict aktiv |
| ESLint/Prettier/Typecheck/Tests in CI | ⚠️ läuft, aber **CI rot**, kein Prettier/Coverage/Build |
| Finanzlogik aus UI extrahiert | ⚠️ Kern ja; Aggregation in Komponenten dupliziert |
| Geldberechnungen rounding-safe | ✅ Kern; ⚠️ Parsing-Ränder |
| Kritische Eingaben validiert | ⚠️ CSV ja, generischer Pfad nein |
| CSV/XSS/SQL/Zahl-Injection getestet | ⚠️ teilweise (kein XSS-Korpus, kein RLS-Test) |
| Unit-Tests zentrale Finanzlogik | ✅ |
| Integrationstests Datenzugriffe | ⚠️ IndexedDB ja; kein Import-Flow-/Restore-Roundtrip |
| E2E-Tests Kernflüsse | ❌ keine |
| Route Guards / Feature Gates getestet | ✅ (Gating-Matrix), ⚠️ 3 ungebundene Keys |
| Kritische Security-Findings behoben | ❌ offen |
| Kritische Datenschutz-Findings behoben | ❌ offen |
| Folgeissues/PRs für Refactorings | ✅ (Abschnitt 9) |
| Trackingverse-Modulgrenzen beschrieben | ⚠️ Grobskizze (Abschnitt 6/8) |

**Fazit:** Das Issue „Codequalität" kann **noch nicht geschlossen** werden. Die Analyse-Anforderungen sind erfüllt; die Behebungs- und Test-Kriterien (Verschlüsselung, Backup, Bank-Import, Privacy, Supabase, CI, E2E) sind offen und in Abschnitt 5/9 als PRs terminiert.

---

## Anhang: Offene Fragen (Risiko bei Nichtklärung)

- **Deployment-Plattform (Vercel oder Netlify)?** Beide Configs gepflegt; auf Netlify sind MCP-Endpoint und OCR/pdfjs (CSP + `/api`-Redirect) **defekt**. Blockiert die Bewertung mehrerer Findings.
- **Branch-Protection auf `main` aktiv?** Drei letzte Pushes hatten CI-Status `failure` und wurden gemergt.
- **Preview-Deployments gegen Prod-Supabase?** URL/anon-Key sind hartkodiert → technisch zwingend; Risiko für Prod-Daten.
- **EU-Datenstandort** (Supabase-Region, Vercel-Function-Region) nirgends dokumentiert — Pflicht für deutsche Finanz-App.
- **`accounts`/`bank_connections`: RLS + `ON DELETE CASCADE` im Dashboard gesetzt?** Ohne DDL nicht belegbar; betrifft Nutzertrennung **und** DSGVO-Löschung.
- **EUR-only bewusst?** Nirgends dokumentiert oder erzwungen; GoCardless-Fremdwährung würde still falsch verrechnet.
- **5000/10000-Transaktionslimits: Produktgrenze oder Altlast?** Bei Bankanbindung schnell erreicht; aktuell stille Fehlberechnung.
- **Läuft `mcp-poc/` (Service-Role-Key) noch produktiv** oder ist `api/mcp/[token].ts` (anon) kanonisch?
