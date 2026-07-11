import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für HTTP-Security-Header (siehe docs/security-guidelines.md, Klasse 2).
// mcp-poc ist kein Workspace-Package (keine eigene Test-Infra) → statischer Scan.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('[SECURITY] HTTP-Security-Header für MCP-Endpunkte', () => {
  describe('mcp-poc (Express)', () => {
    const indexSource = fs.readFileSync(path.join(REPO_ROOT, 'mcp-poc/src/index.ts'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'mcp-poc/package.json'), 'utf8'));

    it('[REGRESSION] sollte helmet als Dependency deklarieren', () => {
      expect(pkg.dependencies?.helmet).toBeDefined();
    });

    it('[REGRESSION] sollte helmet importieren und vor allen Routen registrieren', () => {
      expect(indexSource).toMatch(/import helmet from ['"]helmet['"]/);
      const helmetIndex = indexSource.search(/app\.use\(\s*helmet/);
      const firstRouteIndex = indexSource.search(/app\.(get|post|delete)\(/);
      expect(helmetIndex).toBeGreaterThan(-1);
      expect(firstRouteIndex).toBeGreaterThan(-1);
      expect(helmetIndex).toBeLessThan(firstRouteIndex);
    });
  });

  describe('api/mcp/[token].ts (Vercel Function)', () => {
    const fnSource = fs.readFileSync(path.join(REPO_ROOT, 'api/mcp/[token].ts'), 'utf8');

    it('sollte nosniff und no-store auf JSON-Antworten setzen', () => {
      expect(fnSource).toMatch(/X-Content-Type-Options[^)]*nosniff/i);
      expect(fnSource).toMatch(/Cache-Control[^)]*no-store/i);
    });
  });

  describe('Regression Protection (vercel.json deckt /api ab)', () => {
    it('[REGRESSION] sollte den globalen Header-Block mit allen Kern-Headern behalten', () => {
      const vercelConfig = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'vercel.json'), 'utf8'),
      );
      const globalBlock = (vercelConfig.headers ?? []).find(
        (h: { source: string }) => h.source === '/(.*)',
      );
      expect(globalBlock).toBeDefined();
      const headerNames = globalBlock.headers.map((h: { key: string }) => h.key.toLowerCase());
      for (const required of [
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'content-security-policy',
      ]) {
        expect(headerNames).toContain(required);
      }
    });
  });
});
