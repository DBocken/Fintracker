#!/usr/bin/env node

/**
 * Sanfter-Modus-Wächter (Issue #296)
 *
 * Meldet gerenderte Geldbeträge, die den Sanften Modus umgehen: ein
 * `<formatierer>.format(betrag)` aus einem lokal gebauten Währungs-`Intl`,
 * dessen Ergebnis nicht durch `mask()` läuft.
 *
 * Der Sanfte Modus ist ein Barrierefreiheits-Versprechen
 * (`docs/debt-avoidance-recovery.md`): Wer ihn einschaltet, tut das, um nicht
 * mit Zahlen konfrontiert zu werden. Ein einziger unmaskierter Betrag auf
 * derselben Fläche hebt das auf.
 *
 * **Ohne Ausnahmeliste.** Ein begründeter Einzelfall hiesse „diesen Betrag
 * bekommt der Nutzer trotzdem zu sehen" — das ist der Fehler, kein Grund.
 *
 * Die Erkennung steht in `money-format-core.mjs` und ist ohne Dateisystem
 * testbar — dieselbe Aufteilung wie bei `layers-core.mjs`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  findeExportierteFormatierer,
  findeUnmaskierteBetraege,
  istRenderschicht,
} from './money-format-core.mjs';
import { resolveTarget } from './layers-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function alleQuellen() {
  const output = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
  return output
    .trim()
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => fs.existsSync(path.join(REPO_ROOT, f)));
}

const lies = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/**
 * Modulpfad (ohne Endung) -> exportierte Währungsformatierer.
 *
 * Erster Durchgang über den ganzen Baum, damit ein aus `chart-shared.ts`
 * importiertes `eur` an seiner Verwendungsstelle geprüft werden kann.
 */
function exportierteFormatiererJeModul(dateien) {
  const karte = new Map();
  for (const datei of dateien) {
    const namen = findeExportierteFormatierer(lies(datei), datei);
    if (namen.size > 0) karte.set(datei.replace(/\.tsx?$/, ''), namen);
  }
  return karte;
}

/** Namen, unter denen `datei` fremde Währungsformatierer importiert. */
function importierteFormatierer(datei, quelltext, karte) {
  const namen = new Set();
  const importe = quelltext.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g);
  for (const [, spezifizierer, spec] of importe) {
    const ziel = resolveTarget(spec, datei);
    const exportiert = ziel && karte.get(ziel.replace(/\.tsx?$/, ''));
    if (!exportiert) continue;
    for (const teil of spezifizierer.split(',')) {
      const [quelle, alias] = teil.split(/\s+as\s+/).map((x) => x.trim());
      if (exportiert.has(quelle)) namen.add(alias || quelle);
    }
  }
  return namen;
}

console.log('\n🫥 Sanfter-Modus-Wächter läuft (Issue #296)...\n');

const dateien = alleQuellen();
const karte = exportierteFormatiererJeModul(dateien);

const funde = [];
for (const datei of dateien.filter(istRenderschicht)) {
  const quelltext = lies(datei);
  funde.push(
    ...findeUnmaskierteBetraege(quelltext, datei, importierteFormatierer(datei, quelltext, karte)),
  );
}

if (funde.length === 0) {
  console.log('✅ Kein unmaskierter Geldbetrag in der Renderschicht\n');
  process.exit(0);
}

const betroffen = new Set(funde.map((f) => f.datei));
console.error(`❌ ${funde.length} unmaskierte(r) Betrag/Beträge in ${betroffen.size} Datei(en):\n`);
for (const fund of funde) {
  console.error(`   ${fund.datei}:${fund.zeile}  ${fund.formatierer}.format(…)`);
}
console.error(
  '\n   Ersatz: useMoneyFormat().format(betrag) — oder money.mask(fmt.format(betrag)),',
  '\n   wenn der eigene Formatierer bleiben soll (Recharts-Ticks, abweichende Stellen).',
  '\n   Der Sanfte Modus ist ein Versprechen an Menschen, die ihre Zahlen nicht',
  '\n   sehen wollen; ein einziger unmaskierter Betrag hebt es auf.\n',
);
process.exit(1);
