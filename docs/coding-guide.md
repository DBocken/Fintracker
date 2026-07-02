# Coding Guide — Fintracker

Verbindliche Konventionen für dieses Projekt. Ergänzt `CLAUDE.md` (TDD-Workflow,
Design-/Animationsregeln) und setzt die Vorentscheidungen aus dem Audit um
(`docs/codequalitaet-audit-2026-07-02.md`, `docs/umsetzungsleitfaden-2026-07-02.md`).
Bei Konflikt gilt: Sicherheit/Datenschutz/Finanzkorrektheit vor Bequemlichkeit.

## 1. Grundprinzipien

- **Local-first ist Default.** Finanzdaten bleiben auf dem Gerät (IndexedDB,
  optional AES-GCM-verschlüsselt). Jede Server-/Cloud-Interaktion ist explizit,
  nutzerinitiiert und auf der Privacy-Seite deklariert.
- **Der Code ist die Quelle der Wahrheit für jedes Privacy-Versprechen.** Ändert
  sich ein Datenfluss, wird `derivePrivacyStatus`/die Privacy-Seite mitgeändert.
- **Eine Sache, ein Ort.** Kein zweiter Import-Pfad, keine kopierte Summenlogik,
  kein zweites Sync-Format. Duplikation ist die teuerste Schuld dieses Projekts.

## 2. Ordnerstruktur

- `src/lib/` — pure Domänen-/Berechnungslogik (kein I/O, keine React-Imports).
- `src/services/` — I/O: Storage, Supabase, externe APIs. Kapselt `lib`.
- `src/hooks/` — React-Anbindung an Services/Domänenlogik.
- `src/components/` — UI. **Keine** Domänentypen, keine Geschäftslogik hier.
- `src/pages/` — Routen-Einstiegspunkte, dünn.
- Tests **immer** in `__tests__/` neben dem Code (nicht als `x.test.ts` neben `x.ts`).

## 3. TypeScript

- `strict` bleibt an. **Kein** `as any`, **kein** `as unknown as` an Datengrenzen.
- Domänentypen zentral in `src/types.ts` (Transaction, Account, Category, Budget,
  Debt, Claim, Contract, Backup, Vault, EncryptionState, FeatureFlag, Tier).
- `api/` und `mcp-poc/` gehören in den Typecheck.

## 4. Money-Handling (verbindlich)

- Interne Rechnung in **Integer-Cent** über `src/lib/money.ts` (`toMinor`/`sumMinor`).
  Nie roher Float-Vergleich, nie `toFixed` für Berechnung.
- **Ein** Eingabe-Parser: `parseGermanNumber`/`parseEuroInput` (money.ts).
  Roh-`parseFloat(x.replace(',','.'))` ist **verboten** (liest „1.200" falsch).
- **EUR-only** (VE-1). Nicht-EUR-Buchungen werden abgewiesen oder sichtbar als
  „nicht verrechnet" markiert, nie stumm summiert.

## 5. Finanzlogik & Invarianten

- Die 20 Invarianten in `docs/domain-invariants.md` sind **Testpflicht**.
- Aggregation (Einnahmen/Ausgaben/Saldo) nur über **eine** Quelle:
  `src/lib/analysis-data.ts` (`sumIncome`/`sumExpenses`). Interne Überträge
  (`is_transfer`) zählen nie als Einnahme/Ausgabe (Invariante 2). Komponenten-
  lokale `reduce`-Ketten über Beträge sind verboten.
- Split-Anteile haben alle das Vorzeichen der Originalbuchung; Summe = Original
  (cent-genau, `transaction-allocation-service`).

## 6. Validierung

- Neue Datengrenzen (IndexedDB, Backup, Vault, Import, Netz) mit **zod**
  (`zod@^4` vorhanden), ein Schema je Entität in `src/lib/schemas/`.
- Ungültige Beträge/Daten an fachlichen Grenzen (`saveTransactions`) **werfen**,
  nicht still auf 0/„heute" normalisieren (Invariante 18).
- Export neutralisiert Formeln aus nutzerkontrollierten Feldern und quotet nach
  RFC 4180; rein numerische Zellen werden nicht präfigiert.

## 7. Supabase-Regeln

- Client nutzt **nur** den anon-Key. `service_role` niemals im Frontend.
- Jede nutzerbezogene Tabelle hat RLS + `auth.uid() = user_id` + `WITH CHECK`.
  DDL immer als versionierte Migration (kein Dashboard-only-Schema).
- Edge Functions mit `service_role` prüfen die Ownership selbst (kein IDOR).

## 8. Local-first & Datenschutz

- Alle `ausgabentracker_*`-Keys über die zentrale Registry
  `src/services/local-storage-keys.ts` (VE-6). Kein duplizierter Key.
- In `localStorage` liegen **keine** Finanzdaten oder abgeleitete Klartexte —
  diese gehören in den verschlüsselbaren `local-finance-store` (VE-8).
- Bei aktiver Verschlüsselung liegen in IndexedDB nur AES-GCM-Envelopes
  (`docs/security-boundaries.md`).

## 9. Logging & Fehler

- **Kein** `console.log` mit Finanzinhalten (Beträge, Payees, Symbole, Quotes,
  Tokens) in Produktion.
- Fehlermeldungen sind verständlich, aber nicht informationspreisgebend (keine
  internen Tabellen-/RPC-Namen an anonyme Clients).

## 10. Feature-Flags & Gating

- Zentral, typisiert, Default aus, **reaktiv** gelesen (`useFeatureFlag`/`useTier`,
  nicht einmalig im Render). Gate an Route **und** Feature (Invariante 14).
- Jedes gegatete Feature steht in der Gating-Matrix (`tier.gating-matrix.test.ts`).

## 11. Kommentare

- Nur das **WARUM** dokumentieren (Fachregel, Sicherheit, nicht-offensichtliche
  Entscheidung), nicht das WAS. Keine code-kopierenden Kommentare.

## 12. Tests

- TDD: erst der (rote) Test, dann die minimale Implementierung.
- Scharfe Assertions (exakte Werte), kontrollierte Zeit/Zufall (fake timers,
  Seeds). Regressionstests für behobene Bugs mit `[REGRESSION]`-Präfix;
  Sicherheits-/Integritäts-/Privacy-Tests mit `[SECURITY]`/`[INTEGRITY]`/`[PRIVACY]`.
- CI (`pnpm lint`, `tsc`, `pnpm test`, Build) muss grün sein; `main` ist
  branch-protected.

## 13. Trackingverse-Modularität

- Kein globaler Singleton-State außerhalb der Provider.
- Router-Basename-fähig (`<BrowserRouter basename>`); Storage-Keys pro Modul
  namespacen (über die Registry).
- Shared-Kandidaten (`lib/money`, `lib/schemas`, Krypto, Storage-Abstraktion)
  von FinTrack-spezifischer Domäne trennen; ein öffentliches Modul-Interface,
  keine tiefen Imports in interne Dateien.
