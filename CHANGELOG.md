# Changelog

Alle nennenswerten Änderungen an Fintracker, neueste zuerst.

**Versionsschema: CalVer `JJJJ.M.n`** — Jahr, Monat, laufende Nummer innerhalb
des Monats. Das passt zur Datumskultur des Projekts (Dokumente, Audits und ADRs
tragen hier Datum, keine Release-Nummer) und beantwortet die Frage, die bei
einer local-first App wirklich gestellt wird: *von wann ist mein Stand?*

> **Warum `2026.8.0` und nicht `2026.08.0`?** Die führende Null ist nach
> SemVer §9 unzulässig (`semver.valid('2026.08.0')` → `null`), und npm parst sie
> nur nachsichtig: `npm publish` normalisiert `2026.08.0` still zu `2026.8.0`.
> Zwei Schreibweisen für einen Stand sind genau die Mehrdeutigkeit, die eine
> Versionsnummer beseitigen soll — deshalb gilt **eine** Form überall:
> `package.json`, `versionName`, Git-Tag (`v2026.8.0`) und dieser Datei.
> `docs/qualitaet-2026-08/plan.md` (WP 7.4) nennt noch die Form `v2026.08.0`;
> der Plan ist Protokoll, diese Abweichung ist bewusst.

Gliederung je Block: **Neu** (was Nutzer sehen und tun können) · **Behoben**
(was falsch war) · **Intern** (Architektur, Tests, Wächter, Abhängigkeiten).
Der Ablauf für einen neuen Stand steht in `AGENTS.md` §11.

## [Unreleased]

> Wird beim Merge dieses Zweigs zu **`v2026.8.0`** — dem ersten benannten Stand
> des Projekts überhaupt. Inhalt ist das Qualitätsprogramm 10/10
> (`docs/qualitaet-2026-08/`), ~40 Arbeitspakete aus einem Vollaudit vom
> 2026-08-08.

### Neu

- **Auto-Lock der lokalen Verschlüsselung**: Der Schlüssel fällt nach Inaktivität
  aus dem Speicher, statt bis zum Schließen des Tabs zu leben.
- **Passwort-Mindeststärke** beim Einrichten der lokalen Verschlüsselung — als
  Gate, nicht als Hinweis.
- **Sync-Import fragt nach**, wenn der eingespielte Stand älter ist als der auf
  dem Gerät, statt still zu überschreiben.
- **Backup mit Prüfsumme**: Ein beschädigtes oder unvollständiges Backup wird
  beim Einspielen erkannt und je Datensatz geprüft.
- **Unlesbare Datensätze werden benannt** („n Einträge unlesbar, Backup
  prüfen") statt still verworfen.
- **Fremdwährung wird sichtbar als *nicht verrechnet* ausgewiesen** — eine
  USD-Position fließt nicht mehr 1:1 in Portfolio-Summe und Nettovermögen.
- **MCP-Zugriff kennzeichnet Klartext-Daten** in der Oberfläche.

### Behoben

- **Ein beschädigter verschlüsselter Datenblock wurde als „keine Daten" gelesen
  und beim nächsten Schreiben überschrieben.** Er wirft jetzt einen Fehler; die
  Fläche zeigt ihn als Fehlerzustand. Derselbe Fehlerpfad war auch bei den
  Prognose-Übersteuerungen offen.
- **Flächen behaupteten nach einem Lesefehler „du hast noch nichts erfasst"** —
  Schulden, Vermögen, Stadt und weitere. Fehlerzustand schlägt jetzt überall den
  Leerzustand, und die Tests prüfen die Abwesenheit dieser Lüge.
- **Getippte Geldbeträge im deutschen Format wurden verstümmelt**: „1.200"
  wurde zu 1,2 (roher `parseFloat` mit Komma-Ersetzung).
- **Der erste Start war kaputt** (zwei Regressionen: Laufzeit-Lückenprüfung und
  ein Rennen zwischen Migration und Landing-Screen).
- **Wochentage und Datumsangaben folgten der Systemsprache statt der
  App-Sprache**; an weiteren 46 Stellen stand Text hardcodiert im Quelltext,
  darunter halb übersetzte Zeilen.
- **Der gespeicherte Anbieter-Favorit wurde nicht gelesen.**
- **Dialoge behaupteten „account management"**, wo etwas anderes gemeint war.

### Intern

- **Datenintegrität:** zod-Validierung an der Kern-Lesegrenze (IndexedDB,
  Backup, Import); echter Migrationsläufer statt Best-Effort;
  Speicher-Laufzeitfehler (Quota, blockierte Transaktion) werden behandelt.
- **Sicherheit:** PBKDF2 auf ≥ 600 000 Iterationen mit versioniertem KDF-Feld;
  Wächter prüft RLS-Policies auf Restriktivität.
- **Performance:** Buchungen liegen in Quartals-Chunks mit Index statt in einem
  Block; Query-Invalidierungen zielgenau statt pauschal; Chart-Daten memoisiert;
  i18n lädt eine Sprache statt vier.
- **Typen:** Cent und Euro sind für den Compiler nicht mehr dasselbe; IDs sind
  gebrandet; `types.ts` ist entlang der Domänen aufgeteilt.
- **Architektur:** Feature-Slices für Trading, Einstellungen, Konten,
  Dashboard und Finanzstadt; `src/components/common/` ist nach
  `src/features/shared/presentation/` umgezogen; die beiden Gott-Module sind
  geteilt.
- **Wächter:** neu `check:money-parsing`, geschärft `check:i18n` (vier zuvor
  unsichtbare Formen), Ratschen für Ansicht/Daten und Slice-Presentation;
  `api/` und `mcp-poc/` laufen jetzt im Typecheck.
- **Dokumentation:** fünf datierte ADRs für die Grundentscheidungen (EUR-only,
  IndexedDB-KV, Doppel-Schichtung, Wächter-System, Euro-Float-Persistenz);
  Versionierung und dieser Changelog (WP 7.4).

## Vorgeschichte — vor der Versionierung

Bis einschließlich 2026-08-08 gab es **keine Tags und keine Versionsnummern**
(Befund GOV-3: `package.json` stand auf `0.0.0`, `versionCode` auf `1`, bei
279 Commits). Diese Stände lassen sich deshalb nur über PR-Nummer und Datum
benennen — rückwirkend vergebene Nummern wären erfunden. Grob ab PR #287:

### 2026-08-08 — PR #290

- **Intern:** Vollaudit des Repos und der daraus abgeleitete Arbeitsplan
  (`docs/qualitaet-2026-08/`). Nur Dokumentation, kein Code.

### 2026-08-08 — PR #288

- **Intern:** Drei Wächter mit Bestandsaufnahme — Dezimaleingaben
  (`check:decimal-inputs`), i18n über den ganzen Baum (`check:i18n --all`) und
  die Trennung von Ansicht und Daten (`check:view-data`, Ratsche bei 282).

### 2026-08-08 — PR #287

- **Intern:** Konsolidierung der Schichtrichtung (`check:layers`),
  Aufräumen der Dokumentation und Aufteilung der vier größten Dateien.
