# Nachweise — 2026-08-05

> Verlangt von [Implementierungsplan §16](../implementation-plan.md#16-startpaket-für-die-ausführung)
> und [§15 Definition of Done](../implementation-plan.md#15-definition-of-done):
> Red-Zustand dokumentiert, Green-Zustand erreicht, Regression Suite
> durchlaufen.
>
> Alle Läufe mit der in CI gepinnten Version: **pnpm 10.12.4, Node 22**.

## Baseline vor jeder Änderung

Branch-Ausgangspunkt `main` @ `0fe6277`.

```
Test Files  10 failed | 379 passed (389)
     Tests   8 failed | 3808 passed (3816)
```

`pnpm exec tsc --noEmit`: fehlerfrei.
`pnpm lint`: 0 Fehler, **1 Warnung** (`useAtmosphereState.ts:109`,
`react-hooks/exhaustive-deps`).

CI zu diesem Zeitpunkt: **beide Jobs brachen nach ~10 s am Install ab**
(`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`). Es lief kein einziger Test.

### Die 8 roten Tests

```
FinanceEmptyState (WP-3.3)
  - sollte den Standard-Zustand mit CSV-Import und Demo-Daten rendern
  - sollte mit variant="no-goals" einen zielbezogenen Text zeigen
  - sollte eine visuell dominante primäre Aktion haben
SignatureMoment (WP-6.5)
  - sollte bei reduced-motion statisch sein
De-Carding (Usability-Audit)
  - [REGRESSION] KpiCard sollte ohne Karten-Chrome … rendern
createCityScene (WP-E1)
  - sollte Höhen-Tweens gestaffelt starten
Doppelte Namespaces (i18n-Wächter)
  - [REGRESSION] sollte je Locale keinen Namespace doppelt definieren
BudgetTank (WP-4.4)
  - sollte mit layoutId einen Framer-Motion-Wrapper rendern
```

Dazu 4 Suiten ohne Testlauf: `e2e-tests/*.spec.ts` — Playwright-Specs, die
Vitests Standard-`include` einsammelte („Playwright Test did not expect
test.describe() to be called here").

## Red-Nachweise der neuen Arbeit

**`useGlobalAtmosphere`** — vor der Implementierung:

```
Error: Failed to resolve import "../useGlobalAtmosphere"
Test Files  1 failed (1) | Tests  no tests
```

**`AppShell.atmosphere.test.tsx`** — die beiden `[REGRESSION]`-Tests mocken den
Hook auf `warm` bzw. `cool` und prüfen `data-temperature`. Gegen die vorherige
Fassung (`AppShell.tsx:42` mit fest verdrahtetem `neutral`) schlagen sie
zwangsläufig fehl; das ist der Sinn des Wächters.

**Lockfile-Reparatur** — verifiziert, nicht behauptet:

```
vorher:  ERR_PNPM_LOCKFILE_CONFIG_MISMATCH        exit 1
nachher: pnpm@10.12.4 install --frozen-lockfile   Done in 5.4s
```

Kein `resolution:`-Eintrag im Diff geändert → keine Paketversion bewegt.

## Green-Zustand

Nach den Testreparaturen (`4ba0099`):

```
Tests  3823 | failed: 0 | Suites failed: 0
```

Nach der Atmosphäre-Verdrahtung (`91feee1`):

```
Tests  3836 | failed: 0 | Suites failed: 0
```

`tsc --noEmit`: fehlerfrei. `pnpm lint`: **0 Warnungen** (die vorbestehende
Warnung wurde mitbehoben).

Zuwachs von 3816 auf 3836 = **20 neue Tests**, davon 9 für
`useGlobalAtmosphere` (inkl. eines `[PERF]`-Tests, der belegt, dass weder
`getTransactions` noch `getBudgetOverview` aufgerufen werden), 4 für die
AppShell-Verdrahtung, der Rest Gegenproben zu den reparierten Wächtern.

## Gegenproben

Jede Testreparatur hat eine Gegenprobe bekommen — ein Test, der fehlschlägt,
wenn das geprüfte Verhalten *ganz* fehlt. Ohne sie hätte eine Reparatur den
blinden Zustand zementieren können:

| Reparierter Wächter | Gegenprobe |
|---|---|
| `SignatureMoment` reduced-motion | „sollte ohne reduced-motion mit einem Skalierungs-Transform starten" |
| `FinanceEmptyState` primäre Aktion | sekundäre Aktion trägt `border-input`, primäre `bg-primary` |
| `BudgetTank` layoutId | negative Fälle prüfen jetzt `firstElementChild === svg` statt eines nie greifenden Selektors |
| `MOTION_EASINGS_CHART` | `[REGRESSION]`: identisch zu `MOTION_EASINGS.build` ohne Leerzeichen |

## Nicht erbracht

- **Manuelle Critic-Reviews** (Art Director ≥ 3/5, UX Critic ≥ 3/5, Motion
  Director ≥ 3/5) aus dem offenen WP-4.6-Rest. Nicht automatisierbar.
- **Visuelle Regression** gegen die vorhandenen Baselines
  (`e2e-tests/*-snapshots/`): nicht neu erzeugt. Die Atmosphäre-Verdrahtung
  ändert den Hintergrund datenabhängig; die Baselines wurden unter
  `intensity: 0` aufgenommen und müssen nach einer Sichtprüfung neu gesetzt
  werden. **Offener Punkt, bewusst nicht stillschweigend übergangen.**
- **Prod-Performance-Messung** (LCP < 2.5 s): die vorhandenen Specs messen
  gegen Dev-Budgets, wie in `progress.md` bereits vermerkt.
