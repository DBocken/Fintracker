/**
 * Wächter für den Wächter (WP-12.1).
 *
 * Der Anlass steht in `scripts/state-coverage-core.mjs`: 71 % Zeilenabdeckung,
 * und `/debts` behauptete nach einem Lesefehler trotzdem „Noch keine
 * Schulden". Eine Prozentzahl zählt Zeilen, dieser Wächter zählt Aussagen —
 * und wenn er selbst falsch zählt, ist er schlimmer als keiner, weil er
 * Sicherheit vortäuscht.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — reines JS-Waechterskript ohne Typen; hier bewusst so eingebunden, statt scripts/ in die tsconfig zu ziehen.
import { parseRoutes, findStateTags, collectCoverage, analyzeStateCoverage, malformedWaivers, isDeclaration, isOwnFixture, REQUIRED_STATES, KNOWN_STATES } from '../../../scripts/state-coverage-core.mjs';

const REPO = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(REPO, p), 'utf8');

describe('Routenliste einlesen', () => {
  it('sollte alle Routen aus dem Fixture lesen', () => {
    const routes = parseRoutes(read('e2e-tests/fixtures/routes.ts'));
    expect(routes).toContain('/debts');
    expect(routes).toContain('/dashboard');
    expect(routes.length).toBeGreaterThanOrEqual(22);
  });

  it('sollte den Kommentarkopf nicht fuer Routen halten', () => {
    // Der Kopf des Fixtures enthaelt Pfade im Fliesstext; nur der Inhalt von
    // ALL_ROUTES zaehlt.
    const routes = parseRoutes(read('e2e-tests/fixtures/routes.ts'));
    expect(routes.every((r: string) => r.startsWith('/'))).toBe(true);
    expect(routes).not.toContain('/');
  });
});

describe('Zustands-Tags im Testtitel', () => {
  it('sollte Route und Zustand herausloesen', () => {
    const quelle = "it('[ZUSTAND /debts:fehler] sollte …', () => {})";
    expect(findStateTags(quelle)).toEqual([
      { route: '/debts', state: 'fehler', line: 1, source: quelle },
    ]);
  });

  it('sollte Leerraum im Tag vertragen', () => {
    expect(findStateTags('[ZUSTAND  /net-worth : leer ]')[0]).toMatchObject({
      route: '/net-worth',
      state: 'leer',
    });
  });

  it('sollte mehrere Tags einer Datei finden und die Zeile mitfuehren', () => {
    const tags = findStateTags('[ZUSTAND /tax:leer]\n\n[ZUSTAND /tax:fehler]');
    expect(tags.map((t: { line: number }) => t.line)).toEqual([1, 3]);
  });

  it('sollte einen vertippten Zustand melden statt ihn zu verschlucken', () => {
    // Ein „fehle" statt „fehler" wuerde sonst still als „nicht angemeldet"
    // durchgehen — und der Autor haelt die Flaeche fuer geprueft.
    const { unknownStates, byRoute } = collectCoverage([
      { path: 'x.test.tsx', content: "it('[ZUSTAND /debts:fehle] …', () => {})", routes: ['/debts'] },
    ]);
    expect(unknownStates).toHaveLength(1);
    expect(byRoute.get('/debts')).toBeUndefined();
  });

  it('sollte ein Tag auf eine unbekannte Route melden', () => {
    const { unknownRoutes } = collectCoverage([
      { path: 'x.test.tsx', content: "it('[ZUSTAND /gibtsnicht:leer] …', () => {})", routes: ['/debts'] },
    ]);
    expect(unknownRoutes).toHaveLength(1);
  });
});

describe('Abgleich gegen die Ausnahmeliste', () => {
  const routes = ['/a', '/b'];

  it('sollte eine ungeprueft und ungelistete Flaeche melden', () => {
    const { missing } = analyzeStateCoverage(routes, new Map(), { routes: {} });
    expect(missing).toEqual(['/a:leer', '/a:fehler', '/b:leer', '/b:fehler']);
  });

  it('sollte gelistete Luecken durchgehen lassen', () => {
    const list = { routes: { '/a': { offen: ['leer', 'fehler'] }, '/b': { offen: ['leer', 'fehler'] } } };
    expect(analyzeStateCoverage(routes, new Map(), list).missing).toEqual([]);
  });

  it('sollte einen erledigten, aber noch als offen gefuehrten Eintrag melden', () => {
    // Sonst versteckt die Liste den naechsten echten Befund — dieselbe
    // Gegenrichtung wie bei check:query-errors.
    const byRoute = new Map([['/a', new Set(['leer', 'fehler'])]]);
    const list = { routes: { '/a': { offen: ['fehler'] }, '/b': { offen: ['leer', 'fehler'] } } };
    expect(analyzeStateCoverage(routes, byRoute, list).stale).toEqual(['/a:fehler']);
  });

  it('sollte einen begruendet entfallenen Zustand nicht verlangen', () => {
    const byRoute = new Map([['/a', new Set(['fehler'])]]);
    const list = {
      routes: {
        '/a': { entfaellt: { leer: 'zeigt immer Bedienelemente, nie Nutzerdaten' } },
        '/b': { offen: ['leer', 'fehler'] },
      },
    };
    const result = analyzeStateCoverage(routes, byRoute, list);
    expect(result.missing).toEqual([]);
    // Der entfallene Zustand zaehlt auch nicht als Pflicht mit.
    expect(result.required).toBe(3);
    expect(result.covered).toBe(1);
  });

  it('sollte eine Route melden, die es nicht mehr gibt', () => {
    const list = { routes: { '/weg': { offen: ['leer'] } } };
    expect(analyzeStateCoverage([], new Map(), list).orphans).toEqual(['/weg']);
  });

  it('sollte "entfaellt" ohne tragfaehigen Grund abweisen', () => {
    // Ohne diese Pruefung waere die Form nur eine Luecke mit Verkleidung —
    // dieselbe Lehre wie bei der Query-Ausnahmeliste.
    expect(
      malformedWaivers({
        '/a': { entfaellt: { leer: 'zeigt immer Bedienelemente, nie Nutzerdaten' } },
        '/b': { entfaellt: { leer: 'TODO' } },
        '/c': { entfaellt: { fehler: '' } },
      }),
    ).toEqual(['/b:leer', '/c:fehler']);
  });
});

describe('Die echte Liste', () => {
  const allowlist = JSON.parse(read('state-coverage-allowlist.json'));
  const routes = parseRoutes(read('e2e-tests/fixtures/routes.ts'));

  it('sollte nur bekannte Routen und Zustaende fuehren', () => {
    for (const [route, entry] of Object.entries(allowlist.routes) as [string, Record<string, unknown>][]) {
      expect(routes, route).toContain(route);
      for (const state of (entry.offen as string[]) ?? []) expect(KNOWN_STATES, `${route}:${state}`).toContain(state);
      for (const state of Object.keys((entry.entfaellt as object) ?? {})) {
        expect(REQUIRED_STATES, `${route}:${state}`).toContain(state);
      }
    }
  });

  it('sollte jeden Verzicht begruenden', () => {
    expect(malformedWaivers(allowlist.routes)).toEqual([]);
  });

  it('[REGRESSION] sollte einen Zustand nie gleichzeitig als offen und entfallen fuehren', () => {
    // Beides zusammen ist widerspruechlich: Entweder fehlt der Test noch, oder
    // er wird nie gebraucht. Die Doppelung wuerde die Zaehlung verfaelschen.
    for (const [route, entry] of Object.entries(allowlist.routes) as [string, Record<string, unknown>][]) {
      const offen = new Set(((entry.offen as string[]) ?? []));
      for (const state of Object.keys((entry.entfaellt as object) ?? {})) {
        expect(offen.has(state), `${route}:${state}`).toBe(false);
      }
    }
  });
});

describe('Was als Anmeldung zaehlt', () => {
  it.each([
    ["it('[ZUSTAND /a:leer] …'", true],
    ["  it('[ZUSTAND /a:leer] …', async () => {", true],
    ["it.each([['de']])('[ZUSTAND /a:leer] …'", true],
    ['// [ZUSTAND /a:leer] — nur ein Kommentar', false],
    ["const beispiel = '[ZUSTAND /a:leer]';", false],
    ["describe('[ZUSTAND /a:leer] …'", false],
  ])('sollte %j als Anmeldung %s werten', (zeile, erwartet) => {
    // `describe` zaehlt bewusst NICHT: Der Zustand gehoert an den einzelnen
    // Test, sonst behauptet eine Gruppe Abdeckung fuer alles darin.
    expect(isDeclaration(zeile)).toBe(erwartet);
  });

  it('[REGRESSION] sollte die eigenen Pruefdaten nicht als Abdeckung zaehlen', () => {
    // Diese Datei enthaelt absichtlich Tags in echter Titelform. Ohne die
    // Ausnahme meldete der Waechter bei jedem Lauf seine eigenen Beispiele —
    // derselbe Fehler wie damals bei check:query-errors, das ausgerechnet
    // FinanceErrorState.tsx meldete, weil das Muster in dessen Begruendung steht.
    expect(isOwnFixture(read('src/lib/__tests__/state-coverage.test.ts'))).toBe(true);
    expect(isOwnFixture("it('[ZUSTAND /debts:fehler] …')")).toBe(false);
  });
});
