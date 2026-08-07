#!/usr/bin/env node

/**
 * „Kein Bündel wächst unbemerkt" (WP-10.6).
 *
 * Phase 10 verlangt, Performance vollständig durchzusprechen. LCP und CLS sind
 * abgedeckt (`all-screens-performance.spec.ts`) — die Menge an JavaScript, die
 * dafür überhaupt erst geladen werden muss, war es nicht. Sie stand bislang nur
 * als Warnung im Build-Protokoll („Some chunks are larger than 500 kB"), und
 * eine Warnung, die bei jedem Build erscheint, liest nach der dritten Woche
 * niemand mehr.
 *
 * Das Budget ist bewusst der HEUTIGE Stand plus etwas Luft, nicht ein
 * Wunschwert. Ein Budget, das am ersten Tag rot ist, wird am zweiten
 * abgeschaltet. Es soll Wachstum sichtbar machen, nicht die Vergangenheit
 * verurteilen.
 *
 * Aufruf:
 *   pnpm build && pnpm check:bundle-size
 *   pnpm check:bundle-size --update   # schreibt das Budget neu
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkName, compareToBudget, formatBytes, gzipSizeOf } from './bundle-size-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = path.join(REPO_ROOT, 'dist', 'assets');
const BUDGET_PATH = path.join(REPO_ROOT, 'bundle-size-budget.json');

/** Luft über dem heutigen Stand, in Prozent. */
const HEADROOM = 0.1;

/**
 * Erst ab dieser Grösse bekommt ein Bündel ein eigenes Budget.
 *
 * Der Build erzeugt rund 150 Dateien, die allermeisten davon einzelne Icons
 * unter einem Kilobyte. Ein Budget je Icon wäre eine Liste, die niemand liest,
 * und würde jede Änderung mit Meldungen zudecken, die nichts bedeuten. Die
 * Summe deckt sie trotzdem ab: `totalGzipBytes` zählt ALLE Bündel.
 */
const MIN_TRACKED_BYTES = 20 * 1024;

function measure() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('❌ dist/assets fehlt — bitte zuerst `pnpm build` ausführen.\n');
    process.exit(1);
  }
  const measured = {};
  for (const file of fs.readdirSync(ASSETS_DIR)) {
    if (!file.endsWith('.js')) continue;
    measured[chunkName(file)] = gzipSizeOf(fs.readFileSync(path.join(ASSETS_DIR, file)));
  }
  return measured;
}

function main() {
  const update = process.argv.includes('--update');
  const measured = measure();

  console.log('\n📦 Bundle-Budget-Check läuft (WP-10.6)...\n');

  if (update) {
    const chunks = Object.fromEntries(
      Object.entries(measured)
        .filter(([, bytes]) => bytes >= MIN_TRACKED_BYTES)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, bytes]) => [name, Math.ceil((bytes * (1 + HEADROOM)) / 1024) * 1024]),
    );
    const total = Object.values(measured).reduce((sum, bytes) => sum + bytes, 0);
    fs.writeFileSync(
      BUDGET_PATH,
      `${JSON.stringify(
        {
          _comment:
            'Gzip-Grenzen je Bündel in Byte. Erzeugt aus dem heutigen Stand plus 10 % Luft ' +
            '(pnpm check:bundle-size --update). Wer einen Wert anhebt, sagt damit: Dieses ' +
            'Wachstum ist gewollt. Wer ihn senkt, hat etwas eingespart — beides gehört in ' +
            'die Commit-Nachricht.',
          totalGzipBytes: Math.ceil((total * (1 + HEADROOM)) / 1024) * 1024,
          chunks,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`✍️  Budget geschrieben: ${Object.keys(chunks).length} Bündel, ${formatBytes(total)} gesamt\n`);
    return;
  }

  if (!fs.existsSync(BUDGET_PATH)) {
    console.error('❌ bundle-size-budget.json fehlt — mit --update erzeugen.\n');
    process.exit(1);
  }

  const budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
  // Nur die grossen Buendel einzeln — die kleinen traegt die Summe.
  const tracked = Object.fromEntries(
    Object.entries(measured).filter(
      ([name, bytes]) => bytes >= MIN_TRACKED_BYTES || budget.chunks?.[name] !== undefined,
    ),
  );
  const { over, stale, unbudgeted, totalOver, totalLimit } = compareToBudget(tracked, budget);
  const total = Object.values(measured).reduce((sum, bytes) => sum + bytes, 0);
  const totalExceeded = budget.totalGzipBytes !== undefined && total > budget.totalGzipBytes;

  for (const entry of unbudgeted) {
    console.log(
      `ℹ️  neues grosses Buendel ohne Budget: ${entry.name} (${formatBytes(entry.bytes)}) —` +
        ' bitte mit --update aufnehmen',
    );
  }
  for (const entry of stale) {
    console.log(
      `ℹ️  ${entry.name} liegt bei ${formatBytes(entry.bytes)} gegen ein Budget von ` +
        `${formatBytes(entry.limit)} — das Budget misst hier nichts mehr, bitte nachziehen`,
    );
  }

  void totalOver;
  if (over.length > 0 || totalExceeded) {
    console.error(`\n❌ Bundle-Budget gerissen:\n`);
    for (const entry of over) {
      console.error(
        `   ${entry.name}: ${formatBytes(entry.bytes)} gegen ${formatBytes(entry.limit)} ` +
          `(+${formatBytes(entry.bytes - entry.limit)})`,
      );
    }
    if (totalExceeded) {
      console.error(`   GESAMT: ${formatBytes(total)} gegen ${formatBytes(totalLimit)}`);
    }
    console.error(
      '\n   Entweder ist etwas unbeabsichtigt mitgewandert (dann Import prüfen —' +
        '\n   ein statischer Import zieht das ganze Modul in dieses Bündel), oder das' +
        '\n   Wachstum ist gewollt. Dann `--update` und der Grund in die Commit-Nachricht.\n',
    );
    process.exit(1);
  }

  console.log(
    `\n✅ Bundle-Budget OK (${Object.keys(measured).length} Bündel, ` +
      `${formatBytes(total)} gzip gegen ${formatBytes(totalLimit)})\n`,
  );
}

main();
