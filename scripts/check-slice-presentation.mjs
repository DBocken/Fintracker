#!/usr/bin/env node

/**
 * Slice-Presentation-Wächter (AGENTS.md §3, ARCH-3, WP 2.3)
 *
 * Zählt Importe aus `src/features/<slice>/presentation/` nach der Alt-
 * Oberfläche (`src/components/`, `src/pages/`). Der Referenz-Slice
 * `dashboard` leckt genau so in Alt-`components`: `DashboardDesktopView.tsx`
 * importiert `TransactionCharts.tsx` (564 Zeilen), und `layers-core.mjs`
 * hatte dafür bis WP 2.3 keine Regel.
 *
 * **Ratsche, kein Verbot** — wie `check:view-data`. `plan.md` (WP 2.3) nahm
 * „zwei begründete Allowlist-Einträge" an; nachgezählt sind es 24 Importe in
 * 10 Dateien über alle vier Slices mit `presentation/`
 * (`docs/qualitaet-2026-08/nachpruefung.md` 0.6). Eine harte Regel wäre am
 * ersten Tag rot und bräuchte 24 Einzel-Ausnahmen — `layer-allowlist.json`
 * ist heute leer und soll es bleiben. Die Zahl in
 * `slice-presentation-budget.json` darf nur SINKEN; WP 6.2 (`TransactionCharts`
 * → `features/dashboard/presentation`) und WP 6.3 (`TradingDashboard` →
 * `features/trading/presentation`) senken sie gezielt.
 *
 * Eine EIGENE Zahl, keine Erweiterung von `check:view-data`: Das ist eine
 * andere Fachfrage als Datenzugriffe in der Darstellung (siehe Begründung in
 * `slice-presentation-core.mjs`) — beide Zahlen dürfen sich unabhängig
 * bewegen, eine verrechnete Summe würde eine Verschlechterung in der einen
 * Richtung durch Fortschritt in der anderen verdecken.
 *
 * Die Zählung selbst steht in `slice-presentation-core.mjs` und ist ohne
 * Dateisystem testbar (`scripts/__tests__/slice-presentation-core.test.mjs`)
 * — dieselbe Aufteilung wie bei `layers-core.mjs` und `view-data-core.mjs`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { countLegacyImports, istSlicePresentation } from './slice-presentation-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'slice-presentation-budget.json');

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', 'src/features'], { encoding: 'utf8', cwd: REPO_ROOT });
  return output
    .trim()
    .split('\n')
    .filter((f) => f && /\.tsx?$/.test(f))
    // `git ls-files` liest den INDEX; eine ungestagte Loeschung steht dort
    // noch drin und der Lesezugriff darauf wirft.
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
    .filter(istSlicePresentation);
}

console.log('\n🧩 Slice-Presentation-Wächter läuft (AGENTS.md §3, ARCH-3)...\n');

const dateien = trackedFiles();
let gesamt = 0;
let bausteineGesamt = 0;
const proDatei = [];
const bausteineProDatei = [];

for (const rel of dateien) {
  const { imports, specs, bausteine, bausteinSpecs } = countLegacyImports(
    rel,
    fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
  );
  if (imports > 0) {
    gesamt += imports;
    proDatei.push({ rel, imports, specs });
  }
  if (bausteine > 0) {
    bausteineGesamt += bausteine;
    bausteineProDatei.push({ rel, imports: bausteine, specs: bausteinSpecs });
  }
}

/** Fundstellen absteigend ausgeben — dieselbe Form fuer beide Spalten. */
function meldeFundstellen(liste) {
  liste
    .sort((a, b) => b.imports - a.imports)
    .forEach((d) => {
      console.error(`      ${String(d.imports).padStart(2)}\u00d7  ${d.rel}`);
      d.specs.forEach((s) => console.error(`            \u2192 ${s}`));
    });
}

const budget = fs.existsSync(BUDGET_PATH) ? JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8')) : null;

