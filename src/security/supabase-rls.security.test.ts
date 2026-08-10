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

// --- WP 3.4 (SEC-4): Restriktivität statt bloßer Existenz -----------------
//
// Die obigen Prüfungen (hasRlsEnabled/policyCount) stellen nur fest, DASS RLS
// aktiv ist und mindestens eine Policy existiert — eine Policy mit
// `USING (true)` ("jeder darf alles") würde beide bestehen. Die folgenden
// Funktionen prüfen zusätzlich den INHALT jeder Policy: sie muss (direkt oder
// über eine EXISTS-Subquery auf eine andere eigentümer-beschränkte Zeile) ein
// `auth.uid() = user_id`-Muster enthalten.
//
// Bewusst als reine, dateisystemfreie Funktionen geschnitten — dieselbe Kern/
// Runner-Trennung wie `scripts/*-core.mjs` (siehe money-parsing-core.mjs,
// layers-core.mjs): `extractPolicyClauses`/`isOwnerScopedClause`/
// `findNonOwnerScopedPolicies` nehmen einen SQL-String entgegen, nie den
// Dateipfad. Anders als bei den `scripts/check-*.mjs`-Wächtern ist dafür HIER
// keine zweite Datei nötig: es gibt keinen `pnpm check:*`-Aufrufer außerhalb
// von Vitest, der dieselbe Logik bräuchte (kein Pre-Commit-Hook, kein
// PostToolUse-Hook) — der einzige Zweck der Trennung ist Testbarkeit mit
// Inline-Fixtures, und die ist bereits erreicht, wenn die Funktionen frei von
// `fs`-Zugriffen sind. Eine eigene `.mjs`-Datei würde nur Indirektion ohne
// zusätzlichen Nutzen hinzufügen.
//
// Kein pgTAP-/Zwei-Nutzer-Test gegen eine echte Supabase-Instanz: bewusster,
// dokumentierter Folgepunkt (siehe docs/qualitaet-2026-08/plan.md, Abschnitt
// „Phase 4" — „Kein pgTAP-/Live-RLS-Test — nur als Folgepunkt dokumentiert
// (WP 3.4)"). Diese Datei bleibt eine statische Textprüfung der
// Migrationsdateien, kein Test gegen eine laufende Datenbank.

interface PolicyClause {
  name: string;
  table: string;
  clause: string;
}

interface PolicyViolation {
  name: string;
  table: string;
}

interface PolicyAllowlistEntry {
  table: string;
  policy: string;
  reason: string;
}

/**
 * Begründete Ausnahmen von der `auth.uid() = user_id`-Pflicht. Nach dem Muster
 * der übrigen Allowlists im Repo (Zahl/Objekt-Konvention) — hier gibt es keine
 * Zahl-Form (kein "offenes Backlog"), weil jede Ausnahme eine bewusste, für
 * diese eine Policy geprüfte Entscheidung ist, kein Sammelbecken für später
 * zu behebende Fundstellen.
 */
const NON_OWNER_SCOPED_POLICY_ALLOWLIST: PolicyAllowlistEntry[] = [
  {
    table: 'category_template',
    policy: 'category_template_read',
    reason:
      'Globale, versionierte Kategorien-Vorlage ohne user_id-Spalte (Migration ' +
      '20260702130000): reine Nachschlagetabelle, Zeilen gehören keinem Nutzer. ' +
      '`FOR SELECT TO anon, authenticated USING (true)` gibt niemandem Zugriff auf ' +
      'fremde Daten, weil es keine gibt — Schreiben ist clientseitig unmöglich (keine ' +
      'INSERT/UPDATE/DELETE-Policy; nur service_role kann schreiben, umgeht RLS ' +
      'ohnehin). Ein `auth.uid() = user_id`-Muster wäre hier sinnlos: die Tabelle hat ' +
      'gar keine `user_id`-Spalte.',
  },
];

function isPolicyAllowlisted(table: string, policyName: string): boolean {
  return NON_OWNER_SCOPED_POLICY_ALLOWLIST.some((e) => e.table === table && e.policy === policyName);
}

/**
 * Extrahiert jede `CREATE POLICY "name" ON table … ;`-Anweisung aus dem
 * Migrations-Korpus. Nicht-gierig bis zum ersten `;` — in keiner Policy im
 * Bestand steht ein `;` innerhalb der USING/WITH-CHECK-Klausel (auch nicht in
 * den EXISTS-Subqueries), daher genügt das ohne Klammer-Balancierung.
 * `DROP POLICY …;`-Anweisungen matchen nicht (das Muster verlangt das
 * Schlüsselwort `CREATE`), Kommentare sind vom Aufrufer bereits über
 * `stripSqlComments` entfernt.
 */
function extractPolicyClauses(corpus: string): PolicyClause[] {
  const re = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?"?(\w+)"?([\s\S]*?);/gi;
  return [...corpus.matchAll(re)].map((m) => ({
    name: m[1],
    table: normalizeTableName(m[2]),
    clause: m[3],
  }));
}

