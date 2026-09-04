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
import { analyzeCardRule, zaehleKartenrahmen, zaehleBoxenInFokussiert } from './card-rule-core.mjs';
const BUDGET_PATH_NAME = 'card-rule-budget.json';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'card-rule-allowlist.json');
const BUDGET_PATH = path.join(REPO_ROOT, BUDGET_PATH_NAME);

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
  // Zwei Ratschen neben der harten Regel — sie messen, was jene NICHT sehen
  // kann: die tote Schachtel um eine Liste anklickbarer Zeilen.
  let rahmen = 0;
  let boxenFokussiert = 0;
  const rahmenProDatei = new Map();
  const boxenProDatei = new Map();
  for (const file of collectTsxFiles(SRC_DIR)) {
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const inhalt = fs.readFileSync(file, 'utf8');
    const { violates } = analyzeCardRule(relative, inhalt);
    if (violates) violations.push(relative);

    const r = zaehleKartenrahmen(relative, inhalt);
    if (r > 0) {
      rahmen += r;
      rahmenProDatei.set(relative, r);
    }
    const b = zaehleBoxenInFokussiert(relative, inhalt);
    if (b > 0) {
      boxenFokussiert += b;
      boxenProDatei.set(relative, b);
    }
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

  const budget = fs.existsSync(BUDGET_PATH)
    ? JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'))
    : null;

  if (budget) {
    console.log(`   ${rahmenProDatei.size} Datei(en) mit Kartenrahmen`);
    console.log(`   Kartenrahmen gesamt:      ${rahmen} — erlaubt: ${budget.max}`);
    console.log(`   Boxen in fokussiert:      ${boxenFokussiert} — erlaubt: ${budget.maxFokussiert}
`);
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

  const zuViel = [];
  if (budget && rahmen > budget.max) {
    zuViel.push(`${rahmen - budget.max} Kartenrahmen zu viel (${rahmen} statt hoechstens ${budget.max})`);
  }
  if (budget && boxenFokussiert > budget.maxFokussiert) {
    zuViel.push(
      `${boxenFokussiert - budget.maxFokussiert} Box(en) zu viel in einer fokussierten ` +
        `Praesentation (${boxenFokussiert} statt hoechstens ${budget.maxFokussiert})`,
    );
  }
  if (zuViel.length > 0) {
    console.error(`\n❌ ${zuViel.join(' und ')}.\n`);
    for (const [datei, n] of [...rahmenProDatei].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.error(`   ${String(n).padStart(2)}x  ${datei}`);
    }
    for (const [datei, n] of boxenProDatei) {
      console.error(`   fokussiert: ${n}x  ${datei}`);
    }
    console.error(
      '\n   Eine Liste bekommt keine Karte um sich, ein wiederholter Eintrag keine Karte' +
        '\n   je Stueck (docs/architecture/darstellungsdichte.md Regel 10). In der' +
        '\n   fokussierten Dichte gibt es gar keine Boxen (Regel 9).\n',
    );
  }

  if (budget && rahmen < budget.max) {
    console.log(
      `⚠️  Budget veraltet: max erlaubt ${budget.max}, gefunden ${rahmen}. Bitte in ` +
        `${BUDGET_PATH_NAME} nachziehen — eine Ratsche, die nicht nachgezogen wird, gibt ` +
        'den Fortschritt wieder her.\n',
    );
  }

  if (fresh.length > 0 || stale.length > 0 || zuViel.length > 0) process.exit(1);

  console.log(
    `✅ Karten-Regel OK (${violations.length} bekannte Altfälle in der Ausnahmeliste — ` +
      'das Phase-8-Backlog)\n',
  );
}

main();
