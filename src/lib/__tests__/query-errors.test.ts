import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — reines JS-Skript ohne Typen; hier bewusst so eingebunden,
// statt scripts/ in die tsconfig zu ziehen.
import { analyzeQueryErrors, handlesError, findQueryCalls } from '../../../scripts/query-error-core.mjs';

/**
 * WP-9.6 — Kein `useQuery` ohne Aussage zum Fehlerfall.
 *
 * Der Kernbefund aus WP-9.1: 150 Aufrufe, 18 nahmen den Fehlerfall in die
 * Hand. Das übliche Muster `const { data: txs = [] } = useQuery(…)` macht
 * einen Ladefehler UNSICHTBAR — der Fallback greift, der Screen zeigt seinen
 * Leerzustand und behauptet „du hast noch nichts", obwohl die Daten da sind.
 */

const analyze = analyzeQueryErrors as (
  path: string,
  content: string,
) => { violations: number[]; total: number };

const handles = handlesError as (call: {
  destructured: string | null;
  options: string;
}) => boolean;

const find = findQueryCalls as (
  content: string,
) => { line: number; destructured: string | null; options: string }[];

describe('findQueryCalls', () => {
  it('sollte die Destrukturierung einer einzeiligen Abfrage lesen', () => {
    const calls = find("const { data = [] } = useQuery({ queryKey: ['a'], queryFn: f });");
    expect(calls).toHaveLength(1);
    expect(calls[0].destructured).toContain('data');
  });

  it('sollte auch die generische Schreibweise finden', () => {
    // `useQuery<Transaction[]>({…})` — ein Regex ohne `<…>` uebersieht rund ein
    // Viertel der Aufrufstellen dieses Repos.
    const calls = find('const { data, isError } = useQuery<Transaction[]>({});');
    expect(calls).toHaveLength(1);
    expect(calls[0].destructured).toContain('isError');
  });

  it('sollte mehrzeilige Destrukturierung zusammenhalten', () => {
    const content = `
      const {
        data: txs = [],
        isLoading: txsLoading,
        isError: txsError,
      } = useQuery<Transaction[]>({ queryKey: k, queryFn: f });
    `;
    expect(find(content)[0].destructured).toContain('txsError');
  });

  it('sollte die Zeilennummer mitliefern', () => {
    const content = 'const a = 1;\nconst b = 2;\nconst { data } = useQuery({});';
    expect(find(content)[0].line).toBe(3);
  });
});

describe('handlesError', () => {
  it('sollte eine Abfrage ohne Fehlerfeld melden', () => {
    expect(handles({ destructured: 'data: txs = []', options: '({})' })).toBe(false);
  });

  it.each(['isError', 'error', 'status', 'isLoadingError', 'failureReason'])(
    'sollte `%s` als Behandlung anerkennen',
    (field) => {
      expect(handles({ destructured: `data, ${field}`, options: '({})' })).toBe(true);
    },
  );

  it('sollte `throwOnError` anerkennen', () => {
    // Den Fehler bewusst an eine Error Boundary abzugeben IST eine Aussage —
    // nur eben eine andere als ihn selbst darzustellen.
    expect(handles({ destructured: 'data', options: '({ throwOnError: true })' })).toBe(true);
  });

  it('sollte sich nicht von einem Praefix taeuschen lassen', () => {
    // `errorCount` ist kein Fehlerzustand. Ohne Wortgrenze im Regex waere das
    // ein stiller Freibrief.
    expect(handles({ destructured: 'data, errorCount', options: '({})' })).toBe(false);
  });

  it('sollte ohne Destrukturierung melden', () => {
    // Etwa `useQuery({…})` als Argument — dann gibt es nichts, was den
    // Fehlerfall lesen koennte.
    expect(handles({ destructured: null, options: '({})' })).toBe(false);
  });
});

describe('analyzeQueryErrors', () => {
  it('[REGRESSION] sollte das Muster aus dem Kernbefund melden', () => {
    // Woertlich der Fall, der auf der Buchungsseite „Noch keine Buchungen"
    // anzeigte, obwohl die Abfrage gescheitert war.
    const content = "const { data: txs = [], isLoading } = useQuery({ queryKey: k, queryFn: f });";
    const result = analyze('src/features/x/use-y.ts', content);
    expect(result.violations).toEqual([1]);
    expect(result.total).toBe(1);
  });

  it('sollte den Fix durchlassen', () => {
    const content = "const { data: txs = [], isError } = useQuery({ queryKey: k, queryFn: f });";
    expect(analyze('src/features/x/use-y.ts', content).violations).toEqual([]);
  });

  it('sollte Tests nicht pruefen', () => {
    const content = 'const { data } = useQuery({});';
    expect(analyze('src/components/__tests__/Foo.test.tsx', content).violations).toEqual([]);
  });
});

describe('Ausnahmeliste als Phase-9-Backlog', () => {
  const allowlist = JSON.parse(
    readFileSync(resolve(__dirname, '../../../query-error-allowlist.json'), 'utf8'),
  ) as { files: Record<string, number> };

  it('sollte nur bestehende Dateien auflisten', () => {
    for (const file of Object.keys(allowlist.files)) {
      expect(() => readFileSync(resolve(__dirname, '../../..', file)), file).not.toThrow();
    }
  });

  it('sollte je Datei eine positive Anzahl fuehren', () => {
    // Die ANZAHL statt nur des Dateinamens ist der Kern: Sonst koennte eine
    // Datei mit drei offenen Aufrufen einen vierten dazubekommen, ohne dass
    // der Check etwas merkt.
    for (const [file, count] of Object.entries(allowlist.files)) {
      expect(Number.isInteger(count), file).toBe(true);
      expect(count, file).toBeGreaterThan(0);
    }
  });
});
