/**
 * Kein `useQuery` ohne Aussage zum Fehlerfall (WP-9.6).
 *
 * **Warum das eine eigene Regel braucht.** Das übliche Muster in diesem Repo
 * ist `const { data: txs = [] } = useQuery(…)`. Der Fallback `[]` ist bequem
 * und macht den Fehlerfall UNSICHTBAR: Scheitert die Abfrage, sieht die
 * Komponente eine leere Liste und zeigt ihren Leerzustand. Der Nutzer liest
 * „Noch keine Buchungen", obwohl seine Daten da sind und nur nicht gelesen
 * werden konnten (WP-9.1, Kernbefund).
 *
 * Das ist keine fehlende Rückmeldung, sondern eine **falsche Auskunft** — und
 * sie entsteht nicht durch Nachlässigkeit, sondern weil nichts danach fragt.
 * Genau das holt diese Regel nach.
 *
 * **Was als „behandelt" gilt.** Die Aufrufstelle muss den Fehlerzustand
 * überhaupt in die Hand nehmen: ihn destrukturieren (`isError`, `error`,
 * `status`) — üblicherweise, um ihn ins ViewModel zu heben — oder ihn per
 * `throwOnError` bewusst an eine Error Boundary abgeben. Was sie damit
 * ANFÄNGT, kann diese Prüfung nicht wissen; sie sorgt nur dafür, dass die
 * Frage gestellt wurde.
 *
 * **Was sie nicht prüft:** `useQueries` (dynamische Listen von Abfragen — die
 * Ergebnisse werden dort über `map` verarbeitet, ein Destrukturierungs-Muster
 * gibt es nicht) und Mutationen (`useMutation` hat `onError`, ein anderes
 * Thema).
 */

/** Felder, deren Vorhandensein zeigt, dass der Fehlerfall bedacht wurde. */
const ERROR_AWARE = ['isError', 'error', 'status', 'isLoadingError', 'failureReason'];

/**
 * Alle `useQuery`-Aufrufe einer Datei mit ihrer Destrukturierung.
 *
 * @returns {{ line: number, destructured: string | null, options: string }[]}
 */
/**
 * Ersetzt Kommentarinhalte durch Leerzeichen — Länge und Zeilenumbrüche
 * bleiben erhalten, damit Positionen und Zeilennummern gültig bleiben.
 *
 * [REGRESSION] Ohne das meldete der Wächter ausgerechnet
 * `FinanceErrorState.tsx`: Dort steht `const { data = [] } = useQuery(…)` im
 * Kommentar, der erklärt, warum es diesen Baustein gibt. Ein Wächter, der
 * seine eigene Begründung als Verstoß liest, schickt jeden auf eine falsche
 * Fährte.
 */
export function stripComments(source) {
  let out = '';
  let mode = 'code'; // code | line | block | single | double | template
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; out += '  '; i += 1; continue; }
      if (ch === '/' && next === '*') { mode = 'block'; out += '  '; i += 1; continue; }
      if (ch === "'") mode = 'single';
      else if (ch === '"') mode = 'double';
      else if (ch === '`') mode = 'template';
      out += ch;
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; out += ch; } else out += ' ';
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; out += '  '; i += 1; continue; }
      out += ch === '\n' ? ch : ' ';
      continue;
    }
    // In Zeichenketten: unveraendert uebernehmen, Escapes beachten.
    out += ch;
    if (ch === '\\') { out += source[i + 1] ?? ''; i += 1; continue; }
    if (
      (mode === 'single' && ch === "'") ||
      (mode === 'double' && ch === '"') ||
      (mode === 'template' && ch === '`')
    ) {
      mode = 'code';
    }
  }
  return out;
}

