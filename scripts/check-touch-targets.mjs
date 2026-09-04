#!/usr/bin/env node

/**
 * Tippziel-Ratsche (AGENTS.md §4).
 *
 * Zählt Bedienelemente, deren Trefferbereich AUSDRÜCKLICH unter 44 px gesetzt
 * ist. Die Zahl in `touch-target-budget.json` darf nur sinken. Begründung für
 * Grenze, Zählweise und die benannte Ausnahme (die Standardhöhe von
 * `ui/button.tsx`): `scripts/touch-target-core.mjs`.
 *
 * Aufruf:  pnpm check:touch-targets
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MIN_TIPPZIEL_PX, findeKleineTippziele, varianteHoehenAus } from './touch-target-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'touch-target-budget.json');

function verfolgteDateien() {
  return execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT })
    .trim()
    .split('\n')
    .filter((rel) => rel.endsWith('.tsx'));
}

console.log(`\n👆 Tippziel-Ratsche laeuft (Mindestmass ${MIN_TIPPZIEL_PX}px)...\n`);

// Die Trefferhoehen der Button-Varianten kommen aus `ui/button.tsx` selbst.
//
// Bis zur Mobil-Ueberarbeitung stand hier eine Kopie im Waechter, und die
// machte sein eigenes Versprechen unhaltbar: `touch-target-budget.json` sagt,
// die 186 Fundstellen seien „EINE Entscheidung ueber die Hoehen der Varianten
// in ui/button.tsx — danach erreicht die Zahl 0". Wer die Entscheidung traf,
// aenderte button.tsx; der Waechter las weiter seine eigene Kopie und zaehlte
// unveraendert 186. Eine Ratsche, die ihre Behebung nicht bemerken kann, misst
// nichts — sie haelt nur fest.
//
// Faellt die Datei weg oder ist ihr `size`-Block nicht lesbar, greift der
// Notnagel im Kern: lieber nach den alten Zahlen messen als still 0.
const BUTTON_PATH = path.join(REPO_ROOT, 'src/components/ui/button.tsx');
const variantenPx = fs.existsSync(BUTTON_PATH)
  ? varianteHoehenAus(fs.readFileSync(BUTTON_PATH, 'utf8'))
  : null;
if (variantenPx) {
  const zeile = Object.entries(variantenPx).map(([k, v]) => `${k}=${v}px`).join(' · ');
  console.log(`   Trefferhoehen aus ui/button.tsx: ${zeile}\n`);
} else {
  console.log('   ui/button.tsx nicht lesbar — messe nach den hinterlegten Ersatzwerten\n');
}

const proDatei = new Map();
let klassen = 0;
let varianten = 0;
for (const rel of verfolgteDateien()) {
  const funde = findeKleineTippziele(
    fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
    rel,
    variantenPx ?? undefined,
  );
  if (funde.length === 0) continue;
  proDatei.set(rel, funde);
  klassen += funde.filter((f) => f.herkunft === 'klasse').length;
  varianten += funde.length - funde.filter((f) => f.herkunft === 'klasse').length;
}

if (!fs.existsSync(BUDGET_PATH)) {
  console.error('❌ touch-target-budget.json fehlt — ohne Ausgangswert ist die Ratsche wirkungslos.');
  process.exit(1);
}
const budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));

console.log(`   ${proDatei.size} Datei(en) verkleinern einen Trefferbereich`);
console.log(`   per Klasse:   ${klassen} — erlaubt: ${budget.max}`);
console.log(`   per Variante: ${varianten} — erlaubt: ${budget.maxVarianten}\n`);

const zuViel = [];
if (klassen > budget.max) zuViel.push(`${klassen - budget.max} per Klasse verkleinerte(s) Element(e)`);
if (varianten > budget.maxVarianten) {
  zuViel.push(`${varianten - budget.maxVarianten} Element(e) mit zu kleiner Button-Variante`);
}

if (zuViel.length > 0) {
  console.error(`❌ ${zuViel.join(' und ')} zu viel.\n`);
  console.error('   Die zehn groessten Flaechen:');
  [...proDatei.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .forEach(([rel, funde]) => console.error(`      ${String(funde.length).padStart(2)}×  ${rel}`));
  console.error(`
   Per Klasse verkleinert: \`min-h-[${MIN_TIPPZIEL_PX}px] min-w-[${MIN_TIPPZIEL_PX}px]\` NEBEN die optische
   Groesse setzen. Das Icon darf klein bleiben, die Flaeche darum nicht —
   AGENTS.md §4 „Adapt, do not amputate": ein Element, das man nicht trifft,
   ist auf dem Telefon nicht vorhanden.

   Zu kleine Variante: die Antwort steht in src/components/ui/button.tsx, nicht
   an der Aufrufstelle — eine Entscheidung ueber die Hoehen von \`sm\` und \`icon\`
   loest alle auf einmal.

   Beide Zahlen in touch-target-budget.json duerfen NUR SINKEN.
`);
  process.exit(1);
}

for (const [name, ist, soll] of [
  ['max', klassen, budget.max],
  ['maxVarianten', varianten, budget.maxVarianten],
]) {
  if (ist < soll) {
    console.warn(
      `⚠️  Budget veraltet: ${name} erlaubt ${soll}, gefunden ${ist}. Bitte in touch-target-budget.json auf ${ist} nachziehen — eine Ratsche, die nicht nachgezogen wird, gibt den Fortschritt wieder her.\n`,
    );
  }
}

console.log(
  `✅ Tippziele OK (${klassen} per Klasse / ${varianten} per Variante, Ratschen bei ${budget.max} / ${budget.maxVarianten})\n`,
);
