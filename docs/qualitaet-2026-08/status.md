# Fortschritt & Wiedereinstieg — Qualitätsprogramm 10/10

> **Protokoll, keine Regel.** Diese Datei sagt, *wo das Programm gerade steht*
> und *wie man daran weiterarbeitet*. Was zu tun ist, steht in
> [`plan.md`](plan.md); warum, in [`audit.md`](audit.md); was der Plan
> unterwegs übersehen hat und wie damit umgegangen wurde, in
> [`nachpruefung.md`](nachpruefung.md).

## Wenn du das liest, bist du eine neue Sitzung

Das Programm läuft agentengestützt und wird regelmäßig mitten in der Arbeit
unterbrochen — Volumenlimit, Container-Recycling, Sitzungsende. Es ist darauf
ausgelegt: **der gepushte Commit ist der einzige haltbare Zustand.** Was im
Arbeitsbaum liegt, wird nicht halb weitergeführt — es sei denn, sein Zustand
ist *bekannt* (Schritt 2).

```
1  git fetch origin
   git checkout claude/qualitaetsaudit-code-verbesserungen-6f10e4
   git pull

2  git status --short
   → leer? Weiter mit 3.
   → nicht leer? Dann steht im Block „Aktuell in Arbeit" (unten), welches
     Paket es ist und wie weit es war. Zwei Fälle, und nur zwei:

     (a) Der Block sagt „geprüft, Commit steht aus" und nennt genau diese
         Dateien → Wächterbatterie erneut laufen lassen, dann committen.
         Fertige, belegte Arbeit wird NICHT weggeworfen.
     (b) Alles andere — Block leer, Dateien passen nicht, Schritt unklar →
         git checkout -- . && git clean -fd     (Paket wird neu gemacht)

     Im Zweifel gilt (b). Ein neu gemachtes Paket kostet Zeit, ein halb
     verstandener Arbeitsbaum kostet Vertrauen in alles danach.

3  pnpm install --frozen-lockfile           (frischer Container hat kein node_modules)

4  Tabelle unten: das erste Paket mit Status ≠ „fertig" ist dran.

5  Den zugehörigen Abschnitt in plan.md lesen → Belege im Code neu
   verifizieren (Zeilennummern altern absichtlich) → Test zuerst, rot →
   implementieren → Wächterbatterie → commit → push.

6  Buchhaltung nachziehen: status.md (Tabelle + „Aktuell in Arbeit") und das
   plan.md-Kästchen. Das ist ein ZWEITER Commit — die SHA des Code-Commits
   steht erst fest, wenn er existiert. Der Code-Commit trägt das Paket, der
   Buchhaltungs-Commit trägt seine SHA. Erst dann ist das Paket fertig.
```

**Wächterbatterie je Paket** — in der Reihenfolge, die auch CI fährt
(`.github/workflows/ci.yml`, Job `quality`), schnellste Rückmeldung zuerst:

```
pnpm lint                                                     # 24 s
pnpm check:i18n && pnpm check:i18n-module-consts && pnpm check:test-structure \
  && pnpm check:layers && pnpm check:view-data && pnpm check:decimal-inputs \
  && pnpm check:money-parsing && pnpm check:card-rule && pnpm check:platform-parity \
  && pnpm check:query-errors \
  && pnpm check:a11y-names && pnpm check:state-coverage && pnpm check:i18n --all
                                                              # 14 s zusammen
pnpm exec tsc --noEmit                                        # 43 s
pnpm exec vitest run <betroffene Testdateien>                 # Sekunden
```

**Die volle Suite läuft nicht je Paket, sondern am Phasenende** — sie braucht
**~10 Minuten** (4808 Tests in 500 Dateien). Vierzigmal zehn Minuten wären
knapp sieben Stunden Wartezeit auf eine Frage, die CI bei jedem Push ohnehin
beantwortet. Begründung und Preis: `nachpruefung.md`, Eintrag 0.6.

Bei Themen aus AGENTS.md §10 zusätzlich `pnpm test:security` und
`pnpm security:secrets` — die laufen in Sekunden und gehören ins Paket.

**Am Phasenende:** `pnpm test` → `pnpm build` → `pnpm check:bundle-size` →
`pnpm test:coverage`.

## Aktuell in Arbeit

| | |
|---|---|
| **Paket** | WP 5.3 · TypedSelect + Query-Error-Helfer (KOMP-5) |
| **Schritt** | — |
| **Im Arbeitsbaum** | nichts |

*Dieser Block wird beim Start eines Pakets gefüllt und beim Commit wieder
geleert. Steht hier ein Paket und `git status` ist trotzdem sauber, wurde der
Commit gemacht und nur der Block vergessen — dann gilt `git log`.*

