#!/usr/bin/env node

/**
 * i18n Compliance Check (AGENTS.md §6)
 *
 * Prüft, dass kein sichtbarer UI-Text hardcodiert im Quelltext steht. Läuft in
 * Pre-Commit und CI und bindet damit auch Agenten ohne `.claude`-Hooks.
 *
 * Die Erkennung selbst steht in `i18n-core.mjs` und ist dort ohne Dateisystem
 * und ohne git testbar — dieselbe Aufteilung wie bei `layers-core.mjs`.
 *
 * **Ein Erkennungsweg, zwei Sichtfenster.** Der Kern sieht immer die ganze
 * Datei; der Modus entscheidet nur, WELCHE Fundstellen gemeldet werden. Die
 * frühere Fassung hatte dafür zwei Wege (echter Diff vs. Pseudo-Diff aus dem
 * Dateiinhalt) — zwei Wege driften auseinander, und dann melden die Modi
 * Verschiedenes.
 *
 *   --staged (Default)       nur Fundstellen auf gestagten Zeilen
 *   --range <base>...<head>  nur Fundstellen auf geänderten Zeilen des Ranges
 *   --all                    der ganze Bestand
 *
 * Der Diff-Modus kann Altbestand strukturell NIE sehen. Genau daran sind in
 * Phase 9 zwei Verstöße vorbeigelaufen — deshalb läuft `--all` in CI mit.
 *
 * Die Key-Symmetrie über alle `SUPPORTED_LOCALES` prüft NICHT dieses Script,
 * sondern `src/i18n/__tests__/locale-parity.test.ts` — vollständiger
 * Blatt-Vergleich statt Heuristik und unabhängig vom Diff.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findHardcodedStrings } from './i18n-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'i18n-allowlist.json');

function parseArgs(argv) {
  let mode = 'staged';
  let range = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--staged') {
      mode = 'staged';
    } else if (arg === '--all') {
      mode = 'all';
    } else if (arg === '--range') {
      mode = 'range';
      range = argv[i + 1];
      i++;
    } else if (arg.startsWith('--range=')) {
      mode = 'range';
      range = arg.slice('--range='.length);
    } else {
      console.error(`❌ Unbekanntes Argument: ${arg}`);
      console.error('Nutzung: check-i18n.mjs [--staged | --all | --range <base>...<head>]');
      process.exit(2);
    }
  }

  if (mode === 'range' && !range) {
    console.error('❌ --range benötigt ein Argument, z. B. --range origin/main...HEAD');
    process.exit(2);
  }

  return { mode, range };
}

const { mode, range } = parseArgs(process.argv.slice(2));

/**
 * Ausnahmeliste, zwei Formen — wie bei `query-error-allowlist.json`:
 *
 * - eine blosse **Zahl** ist offenes Backlog und darf nur SINKEN. Sie bedeutet
 *   nicht „in Ordnung", sondern „bekannt und noch nicht übersetzt".
 * - ein Objekt **`{ count, reason }`** ist entschieden — dort ist deutscher
 *   Text im Quelltext die richtige Antwort (Fachbegriff der deutschen
 *   Rechtslage, Spaltenname eines Bankformats, …).
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
      console.error(
        `❌ i18n-allowlist.json: ${file} braucht entweder eine Zahl (offenes Backlog) oder \`{ count, reason }\` (entschieden).`,
      );
      process.exit(1);
    }
    entries[file] = entry;
  }
  return entries;
}

function trackedSourceFiles() {
  const output = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
  return output
    .trim()
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f))
    // `git ls-files` liest den INDEX. Eine ungestagte Löschung steht dort noch
    // drin, und der Lesezugriff darauf wirft — derselbe Fehler hat schon drei
    // Wächter an einem teilweise gestagten Commit sterben lassen.
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)));
}

function changedFiles() {
  const args =
    mode === 'range'
      ? ['diff', range, '--name-only', '--diff-filter=ACM']
      : ['diff', '--cached', '--name-only', '--diff-filter=ACM'];
  try {
    const output = execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT });
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)));
  } catch (e) {
    if (mode === 'range') {
      console.error(`❌ Ungültiger Range "${range}": ${e.message}`);
      process.exit(2);
    }
    return [];
  }
}

/** Zeilennummern (1-basiert), die der Diff dieser Datei hinzugefügt hat. */
function addedLineNumbers(file) {
  const args =
    mode === 'range' ? ['diff', range, '-U0', '--', file] : ['diff', '--cached', '-U0', '--', file];
  const nummern = new Set();
  let output = '';
  try {
    output = execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT });
  } catch {
    return nummern;
  }

  let lineNum = 0;
  for (const line of output.split('\n')) {
    if (line.startsWith('@@')) {
      lineNum = Number(line.match(/\+(\d+)/)?.[1] ?? 0) - 1;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      nummern.add(lineNum);
    }
  }
  return nummern;
}

console.log('\n🌍 i18n Compliance Check läuft...\n');
console.log(`   Modus: --${mode}${mode === 'range' ? ` ${range}` : ''}\n`);

