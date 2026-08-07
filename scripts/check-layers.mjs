#!/usr/bin/env node

/**
 * Schicht-Wächter (AGENTS.md §3)
 *
 * Die Architektur nennt eine Richtung: `lib` → `services` → `hooks` →
 * `components` → `pages`, und in den Feature-Slices `domain` → `data` →
 * `application` → `presentation`. Eingehalten wurde sie beim Schreiben; über
 * die Zeit ist sie an 30 Stellen umgedreht worden, ohne dass irgendetwas rot
 * wurde — TypeScript kennt keine Schichten, und ein Import nach oben sieht
 * genauso aus wie einer nach unten.
 *
 * Der wiederkehrende Auslöser war nie Absicht, sondern Ort: ein fachlicher
 * *Typ* (`ContractRow`, `ForecastOverrides`, `MerchantRule`) oder eine reine
 * *Funktion* (`explainCategorization`, `normalizeIban`) wurde dort abgelegt,
 * wo sie zuerst gebraucht wurde — im I/O-Service oder in der Komponente. Wer
 * sie danach von unten brauchte, hatte nur eine Wahl: nach oben importieren.
 * Deshalb prüft dieser Wächter Richtungen, nicht Dateinamen.
 *
 * Die Prüflogik selbst steht in `./layers-core.mjs` — dort ist sie ohne
 * Dateisystem testbar (`scripts/__tests__/layers-core.test.mjs`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFile, isTestFile } from './layers-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'layer-allowlist.json');

function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((rel) => /\.tsx?$/.test(rel))
    .map((rel) => path.join(dir, rel))
    .filter((abs) => {
      // Tote Symlinks oder Pfade, die zwischen readdirSync und hier
      // verschwunden sind, dürfen den Wächter nicht crashen.
      try {
        return fs.statSync(abs).isFile();
      } catch {
        return false;
      }
    });
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return {};
  const entries = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')).exceptions ?? {};
  for (const [file, entry] of Object.entries(entries)) {
    if (!entry?.reason || !Array.isArray(entry.imports)) {
      console.error(
        `❌ layer-allowlist.json: Eintrag für ${file} braucht \`imports\` (Liste) und \`reason\` (Begründung).`,
      );
      process.exit(1);
    }
  }
  return entries;
}

const allowlist = loadAllowlist();
const files = sourceFiles(SRC_DIR)
  .map((abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/'))
  .filter((rel) => !isTestFile(rel))
  .sort();

console.log(`\n🧱 Schicht-Wächter läuft (${files.length} Produktionsdateien unter src/)...\n`);

const violations = [];
const usedExceptions = new Set();

for (const rel of files) {
  const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  const result = analyzeFile(rel, source, allowlist[rel]);
  violations.push(...result.violations);
  result.usedExceptions.forEach((spec) => usedExceptions.add(`${rel} → ${spec}`));
}

if (violations.length > 0) {
  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.ruleId)) byRule.set(v.ruleId, { why: v.why, items: [] });
    byRule.get(v.ruleId).items.push(v);
  }
  for (const [id, { why, items }] of byRule) {
    console.error(`❌ Schichtverstoß (${id}) — ${items.length}×`);
    console.error(`   ${why}`);
    items.forEach((v) => console.error(`   • ${v.file} → ${v.spec}`));
    console.error('');
  }
}

const staleExceptions = [];
for (const [file, entry] of Object.entries(allowlist)) {
  for (const spec of entry.imports) {
    if (!usedExceptions.has(`${file} → ${spec}`)) staleExceptions.push(`${file} → ${spec}`);
  }
}

if (staleExceptions.length > 0) {
  console.warn('⚠️  Verwaiste Einträge in layer-allowlist.json (Verstoß ist weg, Ausnahme kann raus):');
  staleExceptions.forEach((e) => console.warn(`   • ${e}`));
  console.warn('');
}

if (violations.length > 0) {
  console.error(`Siehe AGENTS.md §3 (Architektur). Insgesamt ${violations.length} Verstöße.\n`);
  process.exit(1);
}

console.log('✅ Schichtrichtung OK\n');
process.exit(0);
