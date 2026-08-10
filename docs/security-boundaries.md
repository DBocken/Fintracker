# Sicherheits- und Datenschutzgrenzen

Stand: 2026-08-10 (Erstfassung 21.06.2026; Abflusswege und `localStorage`
nachgezogen — beide Ergänzungen waren im Code längst wächtergetestet, nur
dieses Dokument war stehengeblieben)

## Vertrauenswürdig

- ausführbarer Anwendungscode aus dem geprüften Build,
- validierte interne Domänenobjekte,
- ein im aktuellen Prozess entsperrter WebCrypto-Schlüssel.

## Nicht vertrauenswürdig

- CSV-, PDF-, OCR-, Bank- und Trackerverse-Inhalte,
- Händler-, Kategorie-, Notiz- und Produkttexte,
- URL-Parameter und lokaler UI-Zustand,
- lokale Tier-/Featurewerte,
- Backup- und Vault-Dateien vor Validierung und Entschlüsselung,
- Zeitstempel und IDs externer Geräte.

## Datenhaltung

- Transaktionen und andere sensible Bulk-Daten liegen lokal in IndexedDB.
- Bei aktivierter lokaler Verschlüsselung dürfen dort nur AES-GCM-Envelopes liegen.
- `localStorage` darf kleine Konfigurationen, die Auto-Lock-Steuerung und die
  gedeckelte Telemetrie-Warteschlange (Positivlisten-Felder, nie Beträge)
  enthalten, aber keine entschlüsselten Finanzlisten.
- Cloudfunktionen dürfen keine Klartext-Transaktionen als Nebenwirkung einer Berechtigungs- oder Synchronisationsprüfung erhalten.
- Das Gerät verlassen dürfen Daten auf genau **zwei** Wegen, beide Opt-in und
  beide in der Voreinstellung aus: der MCP-Aggregat-Upload
  (`cloud-mcp-sync-service.ts`, doppelte Bestätigung; Wächter
  `local-data-boundary.security.test.ts`) und die Opt-in-Telemetrie
  (`telemetry-service.ts`, Flag `telemetry` aus, ohne konfigurierten Endpunkt
  kein Versand; Wächter `telemetry.security.test.ts`). Ein dritter Weg ist
  ein Befund, keine Erweiterung.

## Berechtigungen

- Sichtbare Navigation ist keine Sicherheitsgrenze.
- `alphatester` ist nur ein temporärer Testcode und kein belastbarer Zahlungsnachweis.
- Echte Entitlements müssen benutzergebunden geprüft und widerrufbar sein.

## Fehlerverhalten

- Bei beschädigten, fremden oder inkonsistenten Daten sicher abbrechen.
- Keine Teilimporte ohne explizite Zusammenfassung und Bestätigung.
- Fehlermeldungen dürfen keine Schlüssel, vollständigen Finanzdaten oder sensible Rohdateien ausgeben.
