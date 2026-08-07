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
export function findQueryCalls(content) {
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

    calls.push({ line, destructured, options });
  }

  return calls;
}

/** Nimmt diese Aufrufstelle den Fehlerfall in die Hand? */
export function handlesError(call) {
  if (/throwOnError/.test(call.options)) return true;
  if (!call.destructured) return false;
  return ERROR_AWARE.some((field) => new RegExp(`\\b${field}\\b`).test(call.destructured));
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
    violations: calls.filter((call) => !handlesError(call)).map((call) => call.line),
    total: calls.length,
  };
}
