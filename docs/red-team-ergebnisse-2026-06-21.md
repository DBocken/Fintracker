# Red-Team-Ergebnisse

Datum: 21.06.2026  
Stand: automatisierte Tranche RT-01 bis RT-08

## Behobene Findings

| ID | Schweregrad | Befund | Maßnahme |
|---|---|---|---|
| RT-01-01 | Hoch | CSV-IDs enthielten `Date.now()`; derselbe Import erzeugte neue IDs. | Deterministische SHA-256-basierte Import-ID pro Zeile. |
| RT-01-02 | Hoch | Der lokale Store hängte gleiche Transaktions-IDs erneut an. | Idempotentes Speichern; bestehende manuelle Daten werden nicht überschrieben. |
| RT-02-01 | Hoch | Dashboard-Vertragsfilter wertete nur Kategorieattribute aus. | Buchungsmarkierung und benutzergebundene Vertragsentscheidung haben Vorrang. |
| RT-03-01 | Hoch | Split-Persistenz benötigt harte Cent- und Summeninvarianten. | Den auf `main` vorhandenen Allocation-Service in die gezielte Integrity-Suite aufgenommen. |
| RT-04-01 | Mittel | Manipulation und Klartextreste waren nicht als eigene Security-/Privacy-Suite geprüft. | AES-GCM-Tamper-, Lock- und Klartext-Negativtests ergänzt. |
| RT-06-01 | Mittel | CSV-Formel-Injection war implementiert, aber ohne Regressionstest. | Securitytest für `=`, `+`, `-` und `@`-Präfixe begonnen. |
| RT-05-01 | Hoch | Premium darf nicht nur über sichtbare Navigation geschützt werden. | Alle Premium-Navigationsziele werden gegen `ROUTE_GUARDS` und Feature-Tier getestet; manipulierte lokale Tierwerte bleiben wirkungslos. |
| RT-06-02 | Hoch | Fehlende Beträge wurden als 0 importiert; unmögliche Daten konnten normalisiert werden. | Ungültige Beträge und Kalenderdaten werden mit Zeilenangabe abgewiesen. |
| RT-06-03 | Mittel | OCR-Text hatte keine harte Größen- oder Zeilenbegrenzung. | Größen-/Zeilenlimits, echte Kalenderprüfung und begrenzte Händlertexte ergänzt. |
| RT-07-01 | Mittel | Diagonale Gesten konnten die mobile Grafikansicht versehentlich wechseln. | Sechs vollständig sichtbare Tabs, `touch-pan-y` und richtungsbewusste Swipe-Schwelle abgesichert. |
| RT-07-02 | Mittel | Ungültige `?view=`-Parameter konnten eine leere Story-Ansicht erzeugen. | Strikte View-Validierung mit sicherem Fallback auf „Verlauf“. |
| RT-08-01 | Hoch | Secret- und Red-Team-Suites waren nicht Teil der normalen CI. | Secret-Scan sowie Security-, Integrity-, Privacy- und Mobile-Suites in CI aufgenommen. |
| RT-08-02 | Mittel | Capacitor-Hardening war nur implizit über Defaults gegeben. | Cleartext, Mixed Content, WebView-Debugging, zusätzliche Navigation und Produktionslogs explizit deaktiviert. |

## Verifikation

- Production-Build: erfolgreich.
- Gesamtsuite: 69 Testdateien, 612 Tests erfolgreich.
- Security-Suite: 12 erfolgreich.
- Integrity-Suite: 12 erfolgreich.
- Privacy-Suite: 2 erfolgreich.
- Mobile-Suite: 5 erfolgreich.
- ESLint: 0 Fehler, 0 Warnungen.

## Dependency-Audit

Die Neuauflösung aktualisiert `undici` und `dompurify` auf gepatchte Versionen. `pnpm audit --audit-level moderate` meldet keine bekannte Schwachstelle. Build und vollständige Tests funktionieren mit der aktualisierten Auflösung.

## Verbleibende Grenzen

- Die Alpha-Freischaltung ist inzwischen implementiert. Sie bleibt eine lokale Testberechtigung und darf nicht als belastbare Zahlungs- oder serverseitige Sicherheitsgrenze verstanden werden.
- Trackerverse besitzt noch keinen Importer; dafür kann noch kein ausführbarer Schadkorpus getestet werden.
- PDF/OCR-Binärdateien benötigen später zusätzliche Parser-Timeouts und einen echten Fixture-Korpus. Der Textparser selbst ist begrenzt.
- Browserautomation konnte in dieser Sitzung nicht mit dem lokalen App-Browser verbunden werden. Viewport-, Screenreader- und physische Touchtests bleiben manuell erforderlich.
- Android-Manifest, signiertes Release-APK, Network Security Config und Store-Artefakte konnten ohne generiertes natives Android-Projekt nicht binär geprüft werden.
- Persistenz und UI für Transaktionsaufteilungen sind inzwischen vorhanden; Beleg- und Trackerverse-Importe benötigen weiterhin eigene Vertrauens- und Konfliktregeln.
