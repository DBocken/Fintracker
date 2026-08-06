import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Wächter-Test für F-SEC-3 (Audit 2026-07-02):
// Das Tageslimit für Kontostand-Aktualisierungen schützt eine EXTERNE Quote
// (GoCardless) — es muss deshalb außerhalb der Reichweite dessen liegen, den es
// begrenzt. Ursprünglich lag der Zähler in einer Tabelle, auf die der Nutzer
// selbst FOR UPDATE und FOR ALL hatte: ein einziges UPDATE mit dem anon-Key
// (der public by design ist) setzte `daily_count` zurück, und das Limit war
// wirkungslos.
//
// Zwei Eigenschaften sichern das ab, beide werden hier statisch geprüft:
//   1. Der Nutzer darf die Zeile LESEN, aber nicht SCHREIBEN. Geschrieben wird
//      ausschließlich über eine SECURITY-DEFINER-Funktion, die den Nutzer aus
//      auth.uid() ableitet (kein user_id-Parameter, keine Limit-Übergabe).
//   2. Verbraucht wird das Kontingent VOR dem Aufruf der externen API. Prüfen
//      und Hochzählen in einem Statement, sonst passieren N gleichzeitige
//      Anfragen alle dieselbe Prüfung, bevor die erste zurückschreibt.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const REFRESH_FN = path.join(REPO_ROOT, 'supabase', 'functions', 'refresh-balances', 'index.ts');

const TABLE = 'balance_refresh_limits';
const RPC = 'consume_balance_refresh';

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function migrationCorpus(): string {
  return migrationFiles()
    .map((f) => stripSqlComments(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')))
    .join('\n');
}

/**
 * Spielt alle Migrationen in Dateinamen-Reihenfolge durch und liefert die am
 * Ende noch existierenden Policies der Tabelle. Ein DROP POLICY in einer
 * späteren Migration muss den früheren CREATE POLICY aufheben — sonst prüfte
 * dieser Test den Alt-Zustand mit und wäre nie grün zu bekommen.
 */
function survivingPolicies(): Map<string, string> {
  const alive = new Map<string, string>();
  const createRe = new RegExp(
    `CREATE\\s+POLICY\\s+"([^"]+)"\\s+ON\\s+(?:public\\.)?"?${TABLE}"?\\s*([\\s\\S]*?)(?:;|$)`,
    'gi',
  );
  const dropRe = new RegExp(
    `DROP\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"([^"]+)"\\s+ON\\s+(?:public\\.)?"?${TABLE}"?`,
    'gi',
  );

  for (const file of migrationFiles()) {
    const sql = stripSqlComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));

    // Innerhalb einer Datei gilt die Textreihenfolge: erst DROP, dann CREATE.
    for (const m of sql.matchAll(dropRe)) alive.delete(m[1]);
    for (const m of sql.matchAll(createRe)) {
      const forClause = /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(m[2]);
      // Ohne FOR-Klausel ist FOR ALL der Postgres-Default.
      alive.set(m[1], (forClause?.[1] || 'ALL').toUpperCase());
    }
  }

  return alive;
}

function refreshSource(): string {
  return fs.readFileSync(REFRESH_FN, 'utf8');
}

