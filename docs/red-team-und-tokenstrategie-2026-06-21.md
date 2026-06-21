# Red-Team-Plan und tokensparende Arbeitsstrategie

Datum: 21.06.2026  
Bezug: `claude-anweisung-und-produkt-audit-2026-06-21.md`

## 1. Ziel

Das Red Team soll nicht nur klassische Sicherheitslücken suchen. Bei einer lokalen Finanzapp sind falsche Berechnungen, doppelte Buchungen, verlorene Nutzerentscheidungen und irreführende Darstellungen ebenso kritisch wie ein technischer Angriff.

Geprüft werden deshalb fünf Schutzgüter:

1. Vertraulichkeit lokaler Finanzdaten.
2. Integrität von Buchungen, Salden und Analysen.
3. Verlässlichkeit von Nutzerentscheidungen und Undo.
4. Wirksamkeit von Premium- und Benutzerberechtigungen.
5. Schutz vor Fehlbedienung und irreführender Mobile-UX.

## 2. Empfohlene Reihenfolge

### Phase 0 – Invarianten festschreiben

Vor offensiven Tests fachliche Regeln als ausführbare Tests definieren:

- Eine Bankbuchung beeinflusst den Kontostand genau einmal.
- Transaktionsaufteilungen ergeben exakt den Originalbetrag.
- Ein Import derselben Quelle ist idempotent.
- Eine ausdrücklich beendete Vertragsfamilie wird nicht durch historische Daten reaktiviert.
- Familienänderungen respektieren die abgewählte Sammelbearbeitung.
- Undo stellt den vollständigen vorherigen Zustand wieder her.
- Dashboard, Buchungsseite und Vertragsübersicht verwenden dieselbe Datenauflösung.
- Premium-Routen prüfen Berechtigungen unabhängig von der sichtbaren Navigation.

Ohne diese Phase findet ein Red Team zwar Symptome, kann aber nicht zuverlässig entscheiden, ob das Produkt fachlich korrekt reagiert.

### Phase 1 – Automatisierte Datenintegritätstests

Höchste Priorität, weil Fehler unbemerkt falsche Finanzwerte erzeugen können.

Testfälle:

- doppelter CSV-, Bank- und Backup-Import,
- gleiche Buchung mit geänderter Beschreibung,
- positive und negative Vorzeichen,
- Nullbetrag und sehr große Beträge,
- Rundung auf Centgrenzen,
- Split mit 0,01 € Rest,
- Split nach Familienänderung,
- Split anschließend löschen und Undo,
- Kontotransfer versus Einnahme/Ausgabe,
- laufender und vollständiger Monat,
- Jahreswechsel, Schaltjahr und Zeitzonengrenzen,
- historische Vertragsdaten nach expliziter Kündigung,
- erneuter Import nach einer manuellen Nutzerentscheidung.

### Phase 2 – Datenschutz und lokaler Tresor

Prüfen:

- Keine Finanzdaten in `localStorage`, Logs, Fehlermeldungen oder Analytics.
- IndexedDB- und Backupdaten sind ohne Schlüssel nicht im Klartext lesbar.
- Sperren entfernt entschlüsselte Daten aus React Query Cache und Arbeitsspeicher soweit praktikabel.
- Abmelden, Profilwechsel und Vault-Reset vermischen keine Benutzerdaten.
- Exporte enthalten nur explizit ausgewählte Daten.
- Temporäre Belegbilder und OCR-Zwischendaten werden kontrolliert entfernt.
- Netzwerkzugriffe senden keine Händler, Beträge, Kategorien oder Belegtexte ohne Einwilligung.
- Debugobjekte und Entwicklerhilfen exponieren keine entschlüsselten Stores.

### Phase 3 – Authentifizierung, Premium und Alphacode

Angriffsszenarien:

