#!/usr/bin/env node

/**
 * Ansicht/Daten-Wächter (AGENTS.md §3 und §4)
 *
 * Zählt die Datenzugriffe, die noch IN der Darstellungsschicht stehen —
 * `useQuery`/`useMutation` und direkte Service-Importe unter `src/components/`
 * und `src/pages/`.
 *
 * **Er verbietet nichts, er misst.** Eine Komponente DARF laut §3 einen Service
 * benutzen; die Richtung stimmt. Der Befund ist ein anderer: Solange eine
 * Fläche ihre eigene Datenschicht IST, lässt sich keine zweite Präsentation
 * danebenstellen, ohne die Datenbeschaffung ein zweites Mal zu schreiben — und
 * genau das verspricht §4 („gleiche Daten, gleiche Berechnungen, gleiches
 * ViewModel"). Der Weg dorthin heisst `features/<slice>/application`.
 *
 * Deshalb eine **Ratsche**: Die Zahl in `view-data-budget.json` darf nur
 * sinken. Ein hartes Verbot wäre hier falsch — 22 von 26 Routen sind noch nicht
 * zerlegt, und ein Wächter, der ab morgen jeden Commit blockiert, wird
 * abgeschaltet statt befolgt. Ein Wächter ohne Zahl wäre aber ebenso wertlos:
 * „wir trennen konsequent" ist eine Absichtserklärung, solange nichts rot wird.
 *
 * Die Zählung selbst steht in `view-data-core.mjs` und ist ohne Dateisystem
 * testbar — dieselbe Aufteilung wie bei `layers-core.mjs`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { countDataAccess, istDarstellung } from './view-data-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'view-data-budget.json');

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
  return output
    .trim()
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f))
    // `git ls-files` liest den INDEX; eine ungestagte Loeschung steht dort noch
    // drin und der Lesezugriff darauf wirft.
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
    .filter(istDarstellung);
}

console.log('\n🧭 Ansicht/Daten-Wächter läuft (AGENTS.md §3/§4)...\n');

const dateien = trackedFiles();
let queries = 0;
let serviceImports = 0;
const proDatei = [];

for (const rel of dateien) {
  const zahl = countDataAccess(rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
  if (zahl.total === 0) continue;
  queries += zahl.queries;
  serviceImports += zahl.serviceImports;
  proDatei.push({ rel, ...zahl });
}

const gesamt = queries + serviceImports;
const budget = fs.existsSync(BUDGET_PATH) ? JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8')) : null;

if (!budget) {
  console.error('❌ view-data-budget.json fehlt — ohne Ausgangswert ist die Ratsche wirkungslos.');
  process.exit(1);
}

console.log(`   ${proDatei.length} Flächen tragen ihre eigene Datenschicht`);
console.log(`   ${queries} Abfragen (useQuery/useMutation), ${serviceImports} direkte Service-Importe`);
console.log(`   Stand: ${gesamt} — erlaubt: ${budget.max}\n`);

if (gesamt > budget.max) {
  console.error(`❌ ${gesamt - budget.max} Datenzugriff(e) zu viel in der Darstellungsschicht.\n`);
  console.error('   Die zehn größten Flächen:');
  proDatei
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .forEach((d) => console.error(`      ${String(d.total).padStart(2)}×  ${d.rel}`));
  console.error(`
   Neue Abfragen gehören in \`src/features/<slice>/application\` — ein ViewModel,
   das Desktop und Mobile gemeinsam lesen (AGENTS.md §4). Vorlage:
   \`src/features/dashboard/\` und \`src/features/transactions/\`, Kochrezept in
   \`docs/architecture/feature-structure.md\`.

   Die Zahl in view-data-budget.json darf NUR SINKEN. Sie heraufzusetzen macht
   das Versprechen „gleiche Daten, gleiches ViewModel" zu einer Absichtserklärung.
`);
  process.exit(1);
}

if (gesamt < budget.max) {
  console.warn(
    `⚠️  Budget veraltet: erlaubt ${budget.max}, gefunden ${gesamt}. Bitte in view-data-budget.json auf ${gesamt} nachziehen — eine Ratsche, die nicht nachgezogen wird, gibt den Fortschritt wieder her.\n`,
  );
}

console.log(
  `✅ Ansicht/Daten OK (${gesamt} Zugriffe in der Darstellung, Ratsche bei ${budget.max} — die Zahl darf nur sinken)\n`,
);
process.exit(0);