## Umgebung

Gemessen am 2026-08-08 auf `f2c6e5a`, frischer Container:

| | |
|---|---|
| pnpm / Node | 10.33.0 / v22.22.2 (CI pinnt pnpm 10.12.4, Node 22) |
| `pnpm install --frozen-lockfile` | ~1 min (ohne Cache) |
| zwölf `check:*` + `check:i18n --all` | **~15 s** |
| `pnpm lint` | 24 s |
| `pnpm exec tsc --noEmit` | 43 s |
| `pnpm test` | **9 min 51 s** (500 Dateien, 4808 Tests) |

## Baseline vor dem ersten Paket (`f2c6e5a`)

Alles grün — es gibt keinen Vorbefund, der als Paket getarnt in die Arbeit
gerät. Die Zahlen dienen als Vergleichspunkt, wenn später eine Ratsche oder
Allowlist wandert:

| Prüfung | Ergebnis |
|---|---|
| `pnpm lint` | ✅ 0 Befunde |
| `pnpm exec tsc --noEmit` | ✅ 0 Fehler |
| `check:i18n` (Diff) / `--all` | ✅ / ✅ 36 begründet ausgenommen, **17 offenes Backlog** |
| `check:i18n-module-consts` | ✅ |
| `check:test-structure` | ✅ |
| `check:layers` | ✅ (`layer-allowlist.json` leer) |
| `check:view-data` | ✅ **282 Zugriffe, Ratsche 282** |
| `check:decimal-inputs` | ✅ 0 / 0 |
| `check:card-rule` | ✅ 0 Altfälle |
| `check:platform-parity` | ✅ 3 dokumentierte Paare |
| `check:query-errors` | ✅ **125/150 behandelt**, 25 begründet ausgenommen, 0 Backlog |
| `check:a11y-names` | ✅ |
| `check:state-coverage` | ✅ **37/37 Pflichtzustände**, 0 offen, 7 entfallen |
| `pnpm test` | ✅ **500 Dateien, 4808 Tests, 0 Fehlschläge** |

## Paketstand

