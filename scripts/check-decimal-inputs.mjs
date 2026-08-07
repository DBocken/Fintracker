#!/usr/bin/env node

/**
 * Dezimal-Eingabe-Wächter (AGENTS.md §8)
 *
 * `<input type="number">` ist für deutsche Dezimaleingaben unbrauchbar. Das ist
 * im echten Browser gemessen (Chromium, Locale `de-DE`):
 *
 *   getippt „12,50"    -> .value "1250"     — Faktor 100 zu viel
 *   getippt „1.200"    -> .value "1.200"    — parseFloat liest 1,2
 *   getippt „1.234,56" -> .value "1.23456"
 *   Zinssatz „5,5" %   -> gespeichert 55 %
 *
 * Der Browser verstümmelt die Eingabe, BEVOR irgendein Parser sie sieht. Genau
 * daran ist ein früherer Anlauf vorbeigegangen: Dort wurde `parseFloat` durch
 * `parseGermanNumber` ersetzt — das behebt den Tausenderpunkt, aber nicht das
 * Komma, weil das Feld es schon geschluckt hatte. Deshalb prüft dieser Wächter
 * das FELD und nicht den Parser.
 *
 * Ersatz: `<DecimalInput>` aus `@/components/common/DecimalInput` — es gibt
 * eine Zahl nach außen, keinen Text, damit die Aufrufstelle gar nicht erst
 * falsch parsen kann.
 *
 * Ganzzahlige Felder (Tag im Monat, Anzahl, Jahr) sind mit `type="number"`
 * richtig und werden nicht gemeldet.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findNumberInputs } from './decimal-input-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'decimal-input-allowlist.json');

function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((rel) => rel.endsWith('.tsx'))
    .map((rel) => path.join(dir, rel))
    .filter((abs) => {
      try {
        return fs.statSync(abs).isFile();
      } catch {
        return false;
      }
    });
}

/**
 * Zwei Formen, wie bei `query-error-allowlist.json`:
 *
 * - eine blosse **Zahl** ist offenes Backlog und darf nur SINKEN. Sie
 *   bedeutet nicht „in Ordnung", sondern „bekannt und noch nicht behoben".
 * - ein Objekt **`{ count, reason }`** ist entschieden — dort ist
 *   `type="number"` die richtige Antwort, weil das Feld ganzzahlig ist.
 */
function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return {};
  const roh = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')).files ?? {};
  const entries = {};
  for (const [file, entry] of Object.entries(roh)) {
    if (typeof entry === 'number') {
      entries[file] = { count: entry, backlog: true };
      continue;
    }
    if (typeof entry?.count !== 'number' || !entry?.reason) {
      console.error(`❌ decimal-input-allowlist.json: ${file} braucht entweder eine Zahl (offenes Backlog) oder \`{ count, reason }\` (entschieden).`);
      process.exit(1);
    }
    entries[file] = entry;
  }
  return entries;
}

const allowlist = loadAllowlist();
const files = sourceFiles(SRC_DIR)
  .map((abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/'))
  .filter((rel) => !rel.includes('__tests__/') && !/\.(test|spec)\.tsx$/.test(rel))
  .sort();

console.log(`\n🔢 Dezimal-Eingabe-Check läuft (${files.length} .tsx-Dateien unter src/)...\n`);

const offen = [];
const gedeckt = [];

for (const rel of files) {
  const funde = findNumberInputs(rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
  if (funde.length === 0) continue;

  const erlaubt = allowlist[rel]?.count ?? 0;
  if (funde.length <= erlaubt) {
    gedeckt.push({ rel, gefunden: funde.length, erlaubt });
  } else {
    offen.push({ rel, funde, erlaubt });
  }
}

if (offen.length > 0) {
  console.error(`❌ ${offen.length} Datei(en) mit \`type="number"\` auf einem Dezimalfeld:\n`);
  for (const { rel, funde, erlaubt } of offen) {
    const neu = funde.length - erlaubt;
    console.error(`   ${rel}: ${neu} Feld(er) zu viel (${funde.length} gefunden, ${erlaubt} erlaubt)`);
    funde.forEach((f) => console.error(`      Zeile ${f.line} — erkannt an „${f.hint}"`));
  }
  console.error(`
   Ein \`type="number"\`-Feld verstümmelt deutsche Dezimaleingaben, BEVOR
   irgendein Parser sie sieht: „12,50" wird zu 1250, „5,5 %" zu 55 %.
   Ersatz: <DecimalInput> aus @/components/common/DecimalInput — es gibt eine
   ZAHL nach außen, keinen Text, damit die Aufrufstelle nicht falsch parsen kann.

   Ist das Feld ganzzahlig (Tag, Anzahl, Jahr), gehört es mit Begründung in
   decimal-input-allowlist.json — die Zahlen dort dürfen nur sinken.
`);
}

const veraltet = Object.entries(allowlist).filter(([file, entry]) => {
  const eintrag = gedeckt.find((g) => g.rel === file) ?? offen.find((o) => o.rel === file);
  return !eintrag || (eintrag.gefunden ?? eintrag.funde?.length ?? 0) < entry.count;
});

if (veraltet.length > 0) {
  console.warn('⚠️  Veraltete Einträge in decimal-input-allowlist.json (bitte nachziehen):');
  veraltet.forEach(([file, entry]) => console.warn(`   • ${file}: erlaubt ${entry.count}, gefunden weniger`));
  console.warn('');
}

if (offen.length > 0) {
  process.exit(1);
}

const backlog = gedeckt
  .filter((g) => allowlist[g.rel]?.backlog)
  .reduce((acc, g) => acc + g.gefunden, 0);
const entschieden = gedeckt.reduce((acc, g) => acc + g.gefunden, 0) - backlog;
console.log(
  `✅ Dezimal-Eingaben OK (${entschieden} begruendet ausgenommen, ${backlog} im offenen Backlog — die Zahl darf nur sinken)\n`,
);
process.exit(0);
