#!/usr/bin/env node

/**
 * „Bildschirmtext ist lesbar" (AGENTS.md §9, docs/design-principles.md Prinzip 7).
 *
 * **Bewusst OHNE Ausnahmeliste**, wie `check:a11y-names` und
 * `check:store-serialization`. Ein Eintrag hiesse „an dieser Stelle darf der
 * Text unlesbar sein" — und das ist keine Abwägung, die eine Fläche für ihre
 * Nutzer treffen kann. Der Bestand war klein genug, um ihn in einem Commit zu
 * drehen: 21 Stellen in 21 Dateien.
 *
 * Aufruf:  pnpm check:type-scale
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MIN_LESBAR_PX, findeZuKleinenText, istBildschirmtext } from './type-scale-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function verfolgteDateien() {
  return execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT })
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter(istBildschirmtext);
}

function main() {
  console.log(`\n🔠 Schriftgroessen-Check laeuft (Mindestmass ${MIN_LESBAR_PX}px)...\n`);

  const befunde = [];
  for (const rel of verfolgteDateien()) {
    const quelle = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    for (const fund of findeZuKleinenText(quelle, rel)) {
      befunde.push(`   ${rel}:${fund.zeile} — ${fund.quelle} (${fund.px}px)`);
    }
  }

  if (befunde.length > 0) {
    console.error(`❌ ${befunde.length} Stelle(n) mit Text unter ${MIN_LESBAR_PX}px:\n`);
    for (const zeile of befunde) console.error(zeile);
    console.error(`
   Behebung: auf die benannte Skala zurueck (\`text-xs\` = 12px) oder mindestens
   \`text-[${MIN_LESBAR_PX}px\`]. Reicht der Platz dann nicht, ist WENIGER TEXT die
   Antwort, nicht kleinerer — eine Beschriftung, die niemand lesen kann, belegt
   den Platz trotzdem.

   Papier (jspdf) und WebGL-Szenen (three) sind ausgenommen; berechnete Groessen
   ebenfalls. Begruendung: scripts/type-scale-core.mjs.
`);
    process.exit(1);
  }

  console.log(`✅ Kein Bildschirmtext unter ${MIN_LESBAR_PX}px\n`);
}

main();