describe('[SECURITY] Tageslimit für Kontostand-Aktualisierung (F-SEC-3)', () => {
  describe('Schreibrechte des Nutzers auf den Zähler', () => {
    it('sollte Policies für die Zähler-Tabelle überhaupt finden (Scan-Selbsttest)', () => {
      expect(survivingPolicies().size).toBeGreaterThan(0);
    });

    it('[REGRESSION] sollte dem Nutzer keine schreibende Policy auf den Zähler lassen', () => {
      const writes = [...survivingPolicies().entries()].filter(([, cmd]) => cmd !== 'SELECT');

      expect(
        writes.map(([name, cmd]) => `${name} (FOR ${cmd})`),
        `Schreibende Policy auf ${TABLE} überlebt — der Nutzer kann sein eigenes Rate-Limit zurücksetzen`,
      ).toEqual([]);
    });

    it('sollte dem Nutzer das Lesen der eigenen Zeile weiterhin erlauben', () => {
      const reads = [...survivingPolicies().values()].filter((cmd) => cmd === 'SELECT');
      expect(reads.length, `Ohne SELECT-Policy kann die App das Restkontingent nicht anzeigen`).toBeGreaterThan(0);
    });

    it('sollte Schreibrechte auf der Tabelle zusätzlich per REVOKE entziehen', () => {
      const corpus = migrationCorpus();
      const revoke = new RegExp(
        `REVOKE\\s+(?:INSERT|UPDATE|DELETE|ALL)[\\s\\S]{0,80}?ON\\s+(?:TABLE\\s+)?(?:public\\.)?${TABLE}\\s+FROM\\s+[^;]*authenticated`,
        'i',
      );
      expect(revoke.test(corpus), `REVOKE … ON ${TABLE} FROM authenticated fehlt (Defense in Depth)`).toBe(true);
    });
  });

  describe('SECURITY-DEFINER-Funktion als einziger Schreibweg', () => {
    const corpus = migrationCorpus();
    const fnBody = new RegExp(
      `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${RPC}\\s*\\(([^)]*)\\)([\\s\\S]*?)\\$\\$;`,
      'i',
    ).exec(corpus);

    it('sollte die Funktion in den Migrationen definieren', () => {
      expect(fnBody, `CREATE FUNCTION public.${RPC} fehlt in supabase/migrations/`).not.toBeNull();
    });

    it('sollte SECURITY DEFINER mit fixiertem search_path deklarieren', () => {
      expect(fnBody![2]).toMatch(/SECURITY\s+DEFINER/i);
      expect(fnBody![2], 'Ohne SET search_path ist die Funktion über Schema-Shadowing angreifbar').toMatch(
        /SET\s+search_path\s*=/i,
      );
    });

    it('[REGRESSION] sollte weder Nutzer noch Limit als Parameter annehmen', () => {
      const params = fnBody![1].trim();
      expect(params, `${RPC} nimmt Parameter (${params}) — Nutzer und Limit müssen serverseitig feststehen`).toBe('');
    });

    it('sollte den Nutzer aus auth.uid() ableiten', () => {
      expect(fnBody![2]).toMatch(/auth\.uid\(\)/);
    });

    it('sollte Prüfen und Hochzählen in einem Statement erledigen', () => {
      // ON CONFLICT … DO UPDATE nimmt eine Zeilensperre: gleichzeitige Aufrufe
      // serialisieren sich, statt alle dieselbe veraltete Prüfung zu bestehen.
      expect(fnBody![2], 'Kein atomarer Upsert — Prüfen und Schreiben sind trennbar (TOCTOU)').toMatch(
        /ON\s+CONFLICT[\s\S]*?DO\s+UPDATE/i,
      );
    });

    it('sollte EXECUTE nur an authenticated vergeben', () => {
      const grant = new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${RPC}\\s*\\(\\)\\s+TO\\s+([^;]+);`, 'i').exec(
        corpus,
      );
      expect(grant, `GRANT EXECUTE ON FUNCTION public.${RPC}() fehlt`).not.toBeNull();
      expect(grant![1]).toMatch(/authenticated/);
      expect(grant![1], 'anon darf das Kontingent nicht verbrauchen').not.toMatch(/\banon\b/);
      expect(
        new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${RPC}\\s*\\(\\)\\s+FROM\\s+public`, 'i').test(corpus),
        'REVOKE ALL … FROM public fehlt',
      ).toBe(true);
    });
  });

  describe('Edge Function refresh-balances', () => {
    const source = refreshSource();

    it('[REGRESSION] sollte den Zähler nicht mehr direkt schreiben', () => {
      const directWrite = new RegExp(
        `from\\(\\s*["'\`]${TABLE}["'\`]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\s*\\(`,
        'i',
      );
      expect(
        directWrite.test(source),
        `refresh-balances schreibt ${TABLE} direkt — im Nutzerkontext ist dieser Schreibweg der Angriff selbst`,
      ).toBe(false);
    });

    it('sollte das Kontingent über die RPC verbrauchen', () => {
      expect(source).toMatch(new RegExp(`\\.rpc\\(\\s*["'\`]${RPC}["'\`]`));
    });

    it('[REGRESSION] sollte vor dem Aufruf der externen API verbrauchen', () => {
      const rpcIdx = source.search(new RegExp(`\\.rpc\\(\\s*["'\`]${RPC}["'\`]`));
      const syncIdx = source.indexOf('gocardless-sync');
      expect(rpcIdx, `${RPC} wird nicht aufgerufen`).toBeGreaterThan(-1);
      expect(syncIdx, 'Aufruf der externen API nicht gefunden — Test veraltet?').toBeGreaterThan(-1);
      expect(
        rpcIdx,
        'Das Kontingent wird erst NACH dem externen Abruf verbucht — bis dahin passieren beliebig viele Anfragen die Prüfung',
      ).toBeLessThan(syncIdx);
    });

    it('sollte bei erschöpftem Kontingent mit 429 antworten', () => {
      expect(source).toMatch(/429/);
      expect(source).toMatch(/rate_limit_exceeded/);
    });
  });
});