export function findQueryCalls(rawContent) {
  const content = stripComments(rawContent);
  const calls = [];
  const pattern = /\buseQuery\s*(?:<[^>]*>)?\s*\(/g;

  for (const match of content.matchAll(pattern)) {
    const callStart = match.index;
    const line = content.slice(0, callStart).split('\n').length;

    // Rückwärts bis zum `const … =` dieser Zuweisung. Bewusst mit einer
    // Obergrenze: Steht davor kein `const`, ist der Aufruf kein
    // Zuweisungsziel (etwa direkt in einem Argument) — dann gibt es auch
    // nichts zu destrukturieren.
    const before = content.slice(Math.max(0, callStart - 600), callStart);
    const constAt = before.lastIndexOf('const ');
    const destructured =
      constAt === -1 ? null : (before.slice(constAt).match(/const\s*\{([\s\S]*?)\}\s*=\s*$/)?.[1] ?? null);

    // Optionsobjekt für `throwOnError` — nur grob, es reicht die Erwähnung.
    const options = content.slice(callStart, callStart + 400);

    // `return useQuery(…)` reicht das VOLLSTÄNDIGE Ergebnis an den Aufrufer
    // durch — `isError` und `refetch` inklusive. Diese Stelle nimmt den
    // Fehlerfall nicht selbst in die Hand, sie gibt ihn weiter, und genau das
    // ist bei einem Hook das richtige Verhalten (AGENTS.md §3: Hooks binden
    // an, sie stellen nicht dar).
    //
    // Eng gefasst auf das unmittelbare `return`: `const q = useQuery(…);
    // return q.data;` reicht eben NICHT durch und bleibt ein Befund.
    const passthrough = /(^|[\s;{}])return\s*$/.test(before);

    // Zuweisung an einen Namen statt Destrukturierung:
    // `const txQuery = useQuery(…)`. Ob DIESE Stelle den Fehlerfall in die
    // Hand nimmt, entscheidet sich dann weiter unten an `txQuery.isError` —
    // beurteilt wird das in `analyzeQueryErrors`, wo der ganze Dateiinhalt
    // vorliegt. Sammelt eine Seite mehrere Abfragen zu EINER Aussage
    // zusammen, ist das die bessere Lösung als vier Fehlermeldungen für
    // dieselbe Ursache — der Wächter darf sie nicht verhindern.
    const boundName = constAt === -1 ? null : (before.slice(constAt).match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*$/)?.[1] ?? null);

    calls.push({ line, destructured, options, passthrough, boundName });
  }

  return calls;
}

/** Nimmt diese Aufrufstelle den Fehlerfall in die Hand? */
export function handlesError(call) {
  if (/throwOnError/.test(call.options)) return true;
  if (call.passthrough) return true;
  if (!call.destructured) return false;
  return ERROR_AWARE.some((field) => new RegExp(`\\b${field}\\b`).test(call.destructured));
}

/**
 * Wird der Fehlerzustand über den gebundenen Namen gelesen?
 *
 * `const txQuery = useQuery(…)` … später `txQuery.isError` — oder gesammelt
 * über eine Liste: `const queries = [txQuery, …]; queries.some(q => q.isError)`.
 * Die zweite Form ist bei Seiten mit mehreren Abfragen die bessere: Fehlt eine
 * davon, ist die Aussage der Seite nicht mehr rechenbar, und vier getrennte
 * Fehlermeldungen für dieselbe Ursache wären vier Rätsel statt eines Hinweises.
 */
export function readsErrorFromBinding(call, content) {
  if (!call.boundName) return false;
  const name = call.boundName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Direkt: `txQuery.isError`
  if (ERROR_AWARE.some((field) => new RegExp(`\\b${name}\\.${field}\\b`).test(content))) return true;
  // Gesammelt: Der Name steht in einem Array, ueber das `.isError` geprueft
  // wird. Bewusst grob — die Alternative waere, die Zusammenfassung zu
  // verbieten, und die ist hier gerade das gewuenschte Verhalten.
  const inArray = new RegExp(`\\[[^\\]]*\\b${name}\\b[^\\]]*\\]`).test(content);
  return inArray && ERROR_AWARE.some((field) => new RegExp(`\\.${field}\\b`).test(content));
}

/** Tests, Storybook und die Testhilfen sind ausgenommen. */
export function isExemptFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return (
    normalized.includes('/__tests__/') ||
    normalized.includes('/test-utils/') ||
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.test.tsx')
  );
}

/**
 * @returns {{ violations: number[], total: number }} Zeilennummern der
 *   Aufrufe ohne Aussage zum Fehlerfall.
 */
export function analyzeQueryErrors(relativePath, content) {
  if (isExemptFile(relativePath)) return { violations: [], total: 0 };

  const calls = findQueryCalls(content);
  return {
    violations: calls
      .filter((call) => !handlesError(call) && !readsErrorFromBinding(call, content))
      .map((call) => call.line),
    total: calls.length,
  };
}
