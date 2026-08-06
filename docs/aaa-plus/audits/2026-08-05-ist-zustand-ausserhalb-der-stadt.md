# Audit: Warum AAA+ außerhalb der Finanzstadt nicht ankommt

> Rolle: Repository Analyst. Verlangt von
> [Implementierungsplan §16](../implementation-plan.md#16-startpaket-für-die-ausführung).
> Datum: 2026-08-05. Stand: `main` @ `0fe6277`.
>
> **Regel dieses Dokuments:** Nichts wird behauptet, was nicht in einer Datei
> gelesen oder durch einen Lauf belegt wurde. Annahmen sind als solche markiert.

## Anlass

Beobachtung des Auftraggebers: „Ich merke nicht wirklich einen Unterschied in
der UI, außer bei der Stadt." Das Fortschrittsprotokoll führt dagegen Phase 2,
3 und 4 sowie vorgezogene Pakete aus Phase 5–7 als abgeschlossen.

Dieses Audit prüft, welche der beiden Aussagen der Code stützt.

## Verifizierte Fakten

### F-1: Die globale Atmosphäre war abgeschaltet — nicht fehlerhaft, sondern nicht angeschlossen

`src/components/layout/AppShell.tsx:42` (vor dieser Arbeit):

```tsx
<AtmosphereLayer state={{ temperature: 'neutral', intensity: 0, pulse: 'steady' }} />
```

`AtmosphereLayer` berechnet `opacity = Math.min(MAX_OPACITY, intensity * MAX_OPACITY)`
(`AtmosphereLayer.tsx:44`). Bei `intensity: 0` ist die Deckkraft konstant **0**.

`deriveAtmosphere` und `useAtmosphereState` (`src/hooks/useAtmosphereState.ts`)
sind vollständig implementiert und getestet. Genutzt wurden sie ausschließlich
in `src/pages/CityPage.tsx:237` — dort zusätzlich mit fest verdrahtetem
`budgetOvercount: 0` (Zeile 241, Kommentar: „Overview doesn't track budget
overruns").

**Bewertung:** Das ist die stärkste Einzelursache für den Eindruck. Die
Ableitung war nie das Problem; sie war an genau einer Stelle angeschlossen —
der Stadt. Ein Hook-Test kann das prinzipiell nicht bemerken, weil der Hook
korrekt ist.

### F-2: Die Chart-Migration war ein Import ohne Anwendung

`useChartAnimation` (WP-6.7) liefert `animate`, `animationDuration` und
`animationEasing`. Verwendet wurde der Hook in **einer** Datei
(`TransactionCharts.tsx`, Zeilen 53/149/257) und dort ausschließlich als
`const { animate } = useChartAnimation()`.

Damit liefen alle Charts des Repos mit den Recharts-Standardwerten
(1500 ms, `'ease'`) statt mit der AAA+-Bewegungssprache (600 ms, easeOutCubic).

**Ursache, verifiziert:** Recharts typisiert `animationEasing` als
Template-Literal `cubic-bezier(${number},${number},${number},${number})` —
ohne Leerzeichen (`node_modules/recharts/types/animation/easing.d.ts:3`).
`MOTION_EASINGS.build` ist `'cubic-bezier(0.33, 1, 0.68, 1)'` — mit
Leerzeichen. Der Hook typisierte den Wert zudem als breites `string`. Beides
verhindert die Zuweisung. Wer den Wert durchreichen wollte, bekam einen
Typfehler.

**Bewertung:** Keine Nachlässigkeit, sondern eine unbemerkte technische Sperre.
Sie erklärt, warum genau die beiden Felder ungenutzt blieben, die den
sichtbaren Unterschied ausmachen.

### F-3: Acht Tests waren rot — überwiegend AAA+-eigene

Vollständiger Lauf auf `main` vor jeder Änderung: **3816 Tests, 8 rot in
10 Dateien.**

| Datei | Paket |
|---|---|
| `FinanceEmptyState.test.tsx` (3) | WP-3.3 |
| `SignatureMoment.test.tsx` (1) | WP-6.5 |
| `decard-regression.test.tsx` (1) | Usability-Audit |
| `city-scene.test.ts` (1) | WP-E1 |
| `locale-parity.test.ts` (1) | i18n-Wächter |
| `BudgetTank.test.tsx` (1) | WP-4.4 |
| 4 × `e2e-tests/*.spec.ts` | WP-4.6 |

Alle betroffenen Pakete sind im Fortschrittsprotokoll als ✅ geführt.

### F-4: Eine echte Regression aus der AAA+-Arbeit

`KpiCard.tsx` trug `shadow-[var(--shadow-ambient)]`, ergänzt durch WP-3.5
(Material Token System). Der Kommentar unmittelbar darüber lautet: „Eine KPI hat
keine eigene Folgeaktion, daher KEIN Rahmen/Schatten". AGENTS.md §9 sagt
dasselbe. Der `[REGRESSION]`-Test, der genau diesen Usability-Befund bewacht,
war seither rot.

**Bewertung:** Die Überarbeitung hat hier eine dokumentierte Designregel
verletzt und ihren eigenen Wächter ausgelöst — der Befund lag seit dem Commit
sichtbar vor und wurde nicht gelesen.

### F-5: Drei Wächter prüften nichts — zwei davon grün

| Wächter | Befund |
|---|---|
| `locale-parity` Duplikat-Prüfung | `translations.ts` hat CRLF (alle 17 686 Zeilen). Split an `'\n'` ließ jede Zeile auf `\r` enden; die auf `\{$` verankerte Regex griff nie. Ergebnis: **null** statt vier Locale-Blöcke. |
| `FinanceEmptyState` Varianten | Lokaler `t`-Mock `(key, fallback) => fallback ?? key` gab rohe Keys zurück. `no-budgets` bestand nur, weil der Key-String „Budget" enthält. |
| `BudgetTank` layoutId (3 Tests) | Selektor `[data-framer-name]` — Attribut des Figma-Plugins, nicht von framer-motion. Zwei der drei Tests bestanden trivial mit `null === null`. |

Nach Reparatur der Locale-Parität: **keine echten Namespace-Duplikate**
vorhanden. Der Baum war sauber, nur die Aufsicht fehlte.

**Bewertung:** AGENTS.md §6 führt den Duplikat-Wächter als maschinelle
Absicherung. Diese Zusicherung war faktisch nicht gedeckt.

### F-6: CI war vollständig blockiert

Beide Jobs brachen nach ~10 Sekunden am `pnpm install --frozen-lockfile` mit
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` ab: `package.json` deklariert
`pnpm.overrides`, das Lockfile kannte den Block nicht. Betroffen war jeder PR
und `main`.

Der OSV-Scanner lief deshalb nie durch — nach der Reparatur meldete er
13 Advisories in 7 Paketen (0 kritisch, 5 hoch, 8 mittel).

### F-7: Die in §16 verlangten Ablageorte fehlten

`docs/aaa-plus/` enthielt nur `implementation-plan.md`, `progress.md`,
`tdd-specs.md` und `test-architect-prompt.md`. Die von §16 geforderten Ordner
`audits/`, `decisions/` und `evidence/` existierten nicht.

**Bewertung:** Das Fortschrittsprotokoll wurde weitergeschrieben, die
Beweisführung nicht. Damit ist für die abgeschlossenen Pakete nicht
nachvollziehbar, welcher Red-Zustand dokumentiert und welche Critic-Reviews
durchlaufen wurden.

## Gesamtbild

Der Eindruck des Auftraggebers ist zutreffend und hat vier trennbare Ursachen:

1. **Nicht angeschlossen** (F-1): Die Atmosphäre lag als totes Kabel in der
   Shell.
2. **Technisch gesperrt** (F-2): Die Chart-Migration scheiterte an einem
   Typkonflikt, nicht an fehlender Arbeit.
3. **Unbemerkt kaputt** (F-3, F-4): Acht rote Tests, darunter eine echte
   Regression gegen eine dokumentierte Designregel.
4. **Nicht überwacht** (F-5, F-6): Die Wächter, die das hätten melden sollen,
   waren blind oder liefen nie.

Das Fortschrittsprotokoll überzeichnet den Stand nicht in der Sache — die
genannten Bausteine existieren — wohl aber in der Wirkung. Ein Paket, dessen
Test rot ist und dessen Ergebnis nirgends verdrahtet wurde, ist nicht
abgeschlossen.

## Empfehlungen

| # | Empfehlung | Status |
|---|---|---|
| E-1 | Lockfile reparieren, damit CI überhaupt läuft | erledigt |
| E-2 | Die 8 roten Tests beheben, jeweils mit Gegenprobe | erledigt |
| E-3 | Atmosphäre global verdrahten | erledigt |
| E-4 | Chart-Migration entsperren und durchziehen | erledigt |
| E-5 | Zweiten vollständigen Screen migrieren | offen |
| E-6 | Manuelle Critic-Reviews (Art Director / UX / Motion) aus dem WP-4.6-Rest | offen |
| E-7 | `progress.md` korrigieren: Pakete mit roten Tests sind nicht abgeschlossen | offen |
| E-8 | `packageManager` in `package.json` pinnen (verhindert F-6 dauerhaft) | empfohlen, nicht entschieden |

## Methodischer Hinweis

Jeder Wächter, der über einen Korpus läuft, braucht eine Zusicherung über dessen
Größe („ich habe N Dinge geprüft, und N > 0"). Genau diese Zusicherung
(`expect(localeStarts.length).toBe(4)`) ist der einzige Grund, warum F-5
überhaupt auffiel — ohne sie wäre der Wächter still grün geblieben. Die übrigen
blinden Prüfungen hatten sie nicht und wurden nur durch gezieltes Nachlesen
gefunden.