if (!budget) {
  console.error('❌ slice-presentation-budget.json fehlt — ohne Ausgangswert ist die Ratsche wirkungslos.');
  process.exit(1);
}

if (typeof budget.maxBausteine !== 'number') {
  console.error(
    '❌ slice-presentation-budget.json: `maxBausteine` fehlt. Seit WP 6.3 zählt der Wächter zwei getrennte Fachfragen (fremde Feature-UI vs. app-eigene Bausteine unter components/common/) — ohne beide Ausgangswerte ist die zweite Ratsche wirkungslos.',
  );
  process.exit(1);
}

console.log(`   ${proDatei.length} Slice-Presentation-Datei(en) importieren fremde Feature-UI`);
console.log(`   Stand: ${gesamt} — erlaubt: ${budget.max}`);
console.log(`   ${bausteineProDatei.length} Slice-Presentation-Datei(en) importieren app-eigene Bausteine (components/common/)`);
console.log(`   Stand: ${bausteineGesamt} — erlaubt: ${budget.maxBausteine}\n`);

if (bausteineGesamt > budget.maxBausteine) {
  console.error(
    `❌ ${bausteineGesamt - budget.maxBausteine} Baustein-Import(e) zu viel aus \`src/components/common/\`.\n`,
  );
  meldeFundstellen(bausteineProDatei);
  console.error(`
   Das sind die app-eigenen Bausteine (\`InfoGroup\`, \`InteractiveCard\`,
   \`EmptyState\`, \`DecimalInput\`, \`FinanceErrorState\`, …). Sie zu BENUTZEN ist
   richtig und teils erzwungen (AGENTS.md §8/§9) — sie liegen nur am falschen
   Ort. Seit WP 6.7 ist das keine Altlast mehr, sondern ein Rückfall: Der Umzug
   \`src/components/common/\` → \`src/features/shared/presentation/\` ist gemacht,
   die Zahl steht auf 0, und \`src/components/common/\` existiert nicht mehr. Ein
   neuer app-eigener Baustein gehört nach \`src/features/shared/presentation/\`,
   nicht wieder unter \`components/\`.
`);
  process.exit(1);
}

if (gesamt > budget.max) {
  console.error(`❌ ${gesamt - budget.max} Import(e) fremder Feature-UI zu viel in der Slice-Presentation.\n`);
  meldeFundstellen(proDatei);
  console.error(`
   Slice-Presentation (\`src/features/<slice>/presentation/\`) soll die
   Darstellung DES Slices sein, nicht die Alt-\`components/\`/\`pages/\`-Schicht
   danebenstellen — sonst lässt sich später keine zweite Präsentation
   hinzufügen, ohne die alte UI mitzuschleppen (AGENTS.md §3/§4). Fehlende
   Bausteine wandern in \`src/features/<slice>/presentation/\` bzw.
   \`src/features/shared/presentation/\` (Kochrezept:
   \`docs/architecture/feature-structure.md\`).

   Die Zahl in slice-presentation-budget.json darf NUR SINKEN. Sie
   heraufzusetzen macht den ARCH-3-Befund unsichtbar.
`);
  process.exit(1);
}

for (const [feld, ist, soll] of [
  ['max', gesamt, budget.max],
  ['maxBausteine', bausteineGesamt, budget.maxBausteine],
]) {
  if (ist < soll) {
    console.warn(
      `⚠️  Budget veraltet: ${feld} erlaubt ${soll}, gefunden ${ist}. Bitte in slice-presentation-budget.json auf ${ist} nachziehen — eine Ratsche, die nicht nachgezogen wird, gibt den Fortschritt wieder her.\n`,
    );
  }
}

console.log(
  `✅ Slice-Presentation OK (${gesamt} Feature-UI-Importe bei Ratsche ${budget.max}, ${bausteineGesamt} Baustein-Importe bei Ratsche ${budget.maxBausteine} — beide Zahlen dürfen nur sinken)\n`,
);
process.exit(0);
