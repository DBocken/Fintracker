import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für Key-Hygiene (siehe docs/security-guidelines.md, Klasse 3):
// Der Supabase-Anon-Key ist public-by-design (RLS schützt serverseitig),
// muss aber env-first gelesen werden (Rotation, Preview-Deployments) und
// darf nie versehentlich durch einen service_role-Key ersetzt werden.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function decodeJwtRole(source: string): string[] {
  const jwts = source.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g) ?? [];
  return jwts.map((jwt) => {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return payload.role as string;
  });
}

describe('[SECURITY] Supabase-Key-Hygiene', () => {
  const clientSource = fs.readFileSync(
    path.join(REPO_ROOT, 'src/integrations/supabase/client.ts'),
    'utf8',
  );
  const tokenFnSource = fs.readFileSync(path.join(REPO_ROOT, 'api/mcp/[token].ts'), 'utf8');

  describe('src/integrations/supabase/client.ts', () => {
    it('[REGRESSION] sollte URL und Key env-first lesen (nie wieder hardcoded-only)', () => {
      expect(clientSource).toMatch(/import\.meta\.env\.VITE_SUPABASE_URL\s*(\?\?|\|\|)/);
      expect(clientSource).toMatch(/import\.meta\.env\.VITE_SUPABASE_ANON_KEY\s*(\?\?|\|\|)/);
    });

    it('sollte als Fallback ausschließlich einen anon-Key einbetten (nie service_role)', () => {
      const roles = decodeJwtRole(clientSource);
      expect(roles.length).toBeGreaterThan(0);
      roles.forEach((role) => expect(role).toBe('anon'));
    });
  });

  describe('api/mcp/[token].ts', () => {
    it('sollte den Key env-first lesen', () => {
      expect(tokenFnSource).toMatch(/process\.env\.SUPABASE_ANON_KEY\s*(\?\?|\|\|)/);
    });

    it('[REGRESSION] sollte als Fallback ausschließlich einen anon-Key einbetten', () => {
      const roles = decodeJwtRole(tokenFnSource);
      expect(roles.length).toBeGreaterThan(0);
      roles.forEach((role) => expect(role).toBe('anon'));
    });
  });

  describe('.env.example', () => {
    it('sollte existieren und die VITE_-Variablen dokumentieren', () => {
      const envExamplePath = path.join(REPO_ROOT, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      expect(envExample).toMatch(/VITE_SUPABASE_URL=/);
      expect(envExample).toMatch(/VITE_SUPABASE_ANON_KEY=/);
    });
  });
});