- Premiumroute direkt per URL öffnen.
- Feature-Komponente ohne Menü rendern.
- Tierwert in `localStorage` oder DevTools manipulieren.
- Offlinezustand während einer Berechtigungsprüfung.
- Alpha-Code mehrfach, mit Leerzeichen, Groß-/Kleinschreibung und sehr langen Eingaben senden.
- Brute-Force und fehlendes Rate Limit.
- Berechtigung eines Benutzers auf ein anderes Profil übertragen.
- abgelaufene oder entzogene Berechtigung aus lokalem Cache weiterverwenden.

Der Klartextcode `alphatester` ist ausdrücklich nur eine temporäre Testfreischaltung. Er darf nicht als Sicherheitsgrenze oder spätere Zahlungsberechtigung behandelt werden.

### Phase 4 – Unvertrauenswürdige Importe

CSV, PDF, OCR, Banktexte und Trackerverse-Dateien sind Angriffsflächen.

Testkorpus:

- extrem große Dateien,
- leere und beschädigte Dateien,
- falsche Kodierung,
- doppelte und fehlende Spalten,
- HTML und Scripttext in Händler- oder Kategorienamen,
- CSV-Formeln beginnend mit `=`, `+`, `-` oder `@`,
- Pfadbestandteile und ungewöhnliche Unicodezeichen,
- extrem lange Händler- und Produktnamen,
- ungültige Datums- und Zahlenformate,
- manipulierte Trackerverse-Schema-Version,
- doppelte externe IDs,
- Gesamtsumme ungleich Summe der Belegpositionen,
- OCR-Abbruch, Timeout und sehr große Bilder.

Erwartung: sicher ablehnen oder verständlich degradieren, niemals teilweise und unbemerkt falsche Daten übernehmen.

### Phase 5 – Mobile Misuse und adversariale UX

Ein UX-Red-Team versucht bewusst Fehlbedienung zu provozieren:

- schnelles mehrfaches Tippen auf Speichern,
- Zurück-Geste während des Speicherns,
- App-Wechsel mitten im Dialog,
- Bildschirmrotation,
- Tastatur verdeckt Betrag oder Hauptaktion,
- 320 px Breite und 200 % Schriftgröße,
- VoiceOver/TalkBack ohne sichtbare Texte,
- Swipe und vertikales Scrollen konkurrieren,
- destruktive Familienänderung wird versehentlich bestätigt,
- Filter scheinen aktiv, sind aber außerhalb des Viewports verborgen,
- Chart zeigt 0 statt „keine Daten“.

Wichtige Aktionen benötigen eindeutiges Feedback, Schutz vor Doppelausführung und bei breiten Änderungen eine Zusammenfassung wie „Diese Änderung betrifft 27 Buchungen“.

### Phase 6 – Abhängigkeiten und Build

- `pnpm audit` als Hinweisquelle, nicht blind als Qualitätsurteil.
- Lockfile und direkte Abhängigkeiten auf bekannte Schwachstellen prüfen.
- Große Parser und PDF-/OCR-Bibliotheken isoliert lazy-loaden.
- Build darf keine Secrets oder produktiven Debugflags enthalten.
- Source Maps und Umgebungsvariablen für Produktionsbuilds prüfen.
- Capacitor-Berechtigungen auf das notwendige Minimum begrenzen.

## 3. Separate Sicherheitstests

Sicherheitstests sollten erkennbar getrennt werden, aber dieselben öffentlichen Services verwenden wie die App.

Empfohlene Struktur:

```text
src/
  services/
    transaction-service.security.test.ts
    local-crypto.security.test.ts
    backup-service.security.test.ts
    receipt-parser-service.security.test.ts
  lib/
    tier.security.test.ts
    analysis-invariants.test.ts
tests/
  security-fixtures/
    csv/
    receipts/
    trackerverse/
  mobile/
  e2e/
```

Kennzeichne Tests zusätzlich mit konsistenten Namen wie `[SECURITY]`, `[INTEGRITY]` und `[PRIVACY]`. Dadurch können sie gezielt ausgeführt und ihre Resultate kompakt zusammengefasst werden.