const allowlist = loadAllowlist();
const files = mode === 'all' ? trackedSourceFiles() : changedFiles();

const offen = [];
const gedeckt = [];

for (const file of files) {
  let source;
  try {
    source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
  } catch {
    continue;
  }

  let funde = findHardcodedStrings(file, source);
  if (funde.length === 0) continue;

  // Im Diff-Modus zählt nur, was diese Änderung angefasst hat. Der Bestand
  // gehört in `--all`, nicht in den Commit von jemandem, der nebenan etwas
  // anderes repariert hat.
  if (mode !== 'all') {
    const fundeGesamt = funde.length;
    const geaendert = addedLineNumbers(file);
    funde = funde.filter((f) => geaendert.has(f.line));
    if (funde.length === 0) continue;
    // Neue Verstöße sind blockierend — die Ausnahmeliste deckt den Bestand,
    // nicht den Nachschub. „Bestand" ist dabei eine NETTO-Frage, keine
    // Zeilen-Frage: Eine VERSCHOBENE Datei (WP 6.6 zog die historischen
    // Seed-Strings nach lib/category-migrations.ts) besteht im Diff
    // ausschließlich aus neuen Zeilen, ihr Bestand ist aber derselbe. Der
    // alte Zeilen-Maßstab hätte genau die Migration blockiert, deren
    // Allowlist-Eintrag im selben Commit korrekt mitgezogen wurde — dieselbe
    // Fehlerform wie die Slice-Ratsche vor WP 6.2/6.3.
    // Gedeckt ist eine Änderung deshalb genau dann, wenn die GESAMTZAHL der
    // Datei ihren Allowlist-Stand nicht übersteigt: Wer zusätzlich zum
    // verschobenen Bestand auch nur einen String NEU einführt, liegt über
    // dem Stand und bleibt blockiert. Dateien ohne Eintrag bleiben es sowieso.
    const eintrag = allowlist[file];
    if (eintrag && fundeGesamt <= eintrag.count) {
      gedeckt.push({ file, gefunden: funde.length, erlaubt: eintrag.count });
      continue;
    }
    offen.push({ file, funde, erlaubt: 0 });
    continue;
  }

  const erlaubt = allowlist[file]?.count ?? 0;
  if (funde.length <= erlaubt) {
    gedeckt.push({ file, gefunden: funde.length, erlaubt });
  } else {
    offen.push({ file, funde, erlaubt });
  }
}

if (offen.length > 0) {
  console.error(`❌ ${offen.length} Datei(en) mit hardcodiertem UI-Text:\n`);
  for (const { file, funde, erlaubt } of offen) {
    const neu = funde.length - erlaubt;
    console.error(`   ${file}: ${neu} Fundstelle(n) zu viel (${funde.length} gefunden, ${erlaubt} erlaubt)`);
    funde.slice(0, 12).forEach((f) => {
      console.error(`      Zeile ${f.line} [${f.kind}/${f.sprache}] „${f.keyword}"`);
      console.error(`         ${f.snippet}`);
    });
    if (funde.length > 12) console.error(`      … und ${funde.length - 12} weitere`);
  }
  console.error(`
   Jeder sichtbare String läuft über i18n (AGENTS.md §6):
     const { t } = useI18n();
     <h1>{t('myFeature.title')}</h1>

   In Modulen ohne React-Kontext (src/services/, src/lib/) stattdessen
   \`serviceT\` aus src/i18n/serviceT.ts.

   Keys in ALLE SUPPORTED_LOCALES eintragen (de, en, ru) — geprüft von
   src/i18n/__tests__/locale-parity.test.ts.

   Ist der deutsche Wortlaut die Sache selbst (Gesetzesfundstelle, Spaltenname
   eines Bankformats), gehört die Datei mit Begründung in i18n-allowlist.json.
`);
}

if (mode === 'all') {
  const veraltet = Object.entries(allowlist).filter(([file, entry]) => {
    const eintrag = gedeckt.find((g) => g.file === file) ?? offen.find((o) => o.file === file);
    return !eintrag || (eintrag.gefunden ?? eintrag.funde?.length ?? 0) < entry.count;
  });
  if (veraltet.length > 0) {
    console.warn('⚠️  Veraltete Einträge in i18n-allowlist.json (bitte nachziehen):');
    veraltet.forEach(([file, entry]) => console.warn(`   • ${file}: erlaubt ${entry.count}, gefunden weniger`));
    console.warn('');
  }
}

if (offen.length > 0) {
  process.exit(1);
}

if (mode === 'all') {
  const backlog = gedeckt
    .filter((g) => allowlist[g.file]?.backlog)
    .reduce((acc, g) => acc + g.gefunden, 0);
  const entschieden = gedeckt.reduce((acc, g) => acc + g.gefunden, 0) - backlog;
  console.log(
    `✅ i18n Compliance OK (${entschieden} begruendet ausgenommen, ${backlog} im offenen Backlog — die Zahl darf nur sinken)\n`,
  );
} else {
  console.log('✅ i18n Compliance OK\n');
}
process.exit(0);
