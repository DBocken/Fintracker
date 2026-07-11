#!/usr/bin/env node

/**
 * Test-Struktur-Check (Fintracker).
 *
 * Setzt die verbindlichen Test-Struktur-Konventionen durch (CLAUDE.md /
 * docs/coding-guide.md). Läuft als PostToolUse-Hook nach Write/Edit/MultiEdit.
 *
 * BLOCKIERT (Exit 2, Meldung auf stderr) bei zwei eindeutigen Verstößen in
 * Test-Dateien unter src (Endung .test.ts / .test.tsx):
 *   1. Lokale Definition von `renderWithI18n`/`renderWithProviders` statt Import
 *      aus `@/test-utils/render` — der zentrale Helfer ist die einzige Quelle.
 *   2. Test-Datei außerhalb eines `__tests__/`-Ordners. Ausnahme: die bewusst
 *      platzierten Wächter-Tests unter `src/security/*.security.test.ts`.
 *
 * WARNT nur (Exit 0, additionalContext) bei der unscharfen Regel:
 *   - Englische `it('should …')`-Titel außerhalb bewusst bilingualer
 *     `describe('English …')`-Blöcke (deutsche `it('sollte …')` sind Standard).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reine, testbare Prüflogik. Bekommt Pfad + Dateiinhalt, gibt Verstöße zurück.
 * @param {string} filePath  Pfad der bearbeiteten Datei (absolut oder relativ).
 * @param {string} content   Dateiinhalt.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function analyzeTestFile(filePath, content) {
  const errors = [];
  const warnings = [];

  const isTest = /\.test\.tsx?$/.test(filePath);
  if (!isTest) return { errors, warnings };
  // Konventionen nur für Produkt-Tests unter src/ erzwingen (nicht für Tooling).
  if (!/(^|\/)src\//.test(filePath)) return { errors, warnings };

  const isCentralHelper = /(^|\/)src\/test-utils\//.test(filePath);

  // Verstoß 1: lokale Definition eines zentralen Render-Helfers.
  if (!isCentralHelper) {
    const localDef = /\b(?:function|const)\s+(renderWithI18n|renderWithProviders)\b/.exec(content);
    if (localDef) {
      errors.push(
        `Lokale Definition von \`${localDef[1]}\` gefunden. Nutze stattdessen den ` +
          `zentralen Helfer: \`import { ${localDef[1]} } from '@/test-utils/render'\`. ` +
          `Provider-Setup (I18nProvider/MemoryRouter) lebt zentral, nicht pro Testdatei.`,
      );
    }
  }

  // Verstoß 2: Platzierung außerhalb __tests__/ (außer src/security-Wächter).
  const inTestsDir = /(^|\/)__tests__\//.test(filePath);
  const isSecurityGuardian = /(^|\/)src\/security\/[^/]*\.security\.test\.tsx?$/.test(filePath);
  if (!inTestsDir && !isSecurityGuardian) {
    errors.push(
      `Test-Datei liegt außerhalb eines \`__tests__/\`-Ordners. Verschiebe sie neben ` +
        `den Code in ein \`__tests__/\` (z. B. \`src/lib/x.test.ts\` → ` +
        `\`src/lib/__tests__/x.test.ts\`). Ausnahme nur für Wächter-Tests unter ` +
        `\`src/security/*.security.test.ts\`.`,
    );
  }

  // Warnung: englische it('should …') in einer sonst rein deutschen Datei.
  // Bilinguale Tests (English-locale-Block, englischer Titel, 'en'-Locale)
  // sind bewusst und lösen keine Warnung aus.
  const hasShould = /\bit\(\s*['"]should\b/.test(content);
  const hasEnglishSignal =
    /\bdescribe\(\s*['"][^'"]*\benglish\b/i.test(content) ||
    /\bit\(\s*['"][^'"]*\benglish\b/i.test(content) ||
    /initialLocale\s*=\s*['"]en['"]/.test(content) ||
    /\blocale:\s*['"]en['"]/.test(content) ||
    /,\s*['"]en['"]\s*\)/.test(content);
  if (hasShould && !hasEnglishSignal) {
    warnings.push(
      `Englische Testbeschreibung \`it('should …')\` gefunden. Konvention ist deutsches ` +
        `\`it('sollte …')\`. Ausnahme: bewusst bilinguale \`describe('English locale', …)\`-Blöcke.`,
    );
  }

  return { errors, warnings };
}

function main() {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    return;
  }

  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    return;
  }

  const fp = data?.tool_input?.file_path || data?.tool_response?.filePath || "";
  if (!fp) return;

  let content = "";
  try {
    content = fs.readFileSync(fp, "utf8");
  } catch {
    return;
  }

  const { errors, warnings } = analyzeTestFile(fp, content);

  if (errors.length > 0) {
    process.stderr.write(
      `\n❌ Test-Struktur-Verstoß in ${fp}:\n` +
        errors.map((e) => `  • ${e}`).join("\n") +
        `\n\nSiehe CLAUDE.md (Test-Organisation) / docs/coding-guide.md.\n`,
    );
    process.exit(2); // Exit 2 = blockierend; stderr geht an Claude.
  }

  if (warnings.length > 0) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: warnings.join(" "),
        },
      }),
    );
  }
}

// Nur ausführen, wenn direkt als Skript aufgerufen (nicht beim Import im Test).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
