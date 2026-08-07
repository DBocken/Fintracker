#!/usr/bin/env node

/**
 * „Jedes Bedienelement hat einen Namen" (WP-10.2).
 *
 * **Bewusst OHNE Ausnahmeliste.** Die anderen Wächter dieses Repos führen eine
 * — dort war der Bestand zu gross, um ihn in einem Commit zu drehen. Hier
 * nicht: 48 Stellen in 26 Dateien sind ein Nachmittag, und ein Bedienelement
 * ohne Namen ist für jemanden mit Screenreader schlicht nicht bedienbar. Eine
 * Ausnahmeliste würde genau das auf Dauer stellen.
 *
 * Aufruf:  pnpm check:a11y-names
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeAccessibleNames } from './a11y-name-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectSourceFiles(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const HINT = {
  'select-trigger':
    'Auswahlfeld ohne Namen — angesagt wird sonst der gewaehlte Wert, nicht wofuer er steht',
  'icon-button': 'Schaltflaeche mit nur einem Icon — ohne aria-label ist sie namenlos',
};

function main() {
  console.log('\n🔤 Namens-Check fuer Bedienelemente laeuft (WP-10.2)...\n');

  const problems = [];
  for (const file of collectSourceFiles(SRC_DIR)) {
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const { violations } = analyzeAccessibleNames(relative, fs.readFileSync(file, 'utf8'));
    for (const violation of violations) {
      problems.push(`   ${relative}:${violation.line} — ${HINT[violation.kind]}`);
    }
  }

  if (problems.length > 0) {
    console.error(`❌ ${problems.length} Bedienelement(e) ohne zugaenglichen Namen:\n`);
    for (const line of problems) console.error(line);
    console.error(
      '\n   Behebung: aria-label mit DEMSELBEN i18n-Key wie die sichtbare' +
        '\n   Beschriftung setzen (oder aria-labelledby auf deren id).\n',
    );
    process.exit(1);
  }

  console.log('✅ Alle Bedienelemente haben einen Namen\n');
}

main();