// Deckt beide im Bestand vorkommenden Reihenfolgen ab (`auth.uid() = user_id`
// direkt, `portfolios.user_id = auth.uid()` in einer EXISTS-Subquery) sowie
// die im Auftrag verlangte, im Bestand nicht vorkommende vertauschte Form
// (`user_id = auth.uid()`) — beliebige Leerräume um das `=`, optionale
// doppelte Anführungszeichen um `user_id` (Postgres erlaubt beides).
const OWNER_SCOPE_RE = /(?:auth\.uid\(\)\s*=\s*"?user_id"?)|(?:"?user_id"?\s*=\s*auth\.uid\(\))/i;

/** Prüft NUR den Klauselinhalt (kein Dateisystem, kein Tabellenname). */
function isOwnerScopedClause(clause: string): boolean {
  return OWNER_SCOPE_RE.test(clause);
}

/**
 * Findet jede Policy im Korpus, deren Klausel kein `auth.uid() = user_id`-
 * Muster enthält UND die nicht auf der begründeten Allowlist steht.
 */
function findNonOwnerScopedPolicies(corpus: string): PolicyViolation[] {
  return extractPolicyClauses(corpus)
    .filter((p) => !isOwnerScopedClause(p.clause) && !isPolicyAllowlisted(p.table, p.name))
    .map((p) => ({ name: p.name, table: p.table }));
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

  // WP 3.4 (SEC-4): Existenz einer Policy reicht nicht — sie muss auch
  // restriktiv sein. `USING (true)` bestünde jede Prüfung oben.
  describe('Policies sind restriktiv, nicht nur vorhanden (SEC-4)', () => {
    it('[SECURITY] sollte eine eingeschleuste USING (true)-Policy ablehnen (Negativ-Fixture)', () => {
      // Inline-Fixture statt einer echten, kurzzeitig eingeschleusten Migration:
      // der Beweis, dass der Wächter anschlägt, bleibt so dauerhaft im Testlauf
      // erhalten, statt nur einmalig im PR-Diff vorgeführt zu werden.
      const fixture = `
        CREATE TABLE IF NOT EXISTS public.evil_table (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL
        );
        ALTER TABLE public.evil_table ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "evil_select_policy" ON public.evil_table
          FOR SELECT TO authenticated USING (true);
      `;

      const violations = findNonOwnerScopedPolicies(fixture);

      expect(violations).toEqual([{ name: 'evil_select_policy', table: 'evil_table' }]);
    });

    it.each<[string, string]>([
      ['auth.uid() = user_id, direkt (portfolios_select_policy-Stil)', 'FOR SELECT TO authenticated USING (auth.uid() = user_id)'],
      ['WITH CHECK statt USING (portfolios_insert_policy-Stil)', 'FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)'],
      ['FOR ALL mit USING + WITH CHECK ("own accounts"-Stil)', 'FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)'],
      ['vertauschte Reihenfolge user_id = auth.uid()', 'FOR UPDATE TO authenticated USING (user_id = auth.uid())'],
      ['zusätzliche Leerzeichen um das Gleichheitszeichen', 'FOR ALL USING ( auth.uid()   =   user_id )'],
      [
        'indirekter Besitz über EXISTS-Subquery (portfolio_positions_select_policy-Stil)',
        'FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = portfolio_positions.portfolio_id AND portfolios.user_id = auth.uid()))',
      ],
    ])('[SECURITY] sollte die Schreibweise "%s" als eigentümer-beschränkt akzeptieren', (_label, clause) => {
      expect(isOwnerScopedClause(clause)).toBe(true);
    });

    it('[SECURITY] sollte den echten Migrationsbestand vollständig als restriktiv akzeptieren', () => {
      expect(findNonOwnerScopedPolicies(corpus)).toEqual([]);
    });

    it('[SECURITY] sollte eine begründete Ausnahme (Nachschlagetabelle ohne user_id-Spalte) gezielt durchlassen', () => {
      // Gegenprobe zur vorigen Prüfung: category_template_read besteht NUR wegen
      // der Allowlist — ihre Klausel selbst ist (zurecht) nicht eigentümer-
      // beschränkt. Ohne den Allowlist-Eintrag wäre der Test oben rot.
      const [categoryTemplateRead] = extractPolicyClauses(corpus).filter(
        (p) => p.table === 'category_template' && p.name === 'category_template_read',
      );

      expect(categoryTemplateRead, 'category_template_read fehlt im Migrationsbestand').toBeDefined();
      expect(isOwnerScopedClause(categoryTemplateRead.clause)).toBe(false);
      expect(isPolicyAllowlisted('category_template', 'category_template_read')).toBe(true);
    });

    it('[SECURITY] sollte nicht an Kommentaren, DROP POLICY oder reinem WITH CHECK (ohne USING) scheitern (kein Fehlalarm)', () => {
      const fixture = stripSqlComments(`
        -- Hinweis: vor jedem CREATE POLICY steht ein DROP POLICY IF EXISTS.
        -- Diese Zeile erwähnt "CREATE POLICY" nur im Kommentartext.
        DROP POLICY IF EXISTS "old_policy" ON public.accounts;
        CREATE POLICY "insert_only_policy" ON public.accounts
          FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
      `);

      const clauses = extractPolicyClauses(fixture);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].name).toBe('insert_only_policy');
      expect(findNonOwnerScopedPolicies(fixture)).toEqual([]);
    });
  });
});
