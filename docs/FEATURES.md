# Feature-Steckbriefe (versteckte / experimentelle Features)

Ergänzend zum Produkt-Audit (2026-06-20, Abschnitt E). Dokumentiert Features,
die vorhanden, aber nicht (vollständig) in der Hauptnavigation sichtbar sind —
damit klar ist, was aktiv, was experimentell und was bewusst verborgen ist.

## Trading (Beta)
- **Fundort:** `src/pages/TradingPage.tsx`, `src/components/trading/*`, Flag `trading_beta`.
- **Status:** Versteckt. Lokales Feature-Flag (`localStorage`, Default aus) +
  Premium-Tier erforderlich. Route nur gerendert, wenn Flag aktiv.
- **Reaktivierung:** In den Einstellungen → Beta-Features „Trading (Beta)" aktivieren.
- **Abhängigkeiten:** Marktdaten/Import, Premium-Tier (Paywall #25), Haftungsausschluss.
- **Risiken:** Lenkt vom Kernprodukt ab; keine Anlageberatung. Als Beta/Waitlist führen.

## Premium-Analyse
- **Fundort:** Route `/premium`, `src/components/premium-dashboard/*`.
- **Status:** Vorbereitet, gesperrt (Tier ist nie `premium`, siehe `lib/tier.ts`).
- **Reaktivierung:** Paywall/Payment (#25). Bis dahin zeigt die Route einen
  Locked-Preview (`PremiumUpsell` → `LockedPreview`).
- **Abhängigkeiten:** Tier/Payment, Demo-Daten für die Vorschau.
- **Risiken:** Nutzerfrust ohne Kaufweg → durch Preview + klare Story abgefedert.

## Simulation
- **Fundort:** Route `/simulation`, `src/components/simulation/*`.
- **Status:** Premium geplant, derzeit gesperrt (Route-Guard `simulation`).
- **Reaktivierung:** Mit Premium; Free-Preview mit Beispielwerten denkbar.
- **Risiken:** Falsche Versprechen vermeiden — als Planungsfeature bewerben.

## Brief-/Dokumentenimport (OCR)
- **Fundort:** `src/services/letter-*.ts`, `ocr-service.ts`, `receipt-parser-service.ts`,
  UI: `ClaimImportDialog` (Schulden), `ReceiptScanDialog` (Bargeld).
- **Status:** Teilweise versteckt. Services reif & getestet, kein eigener
  Navigationseintrag — Zugriff kontextuell (Schulden-Seite, Konten/Bargeld).
- **Reaktivierung:** Dokumentimport-Entry in Verträge/Schulden ergänzen, falls gewünscht.
- **Abhängigkeiten:** Tesseract.js (OCR), deutsche Textparsing-Heuristiken.
- **Risiken:** Datenschutz (lokale Verarbeitung), OCR-Fehlerfrust → Empty/Review-States.

## Receipt Scan (Belegscan)
- **Fundort:** `ReceiptScanDialog`, eingebunden in `CashSection` (Konten).
- **Status:** Teils sichtbar/kontextuell. Bild → Transaktions-Vorbefüllung.
- **Reaktivierung:** Als Bargeld-Booster prominenter per CTA in `CashSection`.
- **Risiken:** OCR-Fehler — gute Korrektur-UX nötig.

## Backups
- **Fundort:** `BackupManager`, Route `/backups` → Redirect `/settings`.
- **Status:** Teilweise versteckt (alte Route). Lebt jetzt in den Einstellungen.
- **Reaktivierung:** Mit Datenschutz/Export konsolidieren; Doppelung Export/Backup vermeiden.

## Performance-Dashboard
- **Fundort:** `src/components/PerformanceDashboard.tsx`, Route `/performance` → `/settings`.
- **Status:** Versteckt. Internes Dev-/Diagnose-Tool, nur als Settings-Abschnitt.
- **Reaktivierung:** Bewusst nicht in der End-Nutzer-Navigation. Bei Bedarf
  hinter Dev-Flag (`import.meta.env.DEV`) bündeln.

## Skins / Theme-Motion
- **Fundort:** `src/skins/*`, `theme-motion.ts`, `SkinSelector`.
- **Status:** Aktiv (Settings), Motion-Feld vorbereitet.
- **Hinweis:** Nur subtil einsetzen; respektiert `prefers-reduced-motion`
  (siehe `src/hooks/useReducedMotion.ts`).
