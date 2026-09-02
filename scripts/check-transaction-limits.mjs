#!/usr/bin/env node

/**
 * Wächter gegen stille Buchungs-Kappungen (Audit 2026-09, F2)
 *
 * Meldet ein numerisches Literal als Limit von `getTransactions(`. Ersatz ist
 * `getAllTransactions()` für Auswertungen und `getTransactionsPage(limit,
 * offset)` für echte Seiten — dort IST das Limit die Aussage, statt ein
 * geratener Deckel zu sein, der die Summe verfälscht.
 *
 * **Ohne Ausnahmeliste**, wie `check:a11y-names`: Ein Eintrag hiesse „an
 * dieser Stelle darf die Summe falsch sein".
 *
 * Erkennung in `transaction-limits-core.mjs`, ohne Dateisystem testbar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findeKappungen, istGeprueft } from './transaction-limits-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
  return output
    .trim()
    .split('\n')
    // `git ls-files` liest den INDEX; eine ungestagte Löschung steht dort noch
    // drin und der Lesezugriff darauf wirft.
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
    .filter(istGeprueft);
}

console.log('\n📏 Kappungs-Wächter für Buchungen läuft (Audit 2026-09, F2)...\n');

const dateien = trackedFiles();
const funde = [];
for (const datei of dateien) {
  const quelltext = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
  funde.push(...findeKappungen(quelltext, datei));
}

if (funde.length === 0) {
  console.log(`✅ Kein Limit-Literal auf Buchungen (${dateien.length} Dateien geprüft)\n`);
  process.exit(0);
}

console.error(`❌ ${funde.length} stille Kappung(en):\n`);
for (const fund of funde) {
  console.error(`   ${fund.datei}:${fund.zeile}  getTransactions(${fund.limit})`);
}
console.error(
  '\n   Warum das zählt: die Liste ist datum-absteigend sortiert und wird',
  '\n   abgeschnitten. Ein Ausschnitt sieht aus wie ein Bestand — die',
  '\n   Auswertung rechnet weiter, nur mit der falschen Menge.',
  '\n   Ersatz: getAllTransactions() bzw. getTransactionsPage(limit, offset).\n',
);
process.exit(1);
