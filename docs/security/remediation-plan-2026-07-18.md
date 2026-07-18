# Fintracker Remediation-Plan aus Pentest-Bericht 2026-07-18

Stand: 18.07.2026
Quelle: `docs/security/pentest-report-2026-07-18.md`
Arbeitsmodus: Findings werden sequenziell behoben; pro Finding zuerst Test,
dann minimaler Fix, dann Retest. Keine direkten Fixes außerhalb dieses Plans.

## 1. Priorisierung

| Reihenfolge | Finding | Severity | Paket | Zielzustand |
|---:|---|---:|---|---|
| 1 | FT-2026-003 BankCallback Auth-Link ohne Guard/noopener | High | D | Fixed — Externe Bank/Auth-Links validiert und opener-sicher. |
| 2 | FT-2026-005 Forecast-Overrides in localStorage | High | B | Fixed — Finanzielle Planungsdaten im verschlüsselbaren Store, Legacy migriert. |
| 3 | FT-2026-001 Vollständiger Testlauf nicht grün | Medium | G/A | Fixed — `pnpm test` läuft vollständig grün. |
| 4 | FT-2026-006 Snapshot-Import-Semantik | Medium | C/E | Fixed — Import validiert Schema, Replace-Semantik ist dokumentiert, Pfad-Metadaten werden nicht übernommen. |
| 5 | FT-2026-004 Vercel-CSP zu breit | Medium | A | Fixed — CSP ist auf konkrete Quellen reduziert und testgestützt. |
| 6 | FT-2026-007 BankCallback rohe Fehlerlogs | Medium | A/D/E | Fixed — Sync-Fehlerlogs sind aggregiert und payloadfrei. |
| 7 | FT-2026-002 Lint-Warnungen | Low | G | Fixed — `pnpm lint` meldet 0 Warnungen. |

## 2. Remediation-Tasks

### Task 1 — FT-2026-003 BankCallback Auth-Link absichern

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- `BankCallbackPage` öffnet Requisition-/Auth-Links nur nach
  `isSafeExternalAuthUrl`-Validierung.
- Neue Tabs verwenden `noopener,noreferrer`.
- Unsichere Links werden UI-seitig über i18n gemeldet und nicht geöffnet.

Vorgehen:

1. `[SECURITY]`-Regressionstest für sichere und unsichere `requisitionInfo.link`-
   Varianten schreiben.
2. `handleOpenAuthLink` auf sicheren zentralen Opener oder Safe-URL-Guard
   umstellen.
3. Debug-Link nur validiert anzeigen oder mit `rel="noopener noreferrer"` und
   klarer Fehleranzeige absichern.
4. Retest: `pnpm test:security`, gezielte BankCallback-Tests, `pnpm check:i18n`.

Definition of Done:

- [x] manipulierter Host wird blockiert
- [x] `window.open` enthält `noopener,noreferrer`
- [x] kein hardcodierter UI-Text

### Task 2 — FT-2026-005 Forecast-Overrides aus localStorage migrieren

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- Forecast-Overrides mit Beträgen/Planungsdaten liegen nicht mehr dauerhaft in
  `localStorage`.
- Legacy-Key `fintracker_forecast_overrides_v1` wird migriert und gelöscht.

Vorgehen:

1. `[PRIVACY]`-Test schreiben, der finanzielle Forecast-Overrides in
   `localStorage` verbietet.
2. Neuen LocalFinanceKey oder geeigneten verschlüsselbaren Store-Eintrag
   einführen.
3. `getForecastOverrides`/`saveForecastOverrides` async oder service-kompatibel
   migrieren; abhängige Hooks/Komponenten anpassen.
4. Legacy-Migration mit Roundtrip-Test ergänzen.
5. Retest: `pnpm test:privacy`, betroffene Forecast-Tests, `pnpm build`.

Definition of Done:

- [x] Legacy-localStorage wird nach erfolgreicher Migration gelöscht
- [x] aktivierte lokale Verschlüsselung schützt Overrides
- [x] keine regressiven UI-/Forecast-Brüche in gezielten Forecast-Service-/Forecast-Data-Tests

### Task 3 — FT-2026-001 vollständigen Testlauf stabilisieren

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- `pnpm test` läuft vollständig grün.

Vorgehen:

1. HealthScoreCard-Test isoliert mehrfach laufen lassen.
2. Animation/Tween-Test deterministisch machen: Fake Timer, reduced motion oder
   Hook-/Utility-Test statt realer Zeit.
