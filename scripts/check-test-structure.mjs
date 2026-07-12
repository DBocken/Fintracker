#!/usr/bin/env node

/**
 * Test-Struktur-Check (agentenunabhängig)
 *
 * Setzt dieselben Test-Struktur-Konventionen durch wie der PostToolUse-Hook
 * `.claude/hooks/test-structure-check.mjs` (CLAUDE.md / docs/coding-guide.md),
 * aber repo-weit über alle vorhandenen Test-Dateien statt nur die zuletzt von
 * Claude bearbeitete — läuft per `pnpm check:test-structure` lokal (Pre-Commit)
 * und in CI, damit auch Agenten ohne .claude-Hooks (z. B. Codex) gebunden sind.
 *
 * Nutzt dieselbe Prüflogik (`analyzeTestFile`) wie der Hook — keine
 * Doppelimplementierung.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTestFile } from '../.claude/hooks/test-structure-check.mjs';

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
    .filter((abs) => fs.statSync(abs).isFile());
}

const testFiles = findTestFiles(SRC_DIR).sort();

console.log(`\n🧪 Test-Struktur-Check läuft (${testFiles.length} Test-Dateien unter src/)...\n`);

let hasErrors = false;
const allWarnings = [];

for (const absPath of testFiles) {
  const relPath = path.relative(REPO_ROOT, absPath).split(path.sep).join('/');

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
  console.error('Siehe CLAUDE.md (Test-Organisation) / docs/coding-guide.md.\n');
  process.exit(1);
} else {
  console.log('✅ Test-Struktur OK\n');
  process.exit(0);
}
