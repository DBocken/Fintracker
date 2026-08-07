#!/usr/bin/env node

/**
 * Karten-Regel-Check (agentenunabhängig) — WP-8.0.
 *
 * Setzt AGENTS.md §9 repo-weit durch, statt nur als Hinweis beim Bearbeiten:
 * Bis hierher gab es dazu ausschließlich einen advisory Claude-Hook. CI sah nie
 * einen Verstoß, und Agenten ohne `.claude/`-Hooks auch nicht.
 *
 * **Die Ausnahmeliste ist das Phase-8-Backlog.** Der Bestand ist gewachsen,
 * bevor die Regel maschinell galt; ihn in einem Zug umzubauen wäre ein
 * Sammelcommit über Dutzende Screens (gegen AGENTS.md §11). Stattdessen ist der
 * heutige Zustand in `card-rule-allowlist.json` festgehalten, mit je einem
 * Eintrag pro Datei. Der Check ist damit **heute grün** und verhindert ab
 * sofort NEUE Verstöße — und jede Phase-8-Screen-Migration streicht ihre
 * Einträge. Die Liste schrumpft messbar, statt dass „migriert" ein Gefühl
 * bleibt.
 *
 * Ein Eintrag, der nicht mehr verletzt, wird als **veraltet** gemeldet und muss
 * weg. Ohne diese Gegenrichtung bliebe die Liste stehen, nachdem die Arbeit
 * getan ist, und würde wieder Verstöße verstecken.
 *
 * Aufruf:
 *   pnpm check:card-rule            # prüft
 *   pnpm check:card-rule --update   # schreibt die Ausnahmeliste neu
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCardRule } from './card-rule-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'card-rule-allowlist.json');

function collectTsxFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectTsxFiles(full, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function readAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return { files: [] };
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ card-rule-allowlist.json ist kein gültiges JSON: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const update = process.argv.includes('--update');

  console.log('\n🃏 Karten-Regel-Check läuft (AGENTS.md §9)...\n');

  const violations = [];
  for (const file of collectTsxFiles(SRC_DIR)) {
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const { violates } = analyzeCardRule(relative, fs.readFileSync(file, 'utf8'));
    if (violates) violations.push(relative);
  }
  violations.sort();

  if (update) {
    fs.writeFileSync(
      ALLOWLIST_PATH,
      `${JSON.stringify(
        {
          _comment:
            'Phase-8-Backlog: Dateien mit Karten-Chrome ohne Klick-Aktion, entstanden vor ' +
            'WP-8.0. Jede Screen-Migration streicht ihre Eintraege. Neue Eintraege gehoeren ' +
            'NICHT hierher — dann ist der Code zu aendern, nicht die Liste. Erzeugt mit ' +
            'pnpm check:card-rule --update.',
          files: violations,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`✍️  Ausnahmeliste geschrieben: ${violations.length} Einträge\n`);
    return;
  }

  const allowlist = new Set(readAllowlist().files ?? []);
  const fresh = violations.filter((file) => !allowlist.has(file));
  const stale = [...allowlist].filter((file) => !violations.includes(file)).sort();

  if (fresh.length > 0) {
    console.error(`❌ ${fresh.length} neue(r) Verstoß gegen die Karten-Regel:\n`);
    for (const file of fresh) console.error(`   ${file}`);
    console.error(
      '\n   Karten müssen als GANZES klickbar sein → <InteractiveCard to|href|onClick …>.' +
        '\n   Reine Info ohne Follow-up gehört ohne Karte dargestellt →' +
        ' <InfoGroup>/<InfoStatStrip>.' +
        '\n   Ist es ein Dialog-, Formular- oder Chart-Container? Dann erkennt der Check das' +
        '\n   normalerweise selbst — sonst gehört der Fall in scripts/card-rule-core.mjs,' +
        '\n   nicht in die Ausnahmeliste.\n',
    );
  }

  if (stale.length > 0) {
    console.error(
      `❌ ${stale.length} veraltete(r) Eintrag in card-rule-allowlist.json ` +
        '(verletzt nicht mehr):\n',
    );
    for (const file of stale) console.error(`   ${file}`);
    console.error('\n   Bitte entfernen — sonst versteckt die Liste künftige Verstöße.\n');
  }

  if (fresh.length > 0 || stale.length > 0) process.exit(1);

  console.log(
    `✅ Karten-Regel OK (${violations.length} bekannte Altfälle in der Ausnahmeliste — ` +
      'das Phase-8-Backlog)\n',
  );
}

main();
