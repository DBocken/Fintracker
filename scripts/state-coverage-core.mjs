/**
 * „Ein Test je Fläche und Zustand" (WP-12.1).
 *
 * **Warum die Zeilenabdeckung das nicht beantwortet.** 71 % der Zeilen laufen
 * unter einem Test — und trotzdem hat `/debts` nach einem Lesefehler
 * „Noch keine Schulden" gezeigt. Entwarnung, wo keine war. Für genau diese
 * Seite gab es Tests, sie waren grün, und sie prüften, DASS gerendert wird,
 * nicht WAS behauptet wird. Eine Prozentzahl kann diesen Unterschied nicht
 * sehen; sie zählt Zeilen, nicht Aussagen.
 *
 * Deshalb misst dieser Wächter etwas anderes: Nimmt jede Fläche zu jedem
 * Zustand, den sie einnehmen kann, in einem Test Stellung? Rot wird ein Test
 * erst, wenn er den falschen Zustand vom richtigen unterscheiden kann.
 *
 * **Wie eine Fläche ihren Zustand anmeldet.** Über einen Tag im Testtitel, in
 * derselben Bauart wie `[REGRESSION]`/`[SECURITY]` (AGENTS.md §5):
 *
 *     it('[ZUSTAND /debts:fehler] sollte den Ladefehler benennen statt …')
 *
 * **Was dieser Wächter NICHT kann.** Ob der Test hinter dem Tag etwas
 * Belastbares prüft, weiss er nicht — genauso wenig wie `check:query-errors`
 * weiss, was eine Aufrufstelle mit `isError` anfängt. Er sorgt dafür, dass die
 * Frage je Fläche und Zustand überhaupt gestellt wurde, und macht die Lücken
 * zählbar, statt sie hinter einer Prozentzahl verschwinden zu lassen. Ein Tag
 * auf einem Test, der nichts prüft, ist eine Unwahrheit mit Absender — und
 * damit etwas anderes als eine Luecke, die niemand bemerkt.
 */

/** Alle Zustände aus der Zustands-Matrix (WP-9.1). */
export const KNOWN_STATES = ['geladen', 'leer', 'gefiltert-leer', 'fehler'];

/**
 * Pflicht für jede Fläche: `leer` und `fehler`.
 *
 * Diese beiden sind es, die eine FALSCHE Aussage erzeugen können, und sie
 * sehen einander zum Verwechseln ähnlich — der ganze Befund aus WP-9.1. Ob
 * etwas ueberhaupt rendert (`geladen`), pruefen die Bestandstests ohnehin;
 * `gefiltert-leer` gibt es nur, wo gefiltert wird, und wird deshalb je Fläche
 * angemeldet statt pauschal verlangt.
 */
export const REQUIRED_STATES = ['leer', 'fehler'];

