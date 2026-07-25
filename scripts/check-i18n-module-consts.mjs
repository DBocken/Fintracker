#!/usr/bin/env node

/**
 * Verhindert eingefrorene Übersetzungen.
 *
 * Steht ein `t()`-Aufruf im Initializer einer Modul-`const`, wird er GENAU
 * EINMAL beim Import ausgewertet. Ein späterer Sprachwechsel bleibt dann
 * wirkungslos — der Text bleibt für die gesamte Sitzung in der Sprache, die
 * beim Laden des Moduls gerade galt.
 *
 *   ❌ const LABELS = { salary: t('demo.salary') }      // friert beim Import ein
 *   ✅ function labels() { return { salary: t('demo.salary') } }
 *
 * Das ist hier real passiert (`MONTHLY_TEMPLATE` in demo-data-service.ts) und
 * steht seit Langem als Regel in `.claude/agents/i18n-enforcer.md` §3 — bisher
 * ohne Durchsetzung.
 *
 * WARUM DIE COMPILER-API UND KEIN REGEX: ein Textscanner kann die Grenze, an der
 * die Auswertung verzögert wird, nicht zuverlässig sehen. Ein Prototyp lieferte
 * ausschließlich Fehlalarme — `t` als Parametername, Komponentenrümpfe, und vor
 * allem Shorthand-Objektmethoden (`async enable(pw) { … }`), die weder `=>` noch
 * `function` enthalten. `ts.isFunctionLike` kennt diese Grenze exakt.
 *
 * Bewusst GANZBAUMIG statt diff-basiert: ein Wächter, der nur den Diff sieht,
 * verpasst jeden Altbestand — genau daran ist die frühere i18n-Symmetrieprüfung
 * gescheitert.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Nicht-Test-Quelldateien unter src/, wie git sie kennt. */
function sourceFiles() {
  const out = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', cwd: REPO_ROOT });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !f.includes('__tests__') && !/\.(test|spec)\./.test(f))
    .filter((f) => !f.startsWith('src/test-utils/'));
}

/**
 * Namen, unter denen die Übersetzungsfunktion in dieser Datei erreichbar ist.
 * Aufgelöst statt hartcodiert, weil `src/lib/analysis-data.ts` sie als
 * `import { t as translate }` einbindet.
 */
function translationBindings(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = statement.moduleSpecifier;
    if (!ts.isStringLiteral(from) || !from.text.includes('i18n/serviceT')) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      // `import { t as translate }` → propertyName = t, name = translate
      const original = (element.propertyName ?? element.name).text;
      if (original === 't') names.add(element.name.text);
    }
  }
  return names;
}

function findFrozenCalls(sourceFile, names) {
  const findings = [];
  if (names.size === 0) return findings;

  /** Besucht einen Initializer und BRICHT an jeder Funktionsgrenze ab. */
  function visit(node) {
    // Ab hier wird die Auswertung verzögert — alles darunter ist unbedenklich.
    // Deckt Arrow, Function Expression, Methode, Getter und Klassenmember ab.
    if (ts.isFunctionLike(node)) return;

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      findings.push({ line: line + 1, name: node.expression.text });
    }
    ts.forEachChild(node, visit);
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer) visit(declaration.initializer);
    }
  }
  return findings;
}

console.log('\n🧊 Prüfe auf eingefrorene Übersetzungen in Modul-Konstanten...\n');

const issues = [];
for (const file of sourceFiles()) {
  const source = readFileSync(path.join(REPO_ROOT, file), 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const finding of findFrozenCalls(sourceFile, translationBindings(sourceFile))) {
    issues.push(`${file}:${finding.line} — ${finding.name}() im Initializer einer Modul-Konstante`);
  }
}

if (issues.length > 0) {
  console.error('❌ Eingefrorene Übersetzungen gefunden:\n');
  issues.forEach((issue) => console.error(`   ${issue}`));
  console.error('\nDiese Aufrufe werden EINMAL beim Import aufgelöst; ein späterer');
  console.error('Sprachwechsel wirkt nicht mehr. Lösung: die Konstante in eine');
  console.error('Funktion umwandeln und die Aufrufstellen anpassen.\n');
  console.error('  ❌ const LABELS = { a: t("ns.a") }');
  console.error('  ✅ function getLabels() { return { a: t("ns.a") } }\n');
  process.exit(1);
}

console.log('✅ Keine eingefrorenen Übersetzungen\n');
process.exit(0);
