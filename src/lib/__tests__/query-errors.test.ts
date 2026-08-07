import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — reines JS-Skript ohne Typen; hier bewusst so eingebunden,
// statt scripts/ in die tsconfig zu ziehen.
import { analyzeQueryErrors, handlesError, findQueryCalls } from '../../../scripts/query-error-core.mjs';
// @ts-expect-error — reines JS-Wächterskript ohne Typen
import { budgetOf, reasonOf, malformedEntries } from '../../../scripts/check-query-errors.mjs';

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
    // Der Fehlerzustand muss auch GELESEN werden. Bloss zu destrukturieren
    // legt nur die Meldung stumm — siehe „Destrukturiert, aber nie benutzt".
    const content = [
      "const { data: txs = [], isError } = useQuery({ queryKey: k, queryFn: f });",
      'if (isError) return <FinanceErrorState onRetry={r} />;',
    ].join('\n');
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
  ) as { files: Record<string, number | { count: number; reason: string }> };

  it('sollte nur bestehende Dateien auflisten', () => {
    for (const file of Object.keys(allowlist.files)) {
      expect(() => readFileSync(resolve(__dirname, '../../..', file)), file).not.toThrow();
    }
  });

  it('sollte je Datei eine positive Anzahl fuehren', () => {
    // Die ANZAHL statt nur des Dateinamens ist der Kern: Sonst koennte eine
    // Datei mit drei offenen Aufrufen einen vierten dazubekommen, ohne dass
    // der Check etwas merkt.
    for (const [file, entry] of Object.entries(allowlist.files)) {
      const count = budgetOf(entry);
      expect(Number.isInteger(count), file).toBe(true);
      expect(count, file).toBeGreaterThan(0);
    }
  });
});

describe('Durchreichende Aufrufe (WP-9.6, Nachtrag)', () => {
  it('sollte `return useQuery(…)` anerkennen', () => {
    // Ein Hook, der das vollstaendige Ergebnis zurueckgibt, nimmt den
    // Fehlerfall nicht selbst in die Hand — er gibt ihn weiter, und das ist
    // bei einem Hook das richtige Verhalten (AGENTS.md §3). Ohne diese
    // Ausnahme haette der Waechter zu einer sinnlosen Destrukturierung
    // gezwungen, die den Wert nur wieder zusammensetzt.
    const content = "export const useThing = () => {\n  return useQuery({ queryKey: k, queryFn: f });\n};";
    expect(analyze('src/services/thing-service.ts', content).violations).toEqual([]);
  });

  it('[REGRESSION] sollte kein Schlupfloch fuer „spaeter nur data" sein', () => {
    // `const q = useQuery(…); return q.data;` reicht eben NICHT durch: Der
    // Fehlerzustand geht dabei verloren.
    const content = 'const q = useQuery({ queryKey: k, queryFn: f });\nreturn q.data;';
    expect(analyze('src/hooks/useThing.ts', content).violations).toEqual([1]);
  });
});

describe('Fehlerzustand ueber den gebundenen Namen (WP-9.6, Nachtrag)', () => {
  it('sollte `const q = useQuery(…)` + `q.isError` anerkennen', () => {
    const content = "const txQuery = useQuery({ queryKey: k, queryFn: f });\nif (txQuery.isError) return <Fehler />;";
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([]);
  });

  it('sollte die Zusammenfassung mehrerer Abfragen anerkennen', () => {
    // Bei einer Seite mit vier Abfragen ist EINE Aussage („die Seite ist nicht
    // rechenbar") die bessere Loesung als vier Fehlermeldungen fuer dieselbe
    // Ursache. Der Waechter darf sie nicht verhindern.
    const content = [
      'const a = useQuery({});',
      'const b = useQuery({});',
      'const queries = [a, b];',
      'const hasLoadError = queries.some((q) => q.isError);',
    ].join('\n');
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([]);
  });

  it('[REGRESSION] sollte einen ungelesenen Namen weiter melden', () => {
    // Nur zuweisen genuegt nicht — sonst waere die Regel durch Umbenennen
    // aushebelbar.
    const content = 'const txQuery = useQuery({});\nconst rows = txQuery.data ?? [];';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([1]);
  });
});

