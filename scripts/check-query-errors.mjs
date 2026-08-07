#!/usr/bin/env node

/**
 * „Kein `useQuery` ohne Aussage zum Fehlerfall" (WP-9.6).
 *
 * **Die Ausnahmeliste IST das Phase-9-Backlog** — wie schon bei der
 * Karten-Regel. Der Bestand ist gewachsen, bevor die Regel galt: 123 Aufrufe,
 * sieben behandelten den Fehlerfall. Alle in einem Zug umzubauen wäre ein
 * Sammelcommit über Dutzende Screens (gegen AGENTS.md §11).
 *
 * Deshalb: Der heutige Zustand steht in `query-error-allowlist.json`, je
 * Eintrag eine Datei mit der Anzahl unbehandelter Aufrufe. Der Check ist damit
 * **heute grün** und verhindert ab sofort NEUE Stellen — und jede
 * Screen-Migration senkt ihre Zahl. Die Liste schrumpft messbar, statt dass
 * „behandelt" ein Gefühl bleibt.
 *
 * Die Zahl steht bewusst dabei und nicht nur der Dateiname: Sonst könnte eine
 * Datei mit drei offenen Aufrufen einen vierten dazubekommen, ohne dass der
 * Check etwas merkt.
 *
 * Aufruf:
 *   pnpm check:query-errors            # prüft
 *   pnpm check:query-errors --update   # schreibt die Ausnahmeliste neu
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeQueryErrors } from './query-error-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'query-error-allowlist.json');

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectSourceFiles(full, out);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function readAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return { files: {} };
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ query-error-allowlist.json ist kein gültiges JSON: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const update = process.argv.includes('--update');

  console.log('\n🔌 Fehlerzustands-Check für useQuery läuft (WP-9.6)...\n');

  const counts = {};
  let totalCalls = 0;
  let openCalls = 0;
  for (const file of collectSourceFiles(SRC_DIR)) {
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const { violations, total } = analyzeQueryErrors(relative, fs.readFileSync(file, 'utf8'));
    totalCalls += total;
    if (violations.length > 0) {
      counts[relative] = violations.length;
      openCalls += violations.length;
    }
  }

  if (update) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(
      ALLOWLIST_PATH,
      `${JSON.stringify(
        {
          _comment:
            'Phase-9-Backlog: useQuery-Aufrufe, die den Fehlerfall nicht in die Hand nehmen — ' +
            'entstanden, bevor die Regel galt. Der Wert ist die ANZAHL offener Aufrufe je Datei; ' +
            'sie darf nur SINKEN. Neue Stellen gehoeren NICHT hierher — dann ist der Code zu ' +
            'aendern, nicht die Liste. Erzeugt mit pnpm check:query-errors --update.',
          files: sorted,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`✍️  Ausnahmeliste geschrieben: ${Object.keys(sorted).length} Dateien, ${openCalls} Aufrufe\n`);
    return;
  }

  const allowed = readAllowlist().files ?? {};
  const problems = [];

  for (const [file, count] of Object.entries(counts)) {
    const budget = allowed[file];
    if (budget === undefined) {
      problems.push(`   ${file}: ${count} Aufruf(e) ohne Aussage zum Fehlerfall (neu)`);
    } else if (count > budget) {
      problems.push(`   ${file}: ${count} statt bisher ${budget} — die Zahl darf nur sinken`);
    }
  }

  // Gegenrichtung: Ein Eintrag, der zu hoch steht, versteckt neue Stellen.
  const stale = Object.entries(allowed)
    .filter(([file, budget]) => (counts[file] ?? 0) < budget)
    .map(([file, budget]) => `   ${file}: nur noch ${counts[file] ?? 0} statt ${budget} — bitte nachziehen`);

  if (problems.length > 0) {
    console.error(`❌ ${problems.length} Datei(en) mit unbehandeltem Fehlerfall:\n`);
    for (const line of problems) console.error(line);
    console.error(
      '\n   Der Fallback `data = []` macht einen Ladefehler UNSICHTBAR: Der Screen zeigt' +
        '\n   seinen Leerzustand und behauptet damit „du hast noch nichts", obwohl die Daten' +
        '\n   da sind. Fehlerzustand destrukturieren (`isError`) und ins ViewModel heben —' +
        '\n   Darstellung über <FinanceErrorState>.\n',
    );
  }

  if (stale.length > 0) {
    console.error(`❌ ${stale.length} veraltete(r) Eintrag in query-error-allowlist.json:\n`);
    for (const line of stale) console.error(line);
    console.error('\n   Bitte mit --update nachziehen — sonst versteckt die Liste neue Stellen.\n');
  }

  if (problems.length > 0 || stale.length > 0) process.exit(1);

  const handled = totalCalls - openCalls;
  console.log(
    `✅ Fehlerzustand OK (${handled}/${totalCalls} Aufrufe behandelt, ` +
      `${openCalls} im Phase-9-Backlog)\n`,
  );
}

main();
