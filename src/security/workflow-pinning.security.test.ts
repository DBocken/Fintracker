import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für CI-Supply-Chain (siehe docs/security-guidelines.md, Klasse 4):
// 3rd-Party-Actions nur SHA-gepinnt (Tags sind verschiebbar → Supply-Chain-Risiko),
// jede Workflow-Datei mit explizitem Least-Privilege-permissions-Block.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');

const workflowFiles = fs
  .readdirSync(WORKFLOWS_DIR)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

describe('[SECURITY] GitHub-Workflow-Härtung', () => {
  it('sollte die bekannten Workflow-Dateien finden', () => {
    expect(workflowFiles).toContain('ci.yml');
    expect(workflowFiles).toContain('security-audit.yml');
  });

  describe.each(workflowFiles)('%s', (file) => {
    const source = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');
    const usesLines = [...source.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+).*$/gm)];

    it('[REGRESSION] sollte alle Actions auf einen 40-Hex-Commit-SHA pinnen', () => {
      for (const [line, ref] of usesLines) {
        if (ref.startsWith('./')) continue; // lokale Actions haben keinen Ref
        expect(ref, line.trim()).toMatch(/@[0-9a-f]{40}$/);
      }
    });

    it('sollte gepinnte Actions mit einem Versions-Kommentar dokumentieren', () => {
      for (const [line, ref] of usesLines) {
        if (ref.startsWith('./')) continue;
        expect(line, line.trim()).toMatch(/#\s*v\d/);
      }
    });

    it('[REGRESSION] sollte einen expliziten permissions-Block mit contents: read haben', () => {
      expect(source).toMatch(/^permissions:/m);
      expect(source).toMatch(/contents:\s*read/);
    });
  });
});
