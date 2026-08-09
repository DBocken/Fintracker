# Coding Guide — Fintracker

Verbindliche Konventionen für dieses Projekt. Ergänzt `CLAUDE.md` (TDD-Workflow,
Design-/Animationsregeln) und setzt die Vorentscheidungen aus dem Audit um
(`docs/archive/codequalitaet-audit-2026-07-02.md`, `docs/archive/umsetzungsleitfaden-2026-07-02.md`).
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
  Einzige Ausnahme: die Repo-/Config-Wächter-Tests unter `src/security/*.security.test.ts`
  (bewusst dort: Repo-/Config-Wächter ohne Modul-Bezug, siehe AGENTS.md §5/§10).
  Durchsetzung: Pre-Commit/CI (`pnpm check:test-structure`); Claude Code blockt
  zusätzlich live über einen Hook.

## 3. TypeScript

- `strict` bleibt an. **Kein** `as any`, **kein** `as unknown as` an Datengrenzen.
- Domänentypen zentral in `src/types.ts` (Transaction, Account, Category, Budget,
  Debt, Claim, Contract, Backup, Vault, EncryptionState, FeatureFlag, Tier).
- `api/` und `mcp-poc/` sind im Typecheck — `pnpm typecheck:api` und
  `pnpm typecheck:mcp-poc`, beide in CI. Das Root-`tsconfig.json` includiert
  bewusst nur `src` + `vitest.setup.ts` (Browser-Ziel: DOM, JSX,
  `moduleResolution: bundler`); die beiden Node-Ziele haben deshalb eigene
  Konfigurationen. Bis WP 2.4 stand dieser Satz hier, ohne dass er zutraf —
  ausgerechnet der Token-Endpunkt kompilierte ungeprüft.

## 4. Money-Handling (verbindlich)

- Interne Rechnung in **Integer-Cent** über `src/lib/money.ts` (`toMinor`/`sumMinor`).
  Nie roher Float-Vergleich, nie `toFixed` für Berechnung.
- **Ein** Eingabe-Parser: `parseGermanNumber`/`parseEuroInput` (money.ts).
  Roh-`parseFloat(x.replace(',','.'))` ist **verboten** (liest „1.200" falsch).
- **EUR-only** (VE-1, ADR `docs/architecture/currency-eur-only.md`). Es gibt
  keine Kursquelle und keine Umrechnung. **Summiert wird nur Gleichwährendes:**
  `getPortfolioSummary` rechnet in der Depotwährung, `getNetWorthBreakdown` in
  Euro; was daneben liegt, steht sichtbar als „nicht verrechnet" daneben
  (`UnconvertedCurrencyNotice`), nie stumm in der Summe. Zerlegt wird das an
  einer Stelle: `src/lib/portfolio-currency.ts`.
- **Offener Rest von VE-1 (Stand WP 7.7):** Auf der **Konto- und Buchungsseite**
  gilt das noch nicht. `Account.currency` wird gespeichert und angezeigt, aber
  von keiner Rechnung gelesen — Saldo und Buchungen eines Fremdwährungskontos
  gehen 1:1 als Euro in `cash`, `sumIncome`/`sumExpenses`, Budgets, Prognose und
  EÜR ein. Wer das schließt, entscheidet zuerst über die **Buchungen**, nicht
  über den Kontodialog; Details im „Preis"-Abschnitt des ADR.

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
- **Ein Render-Helfer, ein Ort.** Komponenten-Tests rendern über den zentralen
  `@/test-utils/render` (`renderWithI18n` / `renderWithProviders`) — **keine**
  lokale `renderWithI18n`-Definition pro Datei (der Hook blockiert das).
  Ändert sich das Provider-Setup, wird nur diese eine Datei angefasst.
- **Datei-Suffixe** kennzeichnen Test-Kategorien und werden von den
  `pnpm test:*`-Skripten adressiert: `*.security.test.ts` (Security-Wächter),
  `*.mobile.test.tsx` (Mobile), sonst normale `*.test.ts(x)`.
- **Coverage** wird gemessen (`pnpm test:coverage`); die Thresholds in
  `vitest.config.ts` dürfen nicht unterschritten werden (CI wird sonst rot).

## 13. Trackingverse-Modularität

- Kein globaler Singleton-State außerhalb der Provider.
- Router-Basename-fähig (`<BrowserRouter basename>`); Storage-Keys pro Modul
  namespacen (über die Registry).
- Shared-Kandidaten (`lib/money`, `lib/schemas`, Krypto, Storage-Abstraktion)
  von FinTrack-spezifischer Domäne trennen; ein öffentliches Modul-Interface,
  keine tiefen Imports in interne Dateien.