Reihenfolge wie in `plan.md` („Reihenfolge für den Einstieg"): Phase 1 und 2
verzahnt, danach 3–7. Harte Kanten: **1.3 vor 4.1 · 2.3 vor allen
Phase-6-Migrationen · 3.2 vor 7.3 · 5.1 vor 5.2.**

| # | WP | Thema | Status | Commit |
|---|---|---|---|---|
| 1 | 1.1 | Envelope-Korruption wirft statt schluckt (RES-1) | **fertig** | `2c3d5de` |
| 2 | 2.1 | Drei Mutations-Löcher schließen (TEST-1/2/3) | **fertig** | `c4bed98` |
| 3 | 2.2 | Regelverstöße + Wächter `check:money-parsing` (GOV-1) | **fertig** | `51accd2` |
| 4 | 1.2 | zod an der Kern-Lesegrenze — Teil A (Registry, 5 Collections) | **fertig** | `6404429` |
| 4a | **1.2b** | Integritätsmeldung erreicht die Fläche (`/transactions`) | **fertig** | `a13adf7` |
| 5 | 1.3 | Echter Migrationsläufer (RES-3) | **fertig** | `c765da1` |
| 6 | 1.4 | Sync-Import: Versionsvergleich + Bestätigung (RES-4) | **fertig** | `ff348fa` |
| 7 | 1.5 | Backup: Prüfsumme + Item-Validierung (RES-5) | **fertig** | `9f760db` |
| 8 | 1.6 | Speicher-Laufzeitfehler behandeln (RES-6, RES-7) | **fertig** | `080b0ae` |
| 8a | **1.7** | `forecastOverrides` schluckt den Korruptionsfehler weiter | **fertig** | `bba49ae` |
| 9 | 2.3 | Layer-Wächter: hooks + Slice-Presentation (ARCH-3/4) | **fertig** | `3e00d3f` |
| 10 | 2.4 | `api/` und `mcp-poc/` in den Typecheck (GOV-2) | **fertig** | `eafe761` |
| 11 | 2.5 | Invariante 5 einlösen (DOM-4) | **fertig** | `9bf65fd` |
| 12 | 3.1 | PBKDF2 ≥ 600 000 + kdf-Versionierung (SEC-1) | **fertig** | `dd07c67` |
| 13 | 3.2 | Auto-Lock (SEC-2) | **fertig** | `14c4600` |
| 14 | 3.3 | Passwort-Mindeststärke als Gate (SEC-3) | **fertig** | `db1260e` |
| 15 | 3.4 | RLS-Wächter prüft Restriktivität (SEC-4) | **fertig** | `c084fa4` |
| 16 | 3.5 | MCP-Klartext in der UI kennzeichnen (SEC-5) | **fertig** | `77319fc` |
| 17 | **4.1a** | ADR Chunk-Ablage + Baseline (PERF-1) | **fertig** | `edd7e6e` |
| 17a | **4.1b** | Chunk-Speicherschicht + Index (PERF-1) | **fertig** | `877bf71` |
| 17b | **4.1c** | Migration, Umschaltung, drei Messungen (PERF-1) | **fertig** | `6858756` |
| 18 | 4.2 | Query-Key-Invalidierungen präzisieren (PERF-2) | **fertig** | `08b77bb` |
| 19 | 4.3 | `invalidateQueries()` ohne Key eliminieren (PERF-5) | **fertig** | `f80e317` |
| 20 | 4.4 | Chart-Daten memoisieren (PERF-4) | **fertig** | `dfe2c94` |
| 21 | 4.5 | i18n-Bundle je Locale splitten (PERF-3) | **fertig** | `71f3cdf` |
| 22 | 5.1 | Branded Types für Geld (DOM-1) | **fertig** | `cc9783e` |
| 23 | 5.2 | `types.ts` aufteilen (DOM-3) | **fertig** | `3cca9d5` |
| 23a | **5.2b** | Branded IDs auf die realen Felder (DOM-3, Rest) | offen | |
| 24 | 5.3 | `TypedSelect<T>` + Query-Error-Helfer (KOMP-5) | offen | |
| 25 | 5.4 | `TransactionFilters` aufs ViewModel (KOMP-2) | offen | |
| 26 | 5.5 | Tagesgruppierung konsolidieren (KOMP-3) | offen | |
| 27 | 5.6 | `currencyFormatter`-Kopien → `useMoneyFormat` (KOMP-4) | offen | |
| 28 | 5.7 | Toter Code entscheiden (KOMP-6) | offen | |
| 29 | 6.1 | Verwaiste Slices entscheiden (ARCH-2) | offen | |
| 30 | 6.2 | `TransactionCharts` in die Dashboard-Slice (ARCH-3) | offen | |
| 31 | 6.3 | `TradingDashboard` → Slice-Presentation (ARCH-5) | offen | |
| 32 | 6.4 | `CityPage` entkernen (ARCH-5, KOMP-1) | offen | |
| 33 | 6.5 | Slice-Migration, nächste Kandidaten (ARCH-1) | offen | |
| 34 | 6.6 | Gott-Module lib-seitig teilen (ARCH-6) | offen | |
| 35 | 7.1 | Error-State-Tests verschärfen (TEST-4) | offen | |
| 36 | 7.2 | Datei-Schwellen für die Geldlogik (TEST-5) | offen | |
| 37 | 7.3 | E2E: Verschlüsselung + Backup-Roundtrip (TEST-6) | offen | |
| 38 | 7.4 | Versionierung einführen (GOV-3) | offen | |
| 39 | 7.5 | ADRs für Grundentscheidungen (GOV-4) | offen | |
| 40 | 7.6 | Buchhaltung & entschiedene Restpunkte (GOV-5/6, SEC-6, DOM-5) | offen | |

**Nachprüfung je Segment** (Segment = Phase) wird in `nachpruefung.md`
geschrieben, sobald die letzte WP einer Phase steht:

| Segment | Nachprüfung |
|---|---|
| 0 · Laufwerk | ✅ geschrieben |
| 1 · Phase 1 | ✅ geschrieben |
| 2 · Phase 2 | ✅ geschrieben |
| 3 · Phase 3 | offen |
| 4 · Phase 4 | offen |
| 5 · Phase 5 | offen |
| 6 · Phase 6 | offen |
| 7 · Phase 7 | offen |

## Arbeitsbedingungen dieses Programms

- **Branch:** `claude/qualitaetsaudit-code-verbesserungen-6f10e4`, ein
  kumulierender Draft-PR. Warum nicht ein PR je Paket: `nachpruefung.md`,
  Eintrag 0.1.
- **Ein Commit je Paket.** Commit-Message nennt WP-ID, Ziel und
  Testabdeckung — nicht nur, was geändert wurde.
- **Delegierte Agenten committen nicht.** Sie liefern einen grünen
  Arbeitsbaum ab; committet wird zentral, nachdem die Batterie noch einmal
  gelaufen ist. Deshalb hinterlässt ein abgebrochener Agent nur
  verwerfbaren Zustand — siehe Schritt 2 oben.
- **Aufwecker:** Vor dem Ende eines Zuges wird per `send_later` ein
  Wiedereinstieg terminiert. Er weckt nur; die Information steht hier.
