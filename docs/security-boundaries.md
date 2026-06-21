# Sicherheits- und Datenschutzgrenzen

Stand: 21.06.2026

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
- `localStorage` darf kleine Konfigurationen enthalten, aber keine entschlüsselten Finanzlisten.
- Cloudfunktionen dürfen keine Klartext-Transaktionen als Nebenwirkung einer Berechtigungs- oder Synchronisationsprüfung erhalten.

## Berechtigungen

- Sichtbare Navigation ist keine Sicherheitsgrenze.
- `alphatester` ist nur ein temporärer Testcode und kein belastbarer Zahlungsnachweis.
- Echte Entitlements müssen benutzergebunden geprüft und widerrufbar sein.

## Fehlerverhalten

- Bei beschädigten, fremden oder inkonsistenten Daten sicher abbrechen.
- Keine Teilimporte ohne explizite Zusammenfassung und Bestätigung.
- Fehlermeldungen dürfen keine Schlüssel, vollständigen Finanzdaten oder sensible Rohdateien ausgeben.
