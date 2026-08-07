# Feature-Steckbriefe (versteckte / experimentelle Features)

Ergänzend zum Produkt-Audit (2026-06-20, Abschnitt E). Dokumentiert Features,
die vorhanden, aber nicht (vollständig) in der Hauptnavigation sichtbar sind —
damit klar ist, was aktiv, was experimentell und was bewusst verborgen ist.

## Trading — **nicht mehr versteckt**
- **Fundort:** `src/pages/TradingPage.tsx`, `src/components/trading/*`.
- **Status:** **Voll sichtbar und ungeschützt.** Kein Feature-Flag, kein
  Tier-Gate: `FEATURE_FLAGS` (`src/lib/feature-flags.ts`) kennt nur
  `telemetry`, `feedback`, `financeCity3d` und `bankSync`; der Nav-Eintrag hat
  kein `requiredTier`; `ROUTE_GUARDS` führt `/trading` nicht; `App.tsx` rendert
  die Route ohne `RouteGuard`.
- **Warum:** Die doppelte Absperrung (`trading_beta` + Premium) ist auf
  Nutzer-Entscheid entfernt worden — sie leitete verwirrend zum Coach um.
  Festgehalten im `[REGRESSION]`-Test „zeigt Trading ohne Beta-Flag und ohne
  Premium-Gate" in `src/components/layout/__tests__/nav-config.test.ts`.
- **Abhängigkeiten:** Marktdaten/Import (eToro, Quote-Provider), Haftungsausschluss.
- **Risiken:** Lenkt vom Kernprodukt ab; **keine Anlageberatung**. Der
  Haftungsausschluss trägt jetzt allein, wo vorher zusätzlich das Gate stand.
- **Technische Schuld:** `TradingDashboard.tsx` ist mit 1.357 Zeilen und 25
  `useQuery`-Aufrufen in einer Komponente die unstrukturierteste Fläche der App
  — und seit dem Wegfall des Gates die sichtbarste unter den großen. Zerlegung
  in einen Slice steht aus.

## Anlässe (Sonderkategorien)
- **Fundort:** Route `/occasions`, `src/pages/SpecialCategoriesPage.tsx`,
  Slice `src/features/special-categories/*`, Service `special-category-service.ts`.
- **Status:** Premium (`FeatureKey specialCategories`). Route in der Hauptnavigation
  (Gruppe „Analysen") mit Premium-Markierung; Free/Anonymous sehen den
  Locked-Preview (`PremiumUpsell`).
- **Konzept:** Quer zur Kategorie-Hierarchie liegende Ereignisse mit eigener
  Parent-Hierarchie (Hochzeit → Flitterwochen). Eine Buchung behält ihre echte
  Kategorie und wird zusätzlich einem Anlass zugeordnet (n:m, optional
  cent-genauer Teilbetrag). Beantwortet „Was hat der Urlaub wirklich gekostet?".
- **Abhängigkeiten:** local-first Store (IndexedDB, in Backup/Verschlüsselung/Reset
  registriert), Tier/Payment (#25) für den echten Kaufweg.
- **Ausbaustufen:** P1 Übersicht+Hierarchie (aktiv), P2 Teilbeträge/Vorschläge/
  Batch-Zuordnung, P3 Vergleich/Kostenziel/Report (siehe
  `docs/feature-strategy-sonderkategorien.md`).
- **Risiken:** Ohne Kaufweg nur Preview → durch begehrlichen Locked-Preview
  abgefedert.

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
