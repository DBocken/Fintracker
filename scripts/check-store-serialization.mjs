#!/usr/bin/env node

/**
 * Serialisierungs-Wächter (Issue #311)
 *
 * Meldet Funktionen, die eine lokale Collection lesen, ändern und
 * zurückschreiben, ohne den Ablauf zu serialisieren. Zwei gleichzeitige
 * Aufrufe lesen sonst denselben Stand — der zweite Schreibvorgang schreibt
 * eine Fassung ohne das Element des ersten. Lautlos: kein Fehler, kein Log,
 * und ein verlorener Datensatz hinterlässt keine Lücke, nach der jemand sucht.
 *
 * **Ohne Ausnahmeliste**, wie `check:a11y-names`. Ein begründeter Einzelfall
 * hiesse hier „an dieser Stelle darf gelegentlich eine Buchung verloren
 * gehen"; das ist kein Grund, das ist der Fehler selbst.
 *
 * Die Erkennung steht in `store-serialization-core.mjs` und ist ohne
 * Dateisystem testbar — dieselbe Aufteilung wie bei `layers-core.mjs`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  findeUnserialisierteSchreibpfade,
  istSpeicherschicht,
} from './store-serialization-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
  return output
    .trim()
    .split('\n')
    // `git ls-files` liest den INDEX; eine ungestagte Loeschung steht dort noch
    // drin und der Lesezugriff darauf wirft.
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)))
    .filter(istSpeicherschicht);
}

console.log('\n🔒 Serialisierungs-Wächter läuft (Issue #311)...\n');

const funde = [];
for (const datei of trackedFiles()) {
  const quelltext = fs.readFileSync(path.join(REPO_ROOT, datei), 'utf8');
  funde.push(...findeUnserialisierteSchreibpfade(quelltext, datei));
}

if (funde.length === 0) {
  console.log('✅ Kein unserialisiertes Lesen-Ändern-Schreiben gefunden\n');
  process.exit(0);
}

console.error(`❌ ${funde.length} Schreibpfad(e) ohne Serialisierung:\n`);
for (const fund of funde) {
  console.error(`   ${fund.datei}:${fund.zeile}  ${fund.funktion}()  [${fund.familie}]`);
  console.error(`      ${fund.hinweis}`);
}
console.error(
  '\n   Warum das zählt: zwischen Lesen und Schreiben liegt ein echtes await',
  '\n   (IndexedDB, AES-GCM). Zwei gleichzeitige Aufrufe lesen denselben Stand,',
  '\n   und der zweite überschreibt den Datensatz des ersten — ohne Fehler.\n',
);
process.exit(1);
