#!/usr/bin/env node

/**
 * Test-Struktur-Check (agentenunabhängig)
 *
 * Setzt dieselben Test-Struktur-Konventionen durch wie der PostToolUse-Hook
 * `.claude/hooks/test-structure-check.mjs` (AGENTS.md §5 / docs/coding-guide.md),
 * aber repo-weit über alle vorhandenen Test-Dateien statt nur die zuletzt von
 * Claude bearbeitete — läuft per `pnpm check:test-structure` lokal (Pre-Commit)
 * und in CI, damit auch Agenten ohne .claude-Hooks (z. B. Codex) gebunden sind.
 *
 * Nutzt dieselbe Prüflogik (`analyzeTestFile` aus `./test-structure-core.mjs`)
 * wie der Hook — keine Doppelimplementierung. Der Hook importiert dieselbe
 * Kernlogik von dort (Abhängigkeitsrichtung: `scripts/` ist die Quelle,
 * `.claude/hooks/` re-exportiert nur).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTestFile } from './test-structure-core.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

function findTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  // recursive:true + withFileTypes:false liefert Pfade relativ zu `dir`
  // (z. B. "lib/__tests__/x.test.ts") — verfügbar seit Node 20, hier ok
  // (CI/lokal laufen auf Node 22, kein neues Dependency nötig).
  const entries = fs.readdirSync(dir, { recursive: true });
  return entries
    .filter((rel) => /\.(test|spec)\.tsx?$/.test(rel))
    .map((rel) => path.join(dir, rel))
    .filter((abs) => {
      // Tote/dangling Symlinks (oder Pfade, die zwischen readdirSync und hier
      // verschwunden sind) dürfen den Check nicht crashen — einfach überspringen.
      try {
        return fs.statSync(abs).isFile();
      } catch {
        return false;
      }
    });
}

const testFiles = findTestFiles(SRC_DIR).sort();

console.log(`\n🧪 Test-Struktur-Check läuft (${testFiles.length} Test-Dateien unter src/)...\n`);

let hasErrors = false;
const allWarnings = [];

for (const absPath of testFiles) {
  const relPath = path.relative(REPO_ROOT, absPath).split(path.sep).join('/');

  // `.spec.`-Dateien sind keine anerkannte Konvention in diesem Repo (nur
  // `.test.ts(x)`) — früher fielen sie stumm durch `analyzeTestFile` (das nur
  // `.test.` prüft) und wurden nie beanstandet, egal wo sie lagen. Jetzt
  // direkt als Fehler melden statt sie unkontrolliert durchzulassen.
  if (/\.spec\.tsx?$/.test(relPath)) {
    hasErrors = true;
    console.error(`❌ Test-Struktur-Verstoß in ${relPath}:`);
    console.error(
      '   • .spec-Dateien sind nicht Teil der Konvention — .test.ts(x) in __tests__/ verwenden.',
    );
    console.error('');
    continue;
  }

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    continue;
  }

  const { errors, warnings } = analyzeTestFile(relPath, content);

  if (errors.length > 0) {
    hasErrors = true;
    console.error(`❌ Test-Struktur-Verstoß in ${relPath}:`);
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error('');
  }

  warnings.forEach((w) => allWarnings.push(`${relPath}: ${w}`));
}

if (allWarnings.length > 0) {
  console.warn('⚠️  Warnungen (nicht blockierend):');
  allWarnings.forEach((w) => console.warn(`   • ${w}`));
  console.warn('');
}

if (hasErrors) {
  console.error('Siehe AGENTS.md §5 (TDD & Teststruktur) / docs/coding-guide.md.\n');
  process.exit(1);
} else {
  console.log('✅ Test-Struktur OK\n');
  process.exit(0);
}
