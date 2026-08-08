/**
 * Kernlogik der Slice-Presentation-Ratsche (AGENTS.md §3, ARCH-3, WP 2.3).
 *
 * Zählt Importe aus `src/features/<slice>/presentation/` nach `src/components/`
 * oder `src/pages/` — genau der Fund aus ARCH-3: Der Referenz-Slice
 * `dashboard` leckt in Alt-`components` (`DashboardDesktopView.tsx` importiert
 * `TransactionCharts.tsx`, 564 Zeilen), und `layers-core.mjs` hatte dafür
 * keine Regel.
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
 * Zählt Importe einer Slice-Presentation-Datei, die nach `src/components/`
 * oder `src/pages/` (die Alt-Oberfläche) zeigen.
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
    if (/^src\/(components|pages)\//.test(target)) specs.push(spec);
  }

  return { imports: specs.length, specs };
}
