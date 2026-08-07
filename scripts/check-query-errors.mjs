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
 * **Zwei Arten von Eintrag.** Als das Backlog abgearbeitet war, blieb ein Rest,
 * der nicht unerledigt ist, sondern ENTSCHIEDEN: Voreinstellungen, deren
 * Standard bereits die richtige Antwort ist; Vorschläge, die nichts behaupten,
 * wenn sie ausbleiben; Abfragen, deren `queryFn` den Fehler selbst abfängt und
 * eine dokumentierte Ersatzantwort liefert. Eine blosse Zahl kann das nicht
 * sagen — sie liest sich wie „noch nicht gemacht".
 *
 *   "pfad/datei.tsx": 3                             ← offen, Backlog
 *   "pfad/datei.tsx": { "count": 1, "reason": "…" } ← entschieden, mit Grund
 *
 * `--update` zieht nur die Zahlen nach und lässt die Gründe stehen. Ein Objekt
 * ohne `reason` wird abgewiesen: Der Grund ist der ganze Zweck dieser Form.
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

/** Zahl oder `{ count, reason }` — beides ergibt ein Budget. */
export function budgetOf(entry) {
  return typeof entry === 'number' ? entry : entry?.count ?? 0;
}

/** Der Grund, falls der Eintrag als entschieden gekennzeichnet ist. */
export function reasonOf(entry) {
  return typeof entry === 'number' ? null : (entry?.reason ?? null);
}

/**
 * Ein Objekt-Eintrag ohne tragfähigen Grund ist eine Zahl mit Verkleidung.
 * Zehn Zeichen sind keine Qualitätsprüfung, aber sie schliessen „TODO" und
 * „später" aus.
 */
export function malformedEntries(files) {
  return Object.entries(files)
    .filter(([, entry]) => typeof entry !== 'number')
    .filter(([, entry]) => typeof entry?.count !== 'number' || (entry?.reason ?? '').trim().length < 10)
    .map(([file]) => file);
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
    // Gründe überleben ein `--update`: Sie sind Handarbeit, die Zahl daneben
    // nicht. Verschwindet der letzte Aufruf einer Datei, faellt der Eintrag
    // samt Grund weg — er beschreibt dann nichts mehr.
    const bisher = readAllowlist().files ?? {};
    const sorted = Object.fromEntries(
      Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, count]) => {
          const reason = reasonOf(bisher[file]);
          return [file, reason ? { count, reason } : count];
        }),
    );
    fs.writeFileSync(
      ALLOWLIST_PATH,
      `${JSON.stringify(
        {
          _comment:
            'useQuery-Aufrufe ohne eigene Aussage zum Fehlerfall. ZWEI Formen: eine blosse ZAHL ' +
            'ist offenes Phase-9-Backlog und darf nur sinken; ein Objekt { count, reason } ist ' +
            'ENTSCHIEDEN - dort ist der Fallback bereits die richtige Antwort (Voreinstellung, ' +
            'Vorschlag, oder eine queryFn, die den Fehler selbst abfaengt). Neue Stellen gehoeren ' +
            'in KEINE der beiden Formen - dann ist der Code zu aendern, nicht die Liste. Zahlen ' +
            'zieht `pnpm check:query-errors --update` nach, die Gruende bleiben stehen.',
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
    const entry = allowed[file];
    if (entry === undefined) {
      problems.push(`   ${file}: ${count} Aufruf(e) ohne Aussage zum Fehlerfall (neu)`);
      continue;
    }
    const budget = budgetOf(entry);
    if (count > budget) {
      problems.push(`   ${file}: ${count} statt bisher ${budget} — die Zahl darf nur sinken`);
    }
  }

  // Gegenrichtung: Ein Eintrag, der zu hoch steht, versteckt neue Stellen.
  const stale = Object.entries(allowed)
    .filter(([file, entry]) => (counts[file] ?? 0) < budgetOf(entry))
    .map(([file, entry]) => `   ${file}: nur noch ${counts[file] ?? 0} statt ${budgetOf(entry)} — bitte nachziehen`);

  const malformed = malformedEntries(allowed).map(
    (file) => `   ${file}: als entschieden gekennzeichnet, aber ohne tragfaehigen "reason"`,
  );
  if (malformed.length > 0) {
    console.error(`❌ ${malformed.length} Eintrag/Eintraege ohne Begruendung:\n`);
    for (const line of malformed) console.error(line);
    console.error(
      '\n   Die Objekt-Form ist fuer ENTSCHIEDENE Faelle da. Ohne Grund ist sie\n' +
        '   eine Zahl mit Verkleidung — dann bitte die blosse Zahl schreiben.\n',
    );
  }

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

  if (problems.length > 0 || stale.length > 0 || malformed.length > 0) process.exit(1);

  const handled = totalCalls - openCalls;
  const decided = Object.entries(allowed)
    .filter(([, entry]) => reasonOf(entry))
    .reduce((sum, [, entry]) => sum + budgetOf(entry), 0);
  console.log(
    `✅ Fehlerzustand OK (${handled}/${totalCalls} Aufrufe behandelt, ` +
      `${decided} begruendet ausgenommen, ${openCalls - decided} im Phase-9-Backlog)\n`,
  );
}

if (process.argv[1] && process.argv[1].endsWith('check-query-errors.mjs')) main();
