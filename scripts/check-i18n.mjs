#!/usr/bin/env node

/**
 * i18n Compliance Check
 *
 * Agentenunabhängige Fassung des früheren PostToolUse-Hooks i18n-compliance.mjs
 * (der lief gegen `git diff --cached`, sah im PostToolUse-Kontext aber nie
 * etwas Gestagtes und war damit wirkungslos — deshalb entfernt).
 * Dieses Script läuft als `pnpm check:i18n` — lokal per Pre-Commit-Hook und
 * in CI gegen den PR-Diff — und bindet damit auch Agenten ohne .claude-Hooks
 * (z. B. Codex) an dieselbe Regel.
 *
 * Überprüft, dass keine neuen hardcodierten deutschen/englischen Strings in JSX
 * auftauchen.
 *
 * Die Key-Symmetrie über alle `SUPPORTED_LOCALES` prüft NICHT mehr dieses
 * Script, sondern `src/i18n/__tests__/locale-parity.test.ts` — vollständiger
 * Blatt-Vergleich statt Heuristik und unabhängig vom Diff.
 *
 * Diff-Quelle (Kernlogik selbst UNVERÄNDERT gegenüber dem alten Hook):
 *   --staged (Default)       git diff --cached …
 *   --range <base>...<head>  git diff <base>...<head> …
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

// import.meta.url ist eine file://-URL, kein Pfad → erst fileURLToPath,
// sonst zeigt REPO_ROOT auf ein nicht existierendes Verzeichnis.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Deutsche Woerter, die in diesem Projekt TYPWERTE sind und keine Texte.
 *
 * `Cycle` (src/components/contracts/contract-types.ts) und `DashboardRange`
 * (src/features/dashboard/domain/overview-types.ts) sind auf Deutsch benannt.
 * Ob das eine gute Entscheidung war, ist eine andere Frage — sie ist getroffen,
 * die Werte stehen in persistierten Daten, und an den Raendern wird gemappt.
 * Diese Liste haelt den Waechter davon ab, sie als Verstoesse zu melden.
 */
const DOMAIN_VALUE_TERMS = [
  'Woechentlich',
  'Wöchentlich',
  'Monatlich',
  'Vierteljährlich',
  'Halbjährlich',
  'Jährlich',
  'Unbekannt',
  "'Jahr'",
  "'Quartal'",
  "'Monat'",
  "'Gesamt'",
  "'Benutzerdefiniert'",
];

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

// Liste deutscher Wörter, die verdächtig sind (Heuristik)
const GERMAN_KEYWORDS = [
  'Willkommen', 'Fehler', 'Speichern', 'Abbrechen', 'Zurück', 'Weiter',
  'Löschen', 'Bearbeiten', 'Hinzufügen', 'Keine', 'Daten', 'nicht',
  'Schulden', 'Kategorie', 'Transaktion', 'Monat', 'Jahr', 'Heute',
  'Morgen', 'Gestern', 'Überschrift', 'Beschreibung', 'Titel',
];

const ENGLISH_KEYWORDS = [
  'Welcome', 'Error', 'Save', 'Cancel', 'Back', 'Next',
  'Delete', 'Edit', 'Add', 'No', 'Data', 'not',
  'Debt', 'Category', 'Transaction', 'Month', 'Year', 'Today',
  'Tomorrow', 'Yesterday', 'Heading', 'Description', 'Title',
];

function getChangedFiles() {
  // `--all` prueft den BESTAND, nicht den Diff. Das ist der Modus, der bis
  // WP-10.1 fehlte: Der Waechter konnte Altlasten strukturell nie sehen, und
  // genau deshalb sind in Phase 9 zweimal hartcodierte Strings erst aufgefallen,
  // als jemand die Datei aus anderem Grund anfasste.
  if (mode === 'all') {
    const output = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
    return output
      .trim()
      .split('\n')
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  }

  const args =
    mode === 'range'
      ? ['diff', range, '--name-only', '--diff-filter=ACM']
      : ['diff', '--cached', '--name-only', '--diff-filter=ACM'];

  try {
    const output = execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    if (mode === 'range') {
      console.error(`❌ Ungültiger Range "${range}": ${e.message}`);
      process.exit(2);
    }
    return [];
  }
}

function getChangedLines(file) {
  // Im Bestandsmodus wird die ganze Datei als Pseudo-Diff gereicht (jede Zeile
  // mit '+'). Bewusst so: Eine zweite Erkennungs-Implementierung wuerde von der
  // diff-basierten abdriften, und dann meldeten die beiden Modi Verschiedenes.
  if (mode === 'all') {
    try {
      const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      return `@@ -0,0 +1 @@\n${content.split('\n').map((line) => `+${line}`).join('\n')}`;
    } catch {
      return '';
    }
  }

  const args =
    mode === 'range' ? ['diff', range, '-U0', '--', file] : ['diff', '--cached', '-U0', '--', file];

  try {
    // Argument-Array + '--': Dateiname kann weder Shell-Kommando noch git-Option injizieren
    const output = execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT });
    return output;
  } catch (e) {
    return '';
  }
}

