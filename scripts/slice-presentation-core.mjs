/**
 * Kernlogik der Slice-Presentation-Ratsche (AGENTS.md §3, ARCH-3, WP 2.3).
 *
 * Zählt Importe aus `src/features/<slice>/presentation/` nach `src/components/`
 * oder `src/pages/` — genau der Fund aus ARCH-3: Der Referenz-Slice
 * `dashboard` leckt in Alt-`components` (`DashboardDesktopView.tsx` importiert
 * `TransactionCharts.tsx`, 564 Zeilen), und `layers-core.mjs` hatte dafür
 * keine Regel.
 *
 * Ausgenommen sind seit WP 6.2 die shadcn-Primitive unter `src/components/ui/`
 * — Begründung bei `istDesignSystemPrimitiv()` weiter unten. Derselbe Bestand
 * ergibt damit 18 statt der in WP 2.3 gemessenen 24; die sechs Differenz sind
 * ausschliesslich `ui/`-Importe (`ui/card`, 4× `ui/button`, `ui/sheet`).
 *
 * **Warum eine Ratsche und keine harte `RULES`-Regel in `layers-core.mjs`.**
 * `plan.md` (WP 2.3) nahm „zwei begründete Allowlist-Einträge" an; nachgezählt
 * sind es 24 Importe in 10 Dateien über alle vier Slices mit `presentation/`
 * (siehe `docs/qualitaet-2026-08/nachpruefung.md` 0.6). Eine harte Regel wäre
 * damit am ersten Tag rot und bräuchte 24 Einzel-Ausnahmen in
 * `layer-allowlist.json` — genau das Muster, das dort vermieden werden soll
 * (`layer-allowlist.json` ist heute leer und soll es bleiben). Eine Zahl, die
 * nur sinken darf, macht denselben Befund sichtbar, ohne den Wächter am
 * ersten Tag abzuschalten (dieselbe Begründung wie bei `view-data-core.mjs`:
 * „ein Wächter, der ab morgen jeden Commit blockiert, wird abgeschaltet statt
 * befolgt").
 *
 * **Warum eine EIGENE Zahl und keine Erweiterung von `check:view-data`.**
 * `view-data-budget.json` zählt Datenzugriffe (`useQuery`/Service-Importe) IN
 * der Darstellungsschicht — eine andere Fachfrage als hier: Importiert eine
 * Slice-Presentation die ALTE UI-Komponenten-Schicht? Beide Zahlen dürfen sich
 * unabhängig bewegen (ein Slice kann seine Datenzugriffe weiter senken, ohne
 * dass sich seine UI-Kopplung ändert, und umgekehrt) — eine gemeinsame Summe
 * würde eine Verschlechterung in der einen Richtung durch Fortschritt in der
 * anderen verdecken. WP 6.2/6.3 senken gezielt DIESE Zahl (Migration von
 * `TransactionCharts`/`TradingDashboard` in die jeweilige Slice-Presentation)
 * — ein eigener Beleg, der in einer verrechneten Summe verschwände.
 *
 * Import-Erkennung wiederverwendet aus `layers-core.mjs` (`IMPORT_RE`,
 * `stripComments`, `resolveTarget`) — eine Zähl-Regel, nicht zwei, die
 * auseinanderlaufen könnten.
 */

import { IMPORT_RE, stripComments, resolveTarget, isTestFile } from './layers-core.mjs';

/** Nur die Presentation-Schicht der Feature-Slices wird gezählt. */
export function istSlicePresentation(relPath) {
  return /^src\/features\/[^/]+\/presentation\//.test(relPath);
}

/**
 * `src/components/ui/` ist das shadcn-Primitiven-Verzeichnis, nicht die
 * Alt-Oberfläche — und deshalb von der Zählung ausgenommen (WP 6.2).
 *
 * **Warum die Ausnahme erst jetzt kommt.** Der Ausgangswert 24 wurde in WP 2.3
 * am Bestand gemessen; die sechs `ui/`-Importe darin waren Beifang, keine
 * Entscheidung. Sichtbar wurde der Unterschied erst, als WP 6.2 die erste
 * Komponente WIRKLICH in eine Slice geschoben hat: `TransactionCharts` löst
 * zwei gezählte Importe auf (`DashboardDesktopView`, `DashboardMobileStory`)
 * und bringt als Slice-Datei drei eigene mit — `@/components/ui/card`,
 * `@/components/ui/switch`, `@/components/common/ChartFigure`. Unterm Strich
 * STIEG die Zahl von 24 auf 25: die Ratsche hätte ausgerechnet die Migration
 * verurteilt, für die sie gebaut wurde.
 *
 * Die Ursache ist die Fachfrage dahinter, nicht die Arithmetik. Gezählt werden
 * soll, was eine zweite Präsentation (Android, anderer Shell) zwingen würde,
 * die ALTE Oberfläche mitzuschleppen. Auf `src/components/ui/` trifft das
 * nicht zu: AGENTS.md §7 schreibt shadcn/`@/components/ui` als AUSSCHLIESSLICHE
 * UI-Quelle vor — eine zweite Präsentation benutzt dieselben Primitive, es gibt
 * gar keine Alternative. Eine Zahl, die sie mitzählt, kann nie 0 erreichen und
 * bestraft jede Migration mit ihrem eigenen Kartenrahmen.
 *
 * `src/components/common/` bleibt ausdrücklich GEZÄHLT: `ChartFigure`,
 * `InteractiveCard`, `FinanceErrorState` sind app-eigene Bausteine der
 * Alt-Oberfläche und echte Kandidaten für `src/features/shared/presentation/`
 * — dort ist der Befund berechtigt.
 */
function istDesignSystemPrimitiv(target) {
  return /^src\/components\/ui\//.test(target);
}

/**
 * Zählt Importe einer Slice-Presentation-Datei, die nach `src/components/`
 * oder `src/pages/` (die Alt-Oberfläche) zeigen — ohne die shadcn-Primitive
 * unter `src/components/ui/` (siehe `istDesignSystemPrimitiv`).
 *
 * @param relPath repo-relativer Pfad
 * @param source  Dateiinhalt
 * @returns `{ imports, specs }` — `specs` die rohen Import-Spezifizierer, für die Fehlermeldung
 */
export function countLegacyImports(relPath, source) {
  if (!istSlicePresentation(relPath) || isTestFile(relPath)) return { imports: 0, specs: [] };

  const specs = [];
  for (const match of stripComments(source).matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    const target = resolveTarget(spec, relPath);
    if (!target) continue;
    if (istDesignSystemPrimitiv(target)) continue;
    if (/^src\/(components|pages)\//.test(target)) specs.push(spec);
  }

  return { imports: specs.length, specs };
}
