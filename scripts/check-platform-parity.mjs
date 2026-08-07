#!/usr/bin/env node

/**
 * Plattform-Paritäts-Check (agentenunabhängig) — AGENTS.md §4.
 *
 * Setzt den maschinell prüfbaren Teil der Paritäts-Regel durch. Bis hierher war
 * Parität ausschließlich Sache des Selbst-Reviews, und genau dort ist sie in
 * WP-8.3 durchgerutscht: Die Export-Reihe der Geldfluss-Visualisierung trug
 * `hidden sm:flex` **ohne Gegenstück** — auf dem Telefon gab es den Export
 * schlicht nicht. Gefunden hat das eine Durchsicht von Hand; beim nächsten Mal
 * findet es der Build.
 *
 * **Die Ausnahmeliste ist hier KEIN Backlog.** Anders als bei der Karten-Regel
 * enthält sie keine Altlasten, die abgearbeitet werden, sondern legitime Paare,
 * deren Gegenstück in einer NACHBARDATEI liegt (`TransactionTable` ↔
 * `TransactionListMobile`). Jeder Eintrag nennt seinen Partner. Ein Eintrag
 * ohne Partner ist ein verstecktes fehlendes Feature.
 *
 * Deshalb schreibt `--update` hier auch NICHT blind die Verstöße fort: Der
 * Partner ist eine Aussage, die ein Mensch treffen muss. Das Skript meldet nur,
 * was fehlt.
 *
 * Aufruf:
 *   pnpm check:platform-parity
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeParity } from './parity-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'platform-parity-allowlist.json');

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
  if (!fs.existsSync(ALLOWLIST_PATH)) return { pairs: {} };
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ platform-parity-allowlist.json ist kein gültiges JSON: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('\n📱 Plattform-Paritäts-Check läuft (AGENTS.md §4)...\n');

  const violations = new Map();
  for (const file of collectTsxFiles(SRC_DIR)) {
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const result = analyzeParity(relative, fs.readFileSync(file, 'utf8'));
    if (result.violates) violations.set(relative, result);
  }

  const pairs = readAllowlist().pairs ?? {};
  const fresh = [...violations.keys()].filter((file) => !(file in pairs)).sort();
  const stale = Object.keys(pairs)
    .filter((file) => !violations.has(file))
    .sort();

  if (fresh.length > 0) {
    console.error(`❌ ${fresh.length} Fläche(n) ohne Gegenstück auf schmalen Breiten:\n`);
    for (const file of fresh) {
      console.error(`   ${file}`);
      console.error(`      ${violations.get(file).reason}\n`);
    }
  }

  if (stale.length > 0) {
    console.error(
      `❌ ${stale.length} veraltete(r) Eintrag in platform-parity-allowlist.json ` +
        '(hat inzwischen ein Gegenstück in derselben Datei):\n',
    );
    for (const file of stale) console.error(`   ${file}`);
    console.error('\n   Bitte entfernen — sonst versteckt die Liste künftige Lücken.\n');
  }

  if (fresh.length > 0 || stale.length > 0) process.exit(1);

  console.log(
    `✅ Plattform-Parität OK (${Object.keys(pairs).length} dokumentierte Paare über ` +
      'Dateigrenzen hinweg)\n',
  );
}

main();