Empfohlene Skripte:

```json
{
  "test:security": "vitest run --testNamePattern='\\[SECURITY\\]'",
  "test:integrity": "vitest run --testNamePattern='\\[INTEGRITY\\]'",
  "test:privacy": "vitest run --testNamePattern='\\[PRIVACY\\]'"
}
```

Vor dem Ergänzen der Skripte prüfen, ob die verwendete Vitest-Version den Parameter in dieser Form unterstützt. Alternativ getrennte Vitest-Projekte oder Dateinamensfilter verwenden.

## 4. Besonders geeignete Testmethoden

### Tabellengetriebene Tests

Für den ersten Schritt am geeignetsten: wenig neue Infrastruktur, leicht überprüfbar, geringer Tokenbedarf.

### Property-based Tests

Sehr geeignet für Geldbeträge, Splits, Datumsbereiche und Import-Idempotenz. Eine Bibliothek wie `fast-check` erst ergänzen, wenn die fachlichen Invarianten feststehen. Zunächst reichen deterministische Generatoren in Vitest.

Beispieleigenschaft:

> Für jede gültige Liste von Centbeträgen, deren Summe dem Buchungsbetrag entspricht, verändern Speichern, Laden und Undo weder Summe noch Vorzeichen.

### Mutation Testing

Später punktuell auf besonders kritische Berechnungen anwenden. Nicht sofort auf das gesamte Repository loslassen. Gute Kandidaten:

- Split-Summen,
- Import-Deduplizierung,
- Vertragsunterdrückung,
- Tier-/Feature-Prüfung.

### E2E-Tests

Nur für wenige wertvolle Nutzerketten einsetzen:

1. Buchung öffnen, ähnliche Buchungen bearbeiten, Undo.
2. Betrag aufteilen und Dashboardwerte prüfen.
3. historischen Vertrag ablehnen und erneut importieren.
4. Alphacode einlösen und Premiumvergleich öffnen.
5. mobile Grafiknavigation ohne horizontale Seite.

E2E nicht für jede Darstellungsvariante verwenden; Komponenten- und Integrationstests sind schneller und stabiler.

## 5. Tokensparender Claude-Workflow

### Ein Arbeitspaket pro Sitzung

Nicht „prüfe die ganze Sicherheit“ beauftragen. Ein Paket umfasst genau:

- ein Schutzgut,
- ein bis drei Services oder Komponenten,
- die dazugehörigen Tests,
- einen klaren Datenvertrag.

Beispielpaket:

> Prüfe ausschließlich Split-Integrität. Lade `types.ts`, den Transaktionsservice, den lokalen Store und die zugehörigen Tests. Prüfe Summe, Rundung, Undo und doppelte Kontowirkung. Keine UI- oder Premiumdateien laden.

### Fester Kontextkopf

Jeder Auftrag beginnt mit fünf kurzen Angaben:

```text
Ziel:
Invarianten:
Erlaubte Dateien:
Nicht im Scope:
Erwartetes Ergebnis:
```

Das verhindert, dass Claude vorsorglich das ganze Repository untersucht.

### Erst Befund, dann Umsetzung

Zwei kurze Durchläufe sind meist günstiger als ein großer unsicherer Prompt:

1. gezielter Befund mit maximal zehn Findings,
2. Umsetzung nur der bestätigten Findings.

Der Befund soll keine allgemeinen Erklärungen wiederholen, sondern Datei, Symbol, Risiko, Reproduktion und Testvorschlag liefern.

### Maschinenlesbares Finding-Format

```text
ID | Schweregrad | Datei:Symbol | Invariante | Reproduktion | Erwartung | Testname
```

So kann der nächste Auftrag nur die ausgewählten IDs erhalten, ohne den gesamten vorherigen Text erneut zu senden.

### Testausgaben zusammenfassen