3. Kein Produktverhalten verändern, außer falls echte Animation nie Zielwert
   erreicht.
4. Retest: gezielter Test, dann `pnpm test`.

Definition of Done:

- [x] `pnpm test` grün
- [x] Test ist mehrfach stabil

### Task 4 — FT-2026-006 Snapshot-Import absichern

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- Snapshot-Import ist entweder explizites Replace mit Bestätigung oder
  nachvollziehbarer Merge.
- Snapshot-Struktur und Metadaten sind validiert und minimiert.

Vorgehen:

1. `[INTEGRITY]`-/`[PRIVACY]`-Tests für Snapshot-Import schreiben.
2. zod-Schema für Snapshot-Datei und lokale Metadaten ergänzen.
3. Import-Zusammenfassung mit Anzahl ersetzter/übernommener Segmente liefern.
4. Path-Hints/Labels minimieren oder redigieren.
5. Retest: Snapshot-Tests, `pnpm test:privacy`, `pnpm test:integrity`.

Definition of Done:

- [x] kaputte Snapshot-Struktur wird sicher abgelehnt
- [x] Replace-Semantik ist im Service dokumentiert und testgestützt
- [x] importierte syncPaths/pathHints werden nicht lokal persistiert

### Task 5 — FT-2026-004 CSP minimieren

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- Vercel- und Netlify-CSP sind konsistent und exfiltrationsarm.

Vorgehen:

1. Header-Security-Test für `vercel.json`/`netlify.toml` erweitern.
2. Bedarf für `ws:`, `wss:`, `https://*.supabase.co`, `img-src https:` prüfen.
3. CSP auf konkrete Hosts reduzieren oder Risk Acceptance dokumentieren.
4. Retest: `pnpm test:security`, Build, manueller Staging-Header-Check.

Definition of Done:

- [x] keine unnötigen Wildcards
- [x] notwendige Hosts sind konkret begrenzt

### Task 6 — FT-2026-007 BankCallback-Logging redigieren

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- BankCallback loggt keine rohen Provider-/Transaktions-/Token-Payloads.

Vorgehen:

1. `[PRIVACY]`-Test für BankCallback-Fehlerpfade ergänzen.
2. `console.warn/error` durch redigierte Logger-Aufrufe oder aggregierte Codes
   ersetzen.
3. Retest: gezielte Tests, `pnpm test:privacy`, `pnpm test:security`.

Definition of Done:

- [x] keine IBANs/Tokens/Raw Errors in Logs
- [x] Fehler bleiben über aggregierte Codes/Zähler für Debugging nutzbar

### Task 7 — FT-2026-002 Lint-Warnungen beseitigen

Status: Fixed in Remediation-Durchlauf 2026-07-18.

Ziel:

- Lint ist warnungsfrei bzw. CI erzwingt Warnungsfreiheit.

Vorgehen:

1. Bestehende `any`-Warnungen typisieren.
2. Hook-Dependency in `ClaimImportDialog` prüfen und beheben.
3. Optional CI auf `pnpm lint -- --max-warnings=0` umstellen.
4. Retest: `pnpm lint`.

Definition of Done:

- [x] 0 ESLint-Warnungen
- [x] lokaler Retest dokumentiert warnungsfreien Stand

## 3. Arbeitsregeln für die Abarbeitung

- Immer nur ein Finding pro Commit, außer Tests/Doku gehören unmittelbar dazu.
- Jeder Fix beginnt mit einem reproduzierenden Test.
- Nach jedem Fix mindestens relevante Suite + `pnpm check:i18n` +
  `pnpm check:test-structure` + `pnpm security:secrets`.
- Nach Abschluss aller Findings vollständiger Retest: `pnpm lint`, `pnpm test`,
  Security-/Privacy-/Integrity-/Mobile-Suites, `pnpm audit`, `pnpm build`.
- Bericht und Plan werden nach jedem Statuswechsel aktualisiert.

## 4. Abschlussstatus 2026-07-18

Alle im Bericht `docs/security/pentest-report-2026-07-18.md` erfassten Findings
FT-2026-001 bis FT-2026-007 sind in diesem Plan auf `Fixed` gesetzt und mit
den zugehörigen Regression-/Security-/Privacy-/Integrity-Tests sowie dem
vollständigen Retest verifiziert. Der Nachbericht liegt in
`docs/security/pentest-after-report-2026-07-18.md`.
