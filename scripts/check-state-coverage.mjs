#!/usr/bin/env node

/**
 * „Ein Test je Fläche und Zustand" (WP-12.1).
 *
 * **Warum es diesen Wächter gibt.** Die Zeilenabdeckung lag bei 71 % — und
 * `/debts` zeigte nach einem Lesefehler trotzdem „Noch keine Schulden". Für
 * diese Seite gab es Tests, sie waren grün, und sie prüften, DASS gerendert
 * wird, nicht WAS behauptet wird. Eine Prozentzahl kann das nicht sehen; sie
 * zählt Zeilen, nicht Aussagen. Deshalb zählt dieser Wächter Aussagen.
 *
 * **Die Ausnahmeliste kennt zwei Formen** — dieselbe Unterscheidung wie bei
 * `query-error-allowlist.json`, aus demselben Grund: Ohne sie liest der
 * Nächste jeden Rest als Schuld.
 *
 *   "/coach":    { "offen": ["leer", "fehler"] }                    ← Backlog
 *   "/settings": { "entfaellt": { "leer": "…" }, "offen": ["fehler"] } ← entschieden
 *
 * `offen` darf nur schrumpfen. `entfaellt` braucht einen Grund; ohne ihn wird
 * der Eintrag abgewiesen, sonst wäre er eine Lücke mit Verkleidung.
 *
 * Aufruf:
 *   pnpm check:state-coverage            # prüft
 *   pnpm check:state-coverage --update   # zieht `offen` an den Ist-Stand nach
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRoutes,
  collectCoverage,
  analyzeStateCoverage,
  malformedWaivers,
  REQUIRED_STATES,
} from './state-coverage-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ROUTES_FILE = path.join(REPO_ROOT, 'e2e-tests/fixtures/routes.ts');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'state-coverage-allowlist.json');

function collectTestFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      collectTestFiles(full, out);
    } else if (entry.name.endsWith('.test.tsx') || entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function readAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return { routes: {} };
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ state-coverage-allowlist.json ist kein gültiges JSON: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const update = process.argv.includes('--update');
  console.log('\n🧪 Zustands-Abdeckung je Fläche läuft (WP-12.1)...\n');

  const routes = parseRoutes(fs.readFileSync(ROUTES_FILE, 'utf8'));
  if (routes.length === 0) {
    console.error('❌ Keine Routen in e2e-tests/fixtures/routes.ts gefunden.');
    process.exit(1);
  }

  const files = collectTestFiles(SRC_DIR).map((file) => ({
    path: path.relative(REPO_ROOT, file).split(path.sep).join('/'),
    content: fs.readFileSync(file, 'utf8'),
    routes,
  }));

  const { byRoute, unknownStates, unknownRoutes } = collectCoverage(files);
  const allowlist = readAllowlist();

  if (update) {
    // Nur `offen` wird nachgezogen. `entfaellt` ist Handarbeit mit Begründung
    // und bleibt unangetastet — genau wie die Gründe in der Query-Liste.
    const next = {};
    for (const route of routes) {
      const entry = allowlist.routes?.[route] ?? {};
      const waived = Object.keys(entry.entfaellt ?? {});
      const tested = byRoute.get(route) ?? new Set();
      const offen = REQUIRED_STATES.filter((s) => !waived.includes(s) && !tested.has(s));
      if (offen.length === 0 && waived.length === 0) continue;
      next[route] = {
        ...(entry.entfaellt ? { entfaellt: entry.entfaellt } : {}),
        ...(offen.length > 0 ? { offen } : {}),
      };
    }
    fs.writeFileSync(
      ALLOWLIST_PATH,
      `${JSON.stringify(
        {
          _comment:
            'Flaechen ohne Test fuer einen Zustand. ZWEI Formen: "offen" ist Backlog und darf nur ' +
            'schrumpfen; "entfaellt" ist entschieden und braucht je Zustand einen Grund. Angemeldet ' +
            'wird ein Zustand ueber einen Tag im Testtitel: [ZUSTAND /route:zustand]. Neue Flaechen ' +
            'gehoeren in KEINE der beiden Formen - dann ist ein Test zu schreiben, nicht die Liste ' +
            'zu erweitern. "offen" zieht `pnpm check:state-coverage --update` nach, die Gruende bleiben.',
          routes: next,
        },
        null,
        2,
      )}\n`,
    );
    const offenCount = Object.values(next).reduce((n, e) => n + (e.offen?.length ?? 0), 0);
    console.log(`✍️  Ausnahmeliste geschrieben: ${Object.keys(next).length} Flächen, ${offenCount} offene Zustände\n`);
    return;
  }

  const { missing, stale, orphans, covered, required } = analyzeStateCoverage(
    routes,
    byRoute,
    allowlist,
  );
  const malformed = malformedWaivers(allowlist.routes);
  let failed = false;

  if (missing.length > 0) {
    failed = true;
    console.error(`❌ ${missing.length} Fläche(n) ohne Test für einen Pflichtzustand:\n`);
    for (const item of missing) console.error(`   ${item}`);
    console.error(
      `\n   Der Test meldet den Zustand über einen Tag im Titel an:\n` +
        `   it('[ZUSTAND /debts:fehler] sollte den Ladefehler benennen …', …)\n` +
        `   Vorlage: src/pages/__tests__/screens.error-state.test.tsx\n`,
    );
  }

  if (stale.length > 0) {
    failed = true;
    console.error(`❌ ${stale.length} Eintrag/Einträge sind erledigt, stehen aber noch als offen:\n`);
    for (const item of stale) console.error(`   ${item}`);
    console.error('\n   Bitte mit --update nachziehen — sonst versteckt die Liste den nächsten Befund.\n');
  }

  if (orphans.length > 0) {
    failed = true;
    console.error(`❌ ${orphans.length} Eintrag/Einträge ohne zugehörige Route:\n`);
    for (const route of orphans) console.error(`   ${route}`);
    console.error('');
  }

  if (unknownStates.length > 0) {
    failed = true;
    console.error(`❌ ${unknownStates.length} unbekannte(r) Zustand im Tag:\n`);
    for (const t of unknownStates) console.error(`   ${t.file}:${t.line} — "${t.state}"`);
    console.error('\n   Erlaubt sind: geladen, leer, gefiltert-leer, fehler (Zustands-Matrix WP-9.1).\n');
  }

  if (unknownRoutes.length > 0) {
    failed = true;
    console.error(`❌ ${unknownRoutes.length} Tag(s) auf eine unbekannte Route:\n`);
    for (const t of unknownRoutes) console.error(`   ${t.file}:${t.line} — "${t.route}"`);
    console.error('\n   Die Routen stehen in e2e-tests/fixtures/routes.ts.\n');
  }

  if (malformed.length > 0) {
    failed = true;
    console.error(`❌ ${malformed.length} "entfaellt"-Eintrag/Einträge ohne tragfähigen Grund:\n`);
    for (const item of malformed) console.error(`   ${item}`);
    console.error(
      '\n   Die Form ist fuer ENTSCHIEDENES da. Ohne Grund ist sie eine Luecke\n' +
        '   mit Verkleidung — dann gehoert der Zustand nach "offen".\n',
    );
  }

  if (failed) process.exit(1);

  const open = Object.values(allowlist.routes ?? {}).reduce((n, e) => n + (e.offen?.length ?? 0), 0);
  const waived = Object.values(allowlist.routes ?? {}).reduce(
    (n, e) => n + Object.keys(e.entfaellt ?? {}).length,
    0,
  );
  console.log(
    `✅ Zustands-Abdeckung OK (${covered}/${required} Pflichtzustände geprüft, ` +
      `${open} offen, ${waived} begruendet entfallen)\n`,
  );
}

if (process.argv[1] && process.argv[1].endsWith('check-state-coverage.mjs')) main();
