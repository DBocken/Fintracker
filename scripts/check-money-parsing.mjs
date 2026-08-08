#!/usr/bin/env node

/**
 * Geld-Parsing-Wächter (`docs/coding-guide.md` §6/§8, GOV-1 / WP 2.2)
 *
 * Zwei Verbote aus `docs/coding-guide.md`, die im Baum trotzdem vorkamen —
 * i18n hat drei Erkennungsformen (siehe `check-i18n.mjs`), diese Regel hatte
 * bis hierhin NULL:
 *
 * 1. Roh-`parseFloat`/`Number.parseFloat` mit `replace(',', '.')` für einen
 *    getippten Geldbetrag. `AskYourMoney.tsx` tat genau das — deutsches
 *    Format nutzt den Punkt als TAUSENDERTRENNER, getipptes „1.200" wurde
 *    damit lautlos zu 1,2. Ersatz: `parseGermanNumber`/`parseEuroInput`
 *    (`src/lib/money.ts`) — der einzige gemeinsame Parser, der den
 *    Tausenderpunkt kennt.
 * 2. `as unknown as` unter `src/` (außer Tests) — hebelt TypeScript
 *    vollständig aus und prüft zur Laufzeit nichts. `BankCallbackPage.tsx`
 *    ließ damit fremde GoCardless-Bankdaten ungeprüft bis in den
 *    React-State durch, obwohl `parseAtBoundary`/`safeParseAtBoundary`
 *    (`src/lib/schemas/boundary.ts`) genau dafür existiert.
 *
 * Ob eine konkrete `as unknown as`-Fundstelle eine echte Datengrenze ist, ist
 * NICHT maschinell entscheidbar — der Wächter meldet daher JEDE Fundstelle
 * unter `src/` (außer Tests); legitime Typ-Interop-Fälle gehören mit
 * Begründung in die Allowlist, wie bei den Nachbar-Wächtern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMoneyParsingViolations } from './money-parsing-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'money-parsing-allowlist.json');

function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((rel) => rel.endsWith('.ts') || rel.endsWith('.tsx'))
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
 * Zwei Formen, semantisch wortgleich zu `decimal-input-allowlist.json`:
 *
 * - eine blosse **Zahl** ist offenes Backlog und darf nur SINKEN. Sie
 *   bedeutet nicht „in Ordnung", sondern „bekannt und noch nicht behoben".
 * - ein Objekt **`{ count, reason }`** ist entschieden — dort ist die
 *   Fundstelle begründet keine Datengrenze bzw. kein Nutzer-Geldbetrag.
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
      console.error(`❌ money-parsing-allowlist.json: ${file} braucht entweder eine Zahl (offenes Backlog) oder \`{ count, reason }\` (entschieden).`);
      process.exit(1);
    }
    entries[file] = entry;
  }
  return entries;
}

const allowlist = loadAllowlist();
const files = sourceFiles(SRC_DIR)
  .map((abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/'))
  .filter((rel) => !rel.includes('__tests__/') && !/\.(test|spec)\.[tj]sx?$/.test(rel) && !rel.startsWith('src/test-utils/'))
  .sort();

console.log(`\n💶 Geld-Parsing-Check läuft (${files.length} .ts/.tsx-Dateien unter src/)...\n`);

const offen = [];
const gedeckt = [];

for (const rel of files) {
  const funde = findMoneyParsingViolations(rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
  if (funde.length === 0) continue;

  const erlaubt = allowlist[rel]?.count ?? 0;
  if (funde.length <= erlaubt) {
    gedeckt.push({ rel, gefunden: funde.length, erlaubt });
  } else {
    offen.push({ rel, funde, erlaubt });
  }
}

if (offen.length > 0) {
  console.error(`❌ ${offen.length} Datei(en) mit verbotenem Geld-Parsing:\n`);
  for (const { rel, funde, erlaubt } of offen) {
    const neu = funde.length - erlaubt;
    console.error(`   ${rel}: ${neu} Fundstelle(n) zu viel (${funde.length} gefunden, ${erlaubt} erlaubt)`);
    funde.forEach((f) => console.error(`      Zeile ${f.line} — „${f.hint}"`));
  }
  console.error(`
   Roh-\`parseFloat\`/\`Number.parseFloat\` mit \`replace(',', '.')\` verstümmelt
   einen deutschen Geldbetrag: „1.200" (Tausenderpunkt) wird zu 1,2. Ersatz:
   \`parseGermanNumber\`/\`parseEuroInput\` aus @/lib/money.

   \`as unknown as\` hebelt TypeScript an einer Datengrenze vollständig aus und
   prüft zur Laufzeit nichts. Ersatz: \`parseAtBoundary\`/\`safeParseAtBoundary\`
   mit einem zod-Schema aus @/lib/schemas.

   Ist die Fundstelle begründet keine Datengrenze (reiner Typ-Interop, kein
   Nutzer-Geldbetrag), gehört sie mit Begründung in
   money-parsing-allowlist.json — die Zahlen dort dürfen nur sinken.
`);
}

const veraltet = Object.entries(allowlist).filter(([file, entry]) => {
  const eintrag = gedeckt.find((g) => g.rel === file) ?? offen.find((o) => o.rel === file);
  return !eintrag || (eintrag.gefunden ?? eintrag.funde?.length ?? 0) < entry.count;
});

if (veraltet.length > 0) {
  console.warn('⚠️  Veraltete Einträge in money-parsing-allowlist.json (bitte nachziehen):');
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
  `✅ Geld-Parsing OK (${entschieden} begruendet ausgenommen, ${backlog} im offenen Backlog — die Zahl darf nur sinken)\n`,
);
process.exit(0);