/** Die Routenliste aus `e2e-tests/fixtures/routes.ts` — EINE Quelle für alle Flächenprüfungen. */
export function parseRoutes(source) {
  const block = source.match(/ALL_ROUTES\s*=\s*\[([\s\S]*?)\]/)?.[1];
  if (!block) return [];
  return [...block.matchAll(/["'`](\/[^"'`]*)["'`]/g)].map((m) => m[1]);
}

/**
 * Alle Zustands-Anmeldungen einer Testdatei.
 *
 * Bewusst tolerant gegenüber Leerraum, aber nicht gegenüber der Schreibweise:
 * Ein vertippter Zustand soll auffallen (`unknownStates`), nicht still als
 * „nicht angemeldet" durchgehen.
 */
export function findStateTags(content) {
  const tags = [];
  const lines = content.split('\n');
  for (const match of content.matchAll(/\[ZUSTAND\s+(\/[\w/-]*)\s*:\s*([\w-]+)\s*\]/g)) {
    const line = content.slice(0, match.index).split('\n').length;
    tags.push({ route: match[1], state: match[2], line, source: lines[line - 1] ?? '' });
  }
  return tags;
}

/**
 * Zählt dieser Fund als Anmeldung — steht er im TITEL eines Tests?
 *
 * [REGRESSION] Ohne diese Frage zählte der Wächter seine eigenen Beispiele
 * mit: In `state-coverage.test.ts` stehen Zeichenketten wie
 * `'[ZUSTAND /tax:leer]'` als Prüfdaten, und er las sie als echte Abdeckung
 * für `/tax`. Derselbe Fehler wie damals bei `check:query-errors`, das
 * ausgerechnet `FinanceErrorState.tsx` meldete, weil das Muster in dessen
 * Begründung steht. Ein Wächter, der seine eigene Erklärung als Messwert
 * liest, misst sich selbst.
 *
 * Der Nebeneffekt ist der eigentliche Gewinn: Ein Tag in einem Kommentar oder
 * einer Hilfskonstante zählt jetzt auch nicht mehr. Angemeldet ist nur, was
 * als Test benannt ist.
 */
export function isDeclaration(source) {
  return /\b(it|test)\s*(\.\s*(each|only|skip|todo|concurrent)\s*(\(|`)?)?\s*\(/.test(source);
}

/**
 * Die Tests DIESES Wächters sind ausgenommen.
 *
 * Sie müssen Beispiel-Tags in echter Testtitel-Form enthalten — einen
 * vertippten Zustand, eine Route, die es nicht gibt —, sonst liesse sich nicht
 * prüfen, dass beides gemeldet wird. Gemessen werden dürfen sie nicht: Sonst
 * meldet der Wächter bei jedem Lauf seine eigenen Prüfdaten als Befund.
 *
 * Erkannt am Import des Kerns, nicht am Dateinamen — nur ein Test DIESES
 * Wächters importiert ihn, und die Ausnahme wandert von selbst mit, wenn die
 * Datei umbenannt wird.
 */
export function isOwnFixture(content) {
  return /from\s+["'][^"']*state-coverage-core\.mjs["']/.test(content);
}

/** Angemeldete Zustände je Route, aus allen Testdateien zusammengetragen. */
export function collectCoverage(files) {
  const byRoute = new Map();
  const unknownStates = [];
  const unknownRoutes = [];

  for (const { path: file, content, routes } of files) {
    if (isOwnFixture(content)) continue;
    for (const tag of findStateTags(content)) {
      if (!isDeclaration(tag.source)) continue;
      if (!KNOWN_STATES.includes(tag.state)) {
        unknownStates.push({ file, ...tag });
        continue;
      }
      if (routes && !routes.includes(tag.route)) {
        unknownRoutes.push({ file, ...tag });
        continue;
      }
      if (!byRoute.has(tag.route)) byRoute.set(tag.route, new Set());
      byRoute.get(tag.route).add(tag.state);
    }
  }

  return { byRoute, unknownStates, unknownRoutes };
}

/** Zahl oder Objekt — die Ausnahmeliste kennt zwei Formen (siehe unten). */
function openStates(entry) {
  return entry?.offen ?? [];
}

function waivedStates(entry) {
  return Object.keys(entry?.entfaellt ?? {});
}

/**
 * Ein `entfaellt`-Eintrag ohne tragfähigen Grund ist eine Luecke mit
 * Verkleidung — dieselbe Lehre wie bei `query-error-allowlist.json`.
 */
export function malformedWaivers(routes) {
  const bad = [];
  for (const [route, entry] of Object.entries(routes ?? {})) {
    for (const [state, reason] of Object.entries(entry?.entfaellt ?? {})) {
      if (typeof reason !== 'string' || reason.trim().length < 10) bad.push(`${route}:${state}`);
    }
  }
  return bad;
}

/**
 * @returns {{ missing: string[], stale: string[], covered: number, required: number }}
 *   `missing` = nicht angemeldet und nicht in der Liste. `stale` = in der Liste
 *   als offen geführt, obwohl es längst einen Test gibt — solche Einträge
 *   verstecken den nächsten echten Befund.
 */
export function analyzeStateCoverage(allRoutes, byRoute, allowlist) {
  const listed = allowlist?.routes ?? {};
  const missing = [];
  const stale = [];
  let covered = 0;
  let required = 0;

  for (const route of allRoutes) {
    const entry = listed[route];
    const waived = waivedStates(entry);
    const open = openStates(entry);
    const tested = byRoute.get(route) ?? new Set();

    for (const state of REQUIRED_STATES) {
      if (waived.includes(state)) continue;
      required += 1;
      if (tested.has(state)) {
        covered += 1;
        if (open.includes(state)) stale.push(`${route}:${state}`);
        continue;
      }
      if (!open.includes(state)) missing.push(`${route}:${state}`);
    }

    // Freiwillige Zustände: angemeldet werden duerfen sie immer, verlangt
    // werden sie nie — sonst entstuende Druck, `gefiltert-leer` auch dort zu
    // behaupten, wo gar nicht gefiltert wird.
    for (const state of tested) {
      if (!REQUIRED_STATES.includes(state)) covered += 0;
    }
  }

  // Eine Route, die es nicht mehr gibt, gehoert nicht in die Liste.
  const orphans = Object.keys(listed).filter((route) => !allRoutes.includes(route));

  return { missing, stale, orphans, covered, required };
}
