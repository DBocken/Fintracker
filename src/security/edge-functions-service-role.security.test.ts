import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für Edge-Function-Privilegien (Least Privilege):
// Alle Edge Functions arbeiten mit dem anon-Key + verifizierter User-Session
// und verlassen sich auf RLS. Einzige dokumentierte Ausnahme: delete-account
// (DSGVO Art. 17 — der Auth-User kann nur mit service_role gelöscht werden).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS_DIR = path.join(REPO_ROOT, 'supabase', 'functions');

const SERVICE_ROLE_ALLOWLIST = ['delete-account'];

function loadEdgeFunctions(): Array<{ name: string; source: string }> {
  return fs
    .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      source: fs.readFileSync(path.join(FUNCTIONS_DIR, d.name, 'index.ts'), 'utf8'),
    }));
}

describe('[SECURITY] Edge-Function-Privilegien', () => {
  const fns = loadEdgeFunctions();

  it('sollte mindestens eine Edge Function finden (Scan-Selbsttest)', () => {
    expect(fns.length).toBeGreaterThan(0);
  });

  describe('service_role nur in der Allowlist', () => {
    it.each(fns.map((f) => [f.name, f] as const))(
      'sollte in "%s" service_role nur erlauben, wenn allowlisted',
      (_name, fn) => {
        if (SERVICE_ROLE_ALLOWLIST.includes(fn.name)) return;
        expect(
          /SERVICE_ROLE/i.test(fn.source),
          `${fn.name} referenziert SERVICE_ROLE, ist aber nicht in der dokumentierten Allowlist`,
        ).toBe(false);
      },
    );
  });

  describe('Key-Hygiene', () => {
    it.each(fns.map((f) => [f.name, f] as const))(
      'sollte in "%s" keine JWT-Literale einbetten (Keys nur via Deno.env)',
      (_name, fn) => {
        expect(fn.source).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
      },
    );

    it.each(fns.map((f) => [f.name, f] as const))(
      'sollte in "%s" Supabase-Keys über Deno.env.get lesen',
      (_name, fn) => {
        expect(fn.source).toMatch(/Deno\.env\.get\(/);
      },
    );
  });

  describe('delete-account', () => {
    const deleteAccount = fns.find((f) => f.name === 'delete-account');

    it('[REGRESSION] sollte den Admin-Client erst NACH erfolgreicher auth.getUser()-Prüfung erzeugen', () => {
      expect(deleteAccount).toBeDefined();
      const source = deleteAccount!.source;
      const getUserIdx = source.indexOf('auth.getUser()');
      const adminClientIdx = source.indexOf('createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
      expect(getUserIdx, 'delete-account verifiziert den Aufrufer nicht mehr via auth.getUser()').toBeGreaterThan(-1);
      expect(adminClientIdx, 'delete-account erzeugt keinen service_role-Client mehr — Allowlist prüfen').toBeGreaterThan(-1);
      expect(getUserIdx, 'service_role-Client wird VOR der Nutzer-Verifikation erzeugt').toBeLessThan(adminClientIdx);
    });

    it('[REGRESSION] sollte bei fehlgeschlagener Verifikation mit 401 abbrechen', () => {
      expect(deleteAccount!.source).toMatch(/401/);
      expect(deleteAccount!.source).toMatch(/userError\s*\|\|\s*!user/);
    });
  });
});