- Keine vollständigen erfolgreichen Logs in den Kontext kopieren.
- Nur Exitcode, Anzahl Tests und fehlgeschlagene Testnamen übergeben.
- Bei Fehlern zuerst die relevante Assertion und höchstens etwa 30 umliegende Zeilen laden.
- Bundlelisten und Lintwarnungen nach Datei und Regel aggregieren.

### Repository-interne Wissensanker

Kurze Dateien sparen langfristig Tokens:

- `docs/domain-invariants.md`
- `docs/security-boundaries.md`
- `docs/test-fixtures.md`
- diese Red-Team-Datei

Claude soll diese kleinen Dokumente statt alter Chatverläufe laden. Sie müssen aktuell und knapp bleiben.

### Diffs statt vollständiger Dateien

Bei Folgeprüfungen nur laden:

- letzten relevanten Commit-Diff,
- veränderte Tests,
- direkt betroffene Schnittstellen.

Die vollständige Datei nur öffnen, wenn der Diff ohne Umgebung nicht verständlich ist.

## 6. Empfohlene Arbeitsaufteilung

### Paket RT-01: Finanzielle Invarianten – P0

Scope: Transaktionsservice, Store, Analyseaggregation.  
Ergebnis: Tests für doppelte Kontowirkung, Centgenauigkeit und Idempotenz.

### Paket RT-02: Verträge – P0

Scope: Vertragsentscheidung, Erkennung und Filter.  
Ergebnis: historische Ablehnung bleibt nach Reimport bestehen.

### Paket RT-03: Splitmodell – P0

Scope: Typen, Persistenz und Aggregation, zunächst ohne UI.  
Ergebnis: ausführbare Invarianten und Migrationstest.

### Paket RT-04: Vault und Datenschutz – P0

Scope: Crypto, Backup, Cache und Lock/Logout.  
Ergebnis: Negativtests für Klartextreste und falsche Schlüssel.

### Paket RT-05: Premium – P1

Scope: Tier, FeatureGate, Profil und Entitlement.  
Ergebnis: direkter Routenzugriff und Manipulation lokaler Werte bleiben wirkungslos.

### Paket RT-06: Importe und Parser – P1

Scope: CSV, Belegscan und Trackerverse-Schema.  
Ergebnis: adversarialer Fixture-Korpus und sichere Ablehnung.

### Paket RT-07: Mobile Misuse – P1

Scope: wichtigste Bottom Sheets, Swipe-Navigation und Familienänderung.  
Ergebnis: fünf bis acht stabile E2E-Flows plus Accessibility-Prüfung.

### Paket RT-08: Supply Chain – P2

Scope: Dependencies, Production-Bundle und Capacitor-Konfiguration.  
Ergebnis: priorisierte, verifizierte Risiken statt unbearbeiteter Auditliste.

## 7. Schweregrade

- **Critical:** Finanzdaten offengelegt, Datenverlust, falscher Gesamtsaldo oder Berechtigungsumgehung mit realem Wert.
- **High:** doppelte Buchung, dauerhaft falsche Analyse, verlorene Nutzerentscheidung, unsicherer Import.
- **Medium:** begrenzter Privacy Leak, irreführende UI, fehlende Bestätigung bei breiter Änderung.
- **Low:** Hardening, geringe Informationspreisgabe oder schwer erreichbarer Randfall ohne Datenwirkung.

Jedes Finding braucht Reproduktion und einen Regressionstest. Eine theoretische Möglichkeit ohne erreichbaren Pfad wird als Hardening-Hinweis, nicht automatisch als Sicherheitslücke geführt.

## 8. Minimaler Startplan

Der effizienteste Einstieg besteht aus drei Schritten:

1. `domain-invariants.md` mit höchstens 20 Regeln erstellen.
2. RT-01 bis RT-04 nacheinander als kleine Test-PRs durchführen.
3. Erst danach UI-Splits, Alphacode und Trackerverse-Austausch implementieren.

Damit werden die risikoreichsten Grundlagen abgesichert, bevor neue Features die Zahl möglicher Fehlerzustände vergrößern.
