import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für Row Level Security (siehe docs/security-guidelines.md):
// Jede Cloud-Tabelle, die zur Laufzeit genutzt wird, MUSS in den versionierten
// Migrationen RLS aktivieren und mindestens eine Policy definieren. Ohne RLS
// kann jeder mit dem public-by-design anon-Key fremde Zeilen lesen/schreiben —
// die gesamte serverseitige Sicherheit hängt an diesen Policies.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

// Cloud-Tabellen mit echten Laufzeit-Zugriffen (Quelle: .from()-Aufrufe in
// src/, supabase/functions/ und mcp-poc/ — die best-effort-DSGVO-Löschliste
// in delete-account zählt bewusst nicht als Nutzung):
//   accounts, bank_connections     -> Edge refresh-balances / gocardless-sync
//   balance_refresh_limits         -> Edge refresh-balances
//   mcp_aggregate_snapshots        -> cloud-mcp-sync-service / api/mcp
//   category_template              -> category-template-service (read-only)
const RUNTIME_CLOUD_TABLES = [
  'accounts',
  'bank_connections',
  'balance_refresh_limits',
  'mcp_aggregate_snapshots',
  'category_template',
];

function stripSqlComments(sql: string): string {
  // Kommentare entfernen, damit erwähnte Tabellennamen (z. B. die
  // BEHALTEN-Liste in der Drop-Migration) keine falschen Treffer erzeugen.
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeTableName(raw: string): string {
  return raw.replace(/^public\./i, '').replace(/"/g, '').toLowerCase();
}

function loadMigrationCorpus(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files
    .map((f) => stripSqlComments(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')))
    .join('\n');
}

function createdTables(corpus: string): Set<string> {
  const created = new Set<string>();
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w"."]+)/gi;
  for (const m of corpus.matchAll(createRe)) created.add(normalizeTableName(m[1]));
  return created;
}

function droppedTables(corpus: string): Set<string> {
  const dropped = new Set<string>();
  const dropRe = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w"."]+)/gi;
  for (const m of corpus.matchAll(dropRe)) dropped.add(normalizeTableName(m[1]));
  return dropped;
}

function hasRlsEnabled(corpus: string, table: string): boolean {
  const re = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?"?${table}"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
    'i',
  );
  return re.test(corpus);
}

function policyCount(corpus: string, table: string): number {
  const re = new RegExp(`CREATE\\s+POLICY\\s+"[^"]+"\\s+ON\\s+(?:public\\.)?"?${table}"?\\b`, 'gi');
  return [...corpus.matchAll(re)].length;
}

describe('[SECURITY] Supabase Row Level Security', () => {
  const corpus = loadMigrationCorpus();
  const surviving = [...createdTables(corpus)].filter((t) => !droppedTables(corpus).has(t));

  describe('In-Repo-Migrationen (jede neue Tabelle braucht RLS)', () => {
    it('sollte mindestens eine überlebende CREATE TABLE finden (Scan-Selbsttest)', () => {
      expect(surviving.length).toBeGreaterThan(0);
    });

    it.each(surviving)('sollte RLS für Tabelle "%s" aktivieren', (table) => {
      expect(hasRlsEnabled(corpus, table), `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY fehlt in supabase/migrations/`).toBe(true);
    });

    it.each(surviving)('sollte mindestens eine Policy für Tabelle "%s" definieren', (table) => {
      expect(policyCount(corpus, table), `CREATE POLICY … ON ${table} fehlt in supabase/migrations/`).toBeGreaterThan(0);
    });
  });

  describe('Laufzeit-Tabellen (Repo als Source of Truth, auch für Alt-Tabellen)', () => {
    it.each(RUNTIME_CLOUD_TABLES)(
      '[REGRESSION] sollte RLS + Policy für Laufzeit-Tabelle "%s" versionieren',
      (table) => {
        expect(hasRlsEnabled(corpus, table), `RLS für ${table} ist nicht in supabase/migrations/ versioniert`).toBe(true);
        expect(policyCount(corpus, table), `Keine Policy für ${table} in supabase/migrations/`).toBeGreaterThan(0);
      },
    );
  });
});
