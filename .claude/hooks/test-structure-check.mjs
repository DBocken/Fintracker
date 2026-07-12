#!/usr/bin/env node

/**
 * Test-Struktur-Check (Fintracker).
 *
 * Setzt die verbindlichen Test-Struktur-Konventionen durch (AGENTS.md §5 /
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
import { analyzeTestFile } from "../../scripts/test-structure-core.mjs";

// Kernprüflogik lebt in `scripts/test-structure-core.mjs` (agentenunabhängig,
// von `scripts/check-test-structure.mjs` UND diesem Hook genutzt) — hier nur
// re-exportiert, damit bestehende Importe (`import { analyzeTestFile } from
// "../test-structure-check.mjs"`, z. B. im Hook-eigenen Test) unverändert
// funktionieren.
export { analyzeTestFile };

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
        `\n\nSiehe AGENTS.md §5 (TDD & Teststruktur) / docs/coding-guide.md.\n`,
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