function checkHardcodedStrings(file, diff) {
  const issues = [];

  // Überspringe bestimmte Dateitypen.
  //
  // `src/i18n/` komplett: das IST die Übersetzungsschicht. Neben
  // `translations.ts` liegen dort die Sprachstil-Overlays
  // (`overlays/everyday/*.ts`), die naturgemäß aus nichts als übersetzten
  // Strings bestehen — ein Treffer dort ist per Definition ein Fehlalarm.
  if (file.includes('.test.') || file.includes('.spec.') ||
      file.includes('src/i18n/') || file.includes('constants') ||
      file.includes('README') || file.includes('.md')) {
    return issues;
  }

  // `tax-catalog.ts` fuehrt die gesetzlichen Fundstellen des DEUTSCHEN
  // Steuerrechts („§9a S. 1 Nr. 1 Buchst. a EStG", „1.230 EUR seit VZ 2023").
  // Das ist die Sache selbst und nicht ihre Uebersetzung — eine russische
  // Fassung von §9a EStG gibt es nicht.
  if (file.includes('src/data/tax-catalog')) {
    return issues;
  }

  // Nur TS/TSX Dateien prüfen
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return issues;
  }

  // Finde neue Strings in JSX (einfache Heuristik: Quoted strings in < >)
  const lines = diff.split('\n');
  let lineNum = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith('@@')) {
      // Neue Zeile nach diff hunk
      lineNum = parseInt(line.match(/\+(\d+)/)?.[1] || 0);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      const content = line.substring(1); // Entferne '+' Prefix

      // Überspringe Kommentare — auch Fortsetzungszeilen eines Blockkommentars
      // (`* …`), die sonst jeden erklärenden Text als Verstoß meldeten.
      const trimmed = content.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // Kein sichtbarer Text, sondern INTERNE BEZEICHNER. Diese Fälle haben den
      // Bestandsmodus (WP-10.1) zunächst unbrauchbar gemacht: 26 gemeldete
      // Dateien, davon rund drei Viertel Fehlalarme. Eine Regel mit so vielen
      // Fehlalarmen wird abgeschaltet, also wird sie hier geschärft.
      //
      // - Vergleiche und `case`: `range === 'Jahr'`, `case "Monatlich":` — der
      //   deutsche Wortlaut ist ein Typwert, kein Text für den Bildschirm. An
      //   den Rändern (URL, Persistenz) wird er gemappt.
      // - `labelKey`/`shortLabelKey` in derselben Zeile: das ist das
      //   Fallback-Muster `{ label: "Schulden", labelKey: "nav.items.debts" }`
      //   — der Schlüssel gewinnt, der Text ist nur die Notfassung.
      // - Speicher-Schlüssel und `console.*`: nie sichtbar.
      // Der Schluessel steht oft in der NAECHSTEN Zeile, nicht derselben:
      //   { id: "daten",
      //     label: "Daten & Konten",
      //     labelKey: "nav.groups.daten", … }
      // Ohne diesen Blick nach vorn meldet der Waechter das Fallback-Muster,
      // das genau richtig ist.
      const neighbourhood = `${trimmed}\n${(lines[index + 1] ?? '').trim()}`;

      if (
        /===|!==|\.includes\(|^case\s|switch\s*\(/.test(trimmed) ||
        /\blabelKey\b|\bshortLabelKey\b|\bdescriptionKey\b/.test(neighbourhood) ||
        /\bconsole\.|STORAGE_KEY|_KEY\s*=|queryKey/.test(trimmed) ||
        // CSV-Spaltenzuordnungen: `categoryColumn: 'Kategorie'` benennt die
        // Spaltenueberschrift eines deutschen Bank-Exports. Das ist ein
        // Datenformat, kein Bildschirmtext — uebersetzt braeche der Import.
        /\w+Column\s*[:?]/.test(trimmed) ||
        // Bindestrich-Tokens ohne Leerzeichen sind Bezeichner, keine Prosa:
        // `status: 'not-found'`, `variant: 'no-data'`. Ein Bildschirmtext
        // besteht aus Woertern mit Abstand dazwischen.
        /['"][a-z]+(-[a-z]+)+['"]/.test(trimmed)
      ) {
        continue;
      }

      // Überspringe t() Calls (bereits i18n)
      if (content.includes("t(") || content.includes("t (")) {
        continue;
      }

      // Überspringe Import/Type-Definitionen
      if (content.includes('import') || content.includes('type ') || content.includes('interface ')) {
        continue;
      }

      // Domänen-Vokabular dieses Projekts: `Cycle` und `DashboardRange` haben
      // deutsche TYPWERTE ("Monatlich", "Jahr"). Sie sind interne Bezeichner,
      // keine Bildschirmtexte — an den Rändern werden sie gemappt
      // (`RANGE_TO_TOKEN` für die URL, `mapCycleToRhythmus` vor dem Speichern).
      //
      // Ausgenommen wird NUR ausserhalb von JSX: Ein `<span>Monatlich</span>`
      // wäre sehr wohl ein Verstoss, und diese Ausnahme darf ihn nicht decken.
      // Bewusst auf TAGS geprueft und nicht auf `<`/`>`: Vergleiche (`>= 25`)
      // und Pfeilfunktionen (`=>`) enthalten diese Zeichen ebenfalls, und eine
      // Erkennung darauf haette die Ausnahme wirkungslos gemacht.
      //
      // Nur `.tsx` kann JSX enthalten. Ohne diese Bedingung hielt der Waechter
      // jede TypeScript-Generic fuer ein Tag — `ReadonlySet<DashboardRange>`
      // faengt der Regex genauso wie `<span>`. Damit war die Ausnahme in
      // `.ts`-Dateien praktisch abgeschaltet und meldete Typwerte als Text.
      const looksLikeJsx = file.endsWith('.tsx') && /<\/?[A-Za-z]/.test(trimmed);
      if (!looksLikeJsx && DOMAIN_VALUE_TERMS.some((term) => trimmed.includes(term))) {
        continue;
      }

      // Prüfe auf verdächtige deutsche Strings
      for (const keyword of GERMAN_KEYWORDS) {
        if (content.includes(`"${keyword}`) || content.includes(`'${keyword}`)) {
          if (!content.includes('t(')) {
            issues.push({
              file,
              lineNum,
              type: 'HARDCODED_DE',
              snippet: content.trim(),
              keyword,
            });
          }
        }
      }

      // Prüfe auf verdächtige englische Strings (nur bei TSX mit deutschem Kontext)
      if (file.includes('components/')) {
        for (const keyword of ENGLISH_KEYWORDS) {
          if (content.includes(`"${keyword}`) || content.includes(`'${keyword}`)) {
            if (!content.includes('t(')) {
              issues.push({
                file,
                lineNum,
                type: 'HARDCODED_EN',
                snippet: content.trim(),
                keyword,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

// Die frühere Klammer-Ebenen-Heuristik stand hier. Sie ist ersatzlos entfernt,
// weil sie nie auslösen konnte: ihr Regex (`^\s*<locale>:\s*\{[\s\S]*?\n\s*\},`)
// stoppte am ERSTEN `},` und erfasste damit für jede Sprache dieselben ~24
// Zeilen des `onboarding`-Namespace — der Vergleich war unconditional gleich.
// Zusätzlich war sie diff-basiert und sah Altbestand grundsätzlich nie.
//
// Die Key-Symmetrie prüft jetzt `src/i18n/__tests__/locale-parity.test.ts` mit
// einem vollständigen rekursiven Blatt-Vergleich über alle `SUPPORTED_LOCALES`
// — nicht diff-basiert und damit auch für Bestandslücken zuständig.

// Main
console.log('\n🌍 i18n Compliance Check läuft...\n');
console.log(`   Modus: --${mode}${mode === 'range' ? ` ${range}` : ''}\n`);

const files = getChangedFiles();
let hasErrors = false;

for (const file of files) {
  const diff = getChangedLines(file);
  if (!diff) continue;

  const issues = checkHardcodedStrings(file, diff);

  issues.forEach(issue => {
    hasErrors = true;
    console.error(`❌ ${issue.file}`);
    console.error(`   ${issue.type}: ${issue.keyword || issue.message}`);
    if (issue.snippet) {
      console.error(`   ${issue.snippet.substring(0, 80)}`);
    }
    console.error('');
  });
}

if (hasErrors) {
  console.error('\n⚠️  i18n Compliance Fehler gefunden!\n');
  console.error('Lösungen:');
  console.error('1. Hardcodierte Strings in src/i18n/translations.ts hinzufügen');
  console.error('2. Komponente mit useI18n() + t() aktualisieren');
  console.error('3. Keys in ALLE SUPPORTED_LOCALES eintragen (de, en, ru)');
  console.error('   — geprüft von src/i18n/__tests__/locale-parity.test.ts');
  console.error('\nExample:');
  console.error('  const { t } = useI18n();');
  console.error('  <h1>{t("myFeature.title")}</h1>\n');
  process.exit(1);
} else {
  console.log('✅ i18n Compliance OK\n');
  process.exit(0);
}
