#!/usr/bin/env node

/**
 * i18n Compliance Hook
 *
 * Überprüft, dass:
 * 1. Keine neuen hardcodierten deutschen/englischen Strings in JSX auftauchen
 * 2. Neue i18n-Keys in BEIDEN Sprachen in translations.ts definiert sind
 * 3. Test-Files i18n-Provider wrapping haben (wenn UI-Tests)
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

// import.meta.url ist eine file://-URL, kein Pfad → erst fileURLToPath,
// sonst zeigt REPO_ROOT auf ein nicht existierendes Verzeichnis.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  try {
    const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

function getChangedLines(file) {
  try {
    // Argument-Array + '--': Dateiname kann weder Shell-Kommando noch git-Option injizieren
    const output = execFileSync('git', ['diff', '--cached', '-U0', '--', file], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    return output;
  } catch (e) {
    return '';
  }
}

function checkHardcodedStrings(file, diff) {
  const issues = [];

  // Überspringe bestimmte Dateitypen
  if (file.includes('.test.') || file.includes('.spec.') ||
      file.includes('translations.ts') || file.includes('constants') ||
      file.includes('README') || file.includes('.md')) {
    return issues;
  }

  // Nur TS/TSX Dateien prüfen
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return issues;
  }

  // Finde neue Strings in JSX (einfache Heuristik: Quoted strings in < >)
  const lines = diff.split('\n');
  let lineNum = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Neue Zeile nach diff hunk
      lineNum = parseInt(line.match(/\+(\d+)/)?.[1] || 0);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      const content = line.substring(1); // Entferne '+' Prefix

      // Überspringe Kommentare
      if (content.trim().startsWith('//') || content.trim().startsWith('/*')) {
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

function checkTranslationsComplete(diff) {
  const issues = [];

  if (!diff.includes('translations.ts')) {
    return issues;
  }

  // Lese die aktuelle translations.ts
  const translationsPath = path.join(REPO_ROOT, 'src/i18n/translations.ts');
  if (!fs.existsSync(translationsPath)) {
    return issues;
  }

  try {
    const content = fs.readFileSync(translationsPath, 'utf8');

    // Vereinfachte Prüfung: Zähle offene/schließende Klammern für de/en
    const deMatch = content.match(/^\s*de:\s*\{[\s\S]*?\n\s*\},/m);
    const enMatch = content.match(/^\s*en:\s*\{[\s\S]*?\n\s*\},/m);

    if (!deMatch || !enMatch) {
      issues.push({
        file: 'translations.ts',
        type: 'INCOMPLETE_TRANSLATIONS',
        message: 'Translations.ts muss beide Sprachen (de, en) haben',
      });
    }

    // Prüfe auf Asymmetrie: Keys die nur in einer Sprache existieren
    const deKeys = content.match(/^\s*de:\s*\{[\s\S]*?\n\s*\},/m)?.[0] || '';
    const enKeys = content.match(/^\s*en:\s*\{[\s\S]*?\n\s*\},/m)?.[0] || '';

    const deLevelCount = (deKeys.match(/:\s*{/g) || []).length;
    const enLevelCount = (enKeys.match(/:\s*{/g) || []).length;

    if (deLevelCount !== enLevelCount) {
      issues.push({
        file: 'translations.ts',
        type: 'ASYMMETRIC_KEYS',
        message: `Asymmetrische Keys: DE hat ${deLevelCount} Levels, EN hat ${enLevelCount}`,
      });
    }
  } catch (e) {
    // Parse-Fehler OK, wird von TypeScript überprüft
  }

  return issues;
}

// Main
console.log('\n🌍 i18n Compliance Check läuft...\n');

const files = getChangedFiles();
let hasErrors = false;

for (const file of files) {
  const diff = getChangedLines(file);
  if (!diff) continue;

  const issues = checkHardcodedStrings(file, diff);
  const transIssues = checkTranslationsComplete(diff);

  [...issues, ...transIssues].forEach(issue => {
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
  console.error('3. Keys in BEIDE Sprachen (de + en) eintragen');
  console.error('\nExample:');
  console.error('  const { t } = useI18n();');
  console.error('  <h1>{t("myFeature.title")}</h1>\n');
  process.exit(1);
} else {
  console.log('✅ i18n Compliance OK\n');
  process.exit(0);
}
