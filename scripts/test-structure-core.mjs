/**
 * Kernprüflogik für die Test-Struktur-Konventionen (AGENTS.md §5 /
 * docs/coding-guide.md). Reine, testbare Funktion ohne I/O — wird von zwei
 * Aufrufern genutzt:
 *   - `scripts/check-test-structure.mjs` (agentenunabhängig, Pre-Commit + CI)
 *   - `.claude/hooks/test-structure-check.mjs` (Claude-Code-PostToolUse-Hook,
 *     importiert & re-exportiert diese Funktion, statt sie zu duplizieren)
 *
 * Abhängigkeitsrichtung bewusst so herum: `scripts/` ist agentenunabhängiges
 * Tooling (läuft auch ohne Claude Code, z. B. für Codex/CI); der Claude-Code-
 * Hook ist ein dünner Adapter darüber, kein Ort für die eigentliche Logik.
 */

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
