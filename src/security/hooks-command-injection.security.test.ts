import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test gegen Shell-Injection (siehe docs/security-guidelines.md, Klasse 1):
// Dateinamen/Variablen dürfen nie in einen Shell-String interpoliert werden —
// child_process nur über execFileSync + Argument-Array.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function listMjsFiles(dir: string): string[] {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => path.join(dir, f));
}

const SCANNED_FILES = [...listMjsFiles('.claude/hooks'), ...listMjsFiles('scripts')];

describe('[SECURITY] Shell-Injection-Schutz in Hooks & Scripts', () => {
  it('sollte mindestens die bekannten Hook-/Script-Dateien finden', () => {
    expect(SCANNED_FILES.length).toBeGreaterThanOrEqual(4);
    expect(SCANNED_FILES).toContain(path.join('.claude/hooks', 'i18n-compliance.mjs'));
  });

  describe.each(SCANNED_FILES)('%s', (file) => {
    const source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

    it('sollte kein execSync verwenden (Shell-Interpolation möglich)', () => {
      expect(source).not.toMatch(/\bexecSync\s*\(/);
    });

    it('sollte kein nacktes exec()/spawn mit shell:true verwenden', () => {
      expect(source).not.toMatch(/(?<![\w.])exec\s*\(/);
      expect(source).not.toMatch(/shell\s*:\s*true/);
    });
  });

  describe('Regression Protection', () => {
    const hookSource = fs.readFileSync(
      path.join(REPO_ROOT, '.claude/hooks/i18n-compliance.mjs'),
      'utf8',
    );

    it('[REGRESSION] sollte git-Diffs über execFileSync mit Argument-Array aufrufen', () => {
      expect(hookSource).toMatch(/execFileSync\(\s*['"]git['"]/);
    });

    it('[REGRESSION] sollte import.meta.url über fileURLToPath auflösen (nicht path.resolve auf der URL)', () => {
      expect(hookSource).toMatch(/fileURLToPath/);
      expect(hookSource).not.toMatch(/path\.resolve\(\s*import\.meta\.url/);
    });
  });
});