describe('Kommentare (WP-9.6, Nachtrag)', () => {
  it('[REGRESSION] sollte einen Aufruf im Blockkommentar nicht melden', () => {
    // Gemeldet wurde ausgerechnet FinanceErrorState.tsx — dort steht das
    // Muster im Kommentar, der erklaert, warum es den Baustein gibt. Ein
    // Waechter, der seine eigene Begruendung als Verstoss liest, schickt jeden
    // auf eine falsche Faehrte.
    const content = '/**\n * Bis hierher: `const { data = [] } = useQuery(…)`.\n */\nexport const X = 1;';
    expect(analyze('src/components/common/Y.tsx', content)).toEqual({ violations: [], total: 0 });
  });

  it('sollte einen Aufruf im Zeilenkommentar nicht melden', () => {
    expect(analyze('src/pages/X.tsx', '// const { data } = useQuery({});').total).toBe(0);
  });

  it('sollte echten Code neben Kommentaren weiter finden', () => {
    const content = '// useQuery im Kommentar\nconst { data } = useQuery({});';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([2]);
  });
});

describe('[REGRESSION] Destrukturiert, aber nie benutzt (WP-9.6, Nachtrag 2)', () => {
  it('sollte einen ungenutzten Fehlerzustand NICHT als Behandlung durchgehen lassen', () => {
    // Der Waechter misst sonst die Schreibweise statt der Absicht: Ein
    // `isError`, das nirgends gelesen wird, legt die Meldung still, ohne dass
    // irgendein Fehler behandelt waere.
    const content = 'const { data = [], isError, refetch } = useQuery({});\nreturn <Liste items={data} />;';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([1]);
  });

  it('sollte den Unterstrich-Namen nie anerkennen', () => {
    // `_providerError` ist die uebliche Kennzeichnung fuer „absichtlich
    // ungenutzt" — sie ist ein Eingestaendnis, keine Behandlung.
    const content = 'const { data, isError: _providerError, refetch: _refetch } = useQuery({});\nconsole.log(data);';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([1]);
  });

  it('sollte den benutzten Fehlerzustand weiterhin anerkennen', () => {
    const content = 'const { data = [], isError: txError } = useQuery({});\nif (txError) return <Fehler />;';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([]);
  });

  it('sollte auch die unbenannte Form anerkennen, wenn sie gelesen wird', () => {
    const content = 'const { data, isError } = useQuery({});\nif (isError) return null;';
    expect(analyze('src/pages/X.tsx', content).violations).toEqual([]);
  });
});

/**
 * Die Ausnahmeliste unterscheidet seit dem Ende des Backlogs ZWEI Dinge, die
 * eine blosse Zahl nicht auseinanderhalten kann: „noch nicht gemacht" und
 * „bewusst so entschieden". Ohne diese Unterscheidung liest der Naechste jeden
 * Rest als Schuld — und baut dann Fehlerzustaende, die nachweislich toter Code
 * sind (AGENTS.md, „Absicht vor Auftrag").
 */
describe('Ausnahmeliste: Zahl vs. begruendeter Eintrag (WP-9.6)', () => {
  it('sollte beide Formen als Budget lesen', () => {
    expect(budgetOf(3)).toBe(3);
    expect(budgetOf({ count: 2, reason: 'weil das der Standard ist' })).toBe(2);
    expect(budgetOf(undefined)).toBe(0);
  });

  it('sollte den Grund nur bei der Objektform melden', () => {
    expect(reasonOf(3)).toBeNull();
    expect(reasonOf({ count: 1, reason: 'Voreinstellung mit Standard' })).toBe('Voreinstellung mit Standard');
  });

  it('sollte einen Objekt-Eintrag ohne tragfaehigen Grund abweisen', () => {
    // Sonst waere die neue Form nur eine Zahl mit Verkleidung: Wer „TODO"
    // hineinschreibt, hat nichts entschieden, sondern nur laenger getippt.
    const files = {
      'a.tsx': 1,
      'b.tsx': { count: 1, reason: 'ein hinreichend ausformulierter Grund' },
      'c.tsx': { count: 1, reason: 'TODO' },
      'd.tsx': { count: 1 },
    };
    expect(malformedEntries(files)).toEqual(['c.tsx', 'd.tsx']);
  });

  it('[REGRESSION] sollte fuer jeden Eintrag der echten Liste einen Grund haben', () => {
    // Das Backlog ist abgearbeitet: Was heute noch in der Liste steht, steht
    // dort mit Absicht. Faellt diese Zusage, ist eine Stelle durchgerutscht.
    const liste = JSON.parse(readFileSync(resolve(process.cwd(), 'query-error-allowlist.json'), 'utf8'));
    expect(malformedEntries(liste.files)).toEqual([]);
    const ohneGrund = Object.entries(liste.files as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === 'number')
      .map(([file]) => file);
    expect(ohneGrund).toEqual([]);
  });
});
