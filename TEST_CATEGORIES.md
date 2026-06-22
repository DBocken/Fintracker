# 🧪 Fintracker Test-Kategorien Übersicht

## Gesamt-Statistik
- **Gesamt Tests:** 783 ✅
- **Test-Dateien:** 84
- **Mit speziellem Label:** 3 [REGRESSION] + 5 [INTEGRITY] + 5 [SECURITY] + 1 [MOBILE]

---

## 🎨 UI Components & Dashboard (14 Tests)

### Categories
- `CategoryTwoStepSelect.test.ts` - Hierarchie-Logik, parent_id Migration [REGRESSION]
  - 3 Gruppen: Normal Behavior (3), Edge Cases (4), Regression (2)

### Dashboard
- `transaction-editing.test.ts` - Transaktions-Bearbeitung
- `transaction-details.test.ts` - Transaktionsdetails Modal
- `filter-utils.test.ts` - Dashboard-Filter
- `period-utils.test.ts` - Periode-Utilities
- `MonthPicker.test.tsx` - Monats-Wähler
- `SimulationWizard.test.tsx` - Simulations-Assistent

### Mobile & Special
- `TransactionListMobile.mobile.test.tsx` [MOBILE] - Mobile Transaktionsliste
- `DashboardMobileStory.security.test.ts` [SECURITY] - Mobile Security

### Andere Components
- `contract-types.test.ts` - Vertragstypen
- `ClaimImportDialog.test.tsx` - Claim-Import
- `nav-config.test.ts` - Navigation-Konfiguration
- `FinancialLandscape.test.tsx` - Finanzielle Landschaft
- `SimulationEngine.contracts.test.ts` - Simulations-Engine

---

## 📚 Services (47 Tests)

### Category & Hierarchy Services
- `category-hierarchy-migration.test.ts` [REGRESSION] - parent_id Migration
- `category-backfill.test.ts` - Ausgabenklasse Backfill
- `transaction-categorization.test.ts` - Kategorisierung
- `explain-categorization.test.ts` - Kategorisierungs-Erklärung

### Transfer & Transaction Services
- `transfer-service.test.ts` - Transfer-Erkennung
- `transfer-balance-invariant.test.ts` - Transfer Balance-Invarianten
- `transaction-allocation-service.test.ts` [INTEGRITY] - Split-Buchungen
- `transaction-storage-service.security.test.ts` [SECURITY] - Storage-Security

### Financial Services
- `cash-service.test.ts` - Bargeld-Service
- `debt-service.test.ts` - Schulden-Service
- `debt-detection-service.test.ts` - Schulden-Erkennung
- `debt-guardrails-service.test.ts` - Schulden-Schutzmaßnahmen
- `financial-health-service.test.ts` - Finanzielle Gesundheit

### Data Import & Processing
- `csv-service.test.ts` [INTEGRITY] - CSV-Import
- `letter-parser-service.test.ts` - Brief-Parser
- `letter-splitting-service.test.ts` - Brief-Aufteilung
- `letter-ocr-service.test.ts` - OCR-Service
- `receipt-parser-service.test.ts` [INTEGRITY] - Beleg-Parser
- `gocardless-integration.test.ts` - GoCardless Integration
- `gocardless-balance-sync.test.ts` - Balance-Synchronisation

### Decision & Detection Services
- `contract-detection-service.test.ts` - Vertrags-Erkennung
- `contract-decision-service.test.ts` - Vertrags-Entscheidungen
- `automation-suggestion-service.test.ts` - Automatisierungs-Vorschläge
- `claim-service.test.ts` - Claim-Service
- `receivable-service.test.ts` - Forderungen-Service

### Security & Crypto
- `local-crypto.test.ts` [SECURITY] - Lokale Verschlüsselung
- `local-crypto.security.test.ts` [SECURITY] - Crypto-Security
- `local-data-boundary.security.test.ts` [SECURITY] - Datengrenzen-Security
- `audit-log-service.test.ts` - Audit-Logs

### Utilities & Helpers
- `merchant-normalization.test.ts` - Händler-Normalisierung
- `priority-service.test.ts` - Priorisierung
- `household-service.test.ts` - Haushalts-Service
- `account-data-quality-service.test.ts` - Datenqualität
- `girocode-service.test.ts` - Giro-Code
- `schufa-service.test.ts` - Schufa-Service

### Storage & Data
- `backup-service.test.ts` - Backup-Service
- `local-finance-store.test.ts` - Finanz-Speicher
- `local-data-reset.test.ts` - Datenlöschung
- `idb-kv.test.ts` - IndexedDB KV-Store
- `vault-format.test.ts` - Tresor-Format
- `demo-data-service.test.ts` - Demo-Daten

---

## 📖 Libraries & Utils (22 Tests)

### Analysis & Data Processing
- `analysis-data.test.ts` - Analysedaten
- `analysis-modes.test.ts` - Analyse-Modi
- `forecast-data.test.ts` - Prognose-Daten
- `forecast.test.ts` - Prognose-Engine
- `forecast-scenario.test.ts` - Szenario-Analyse
- `forecast-insights.test.ts` - Prognose-Einsichten
- `forecast-montecarlo.test.ts` - Monte-Carlo-Simulation

### UI & Visualization
- `chart-axis.test.ts` - Diagramm-Achsen
- `status-bucket.test.ts` - Status-Gruppierung

### Finance & Business Logic
- `money.test.ts` - Geldformat & Berechnungen
- `account-limits.test.ts` - Kontolimits
- `contract-derivation.test.ts` [INTEGRITY] - Vertrags-Ableitung
- `merchant-fingerprint.test.ts` - Händler-Fingerprint
- `delta.test.ts` - Delta-Berechnung

### User & Security
- `tier.test.ts` - Tier/Feature-Gates
- `tier.security.test.ts` [SECURITY] - Tier-Security
- `anonymous-mode.test.ts` - Anonym-Modus
- `privacy-status.test.ts` - Datenschutz-Status
- `feature-flags.test.ts` - Feature-Flags
- `app-origin.test.ts` - App-Origin

---

## 🌐 Internationalisierung (1 Test)
- `i18n.test.ts` - Übersetzungen & Lokalisierung

---

## 🏷️ Nach Test-Type

### 🔴 [REGRESSION] Tests (3)
Verhindern Rückfall von behobenen Bugs:
- Category hierarchy migration (2 Tests)
- Kategorie-Hierarchie nach Migration (1 Test)

### 🟠 [INTEGRITY] Tests (5)
Datenintegrität & Konsistenz:
- Transaction allocation (Split-Buchungen)
- CSV-Import
- Receipt parsing
- Contract derivation
- Forecast accuracy

### 🟡 [SECURITY] Tests (5)
Sicherheit & Kryptografie:
- Local encryption (2 Tests)
- Data boundaries
- Mobile story
- Transaction storage security

### 🔵 [MOBILE] Tests (1)
Mobile-spezifische Funktionen:
- Transaction list mobile

---

## 📊 Verteilung

```
UI Components      14  ████
Services           47  ███████████████
Libraries/Utils    22  ███████
i18n                1  
─────────────────────────
Gesamt            84 Test-Dateien
```

## ✅ Nächste Schritte für neue Features

1. **Ziel definieren** - Was soll erreicht werden?
2. **Tests schreiben** - Happy Path + Edge Cases + [REGRESSION]
3. **Implementieren** - Minimal code um Tests grün zu machen
4. **Commit** - Mit Referenz zu Tests & Ziel

Siehe: `CLAUDE.md` für TDD-Leitfaden
