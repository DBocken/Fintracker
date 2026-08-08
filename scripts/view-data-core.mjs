/**
 * Kernlogik des Ansicht/Daten-Wächters (AGENTS.md §3 und §4).
 *
 * Er zählt, wie viele Datenzugriffe noch IN der Darstellungsschicht stehen —
 * `useQuery`/`useMutation` und direkte Service-Importe in `src/components/`
 * und `src/pages/`.
 *
 * **Warum das ein eigener Wächter ist und nicht Teil von `check:layers`.** Der
 * Schicht-Wächter prüft eine *Richtung*: Was hier passiert, ist keine falsche
 * Richtung — eine Komponente DARF laut §3 einen Service benutzen. Der Befund
 * ist ein anderer: Solange eine Fläche ihre eigene Datenschicht IST, lässt sich
 * keine zweite Präsentation danebenstellen, ohne die Datenbeschaffung ein
 * zweites Mal zu schreiben. Genau das ist das Versprechen aus §4
 * („gleiche Daten, gleiche Berechnungen, gleiches ViewModel").
 *
 * Deshalb ist die Zahl kein Verbot, sondern eine **Ratsche**: Sie darf nur
 * sinken. Ein Verbot wäre hier falsch — 22 von 26 Routen sind noch nicht
 * zerlegt, und ein Wächter, der ab morgen jeden Commit blockiert, wird
 * abgeschaltet statt befolgt.
 *
 * Nicht gezählt wird, was gar keine Fläche ist: `src/features/<slice>/application`
 * (dort GEHÖRT der Zugriff hin), Tests, und die Provider-/Gate-Bausteine, die
 * definitionsgemäß Infrastruktur tragen.
 */

/** Zugriffe, die eine Fläche zu ihrer eigenen Datenschicht machen. */
const QUERY_CALL = /\b(useQuery|useMutation|useInfiniteQuery|useQueries)\s*[(<]/g;

/** Direkter Griff in die I/O-Schicht, am Import erkannt. */
const SERVICE_IMPORT = /^\s*import\s[^;]*?from\s+['"](?:@\/services\/|(?:\.\.\/)+services\/)[^'"]+['"]/;

/**
 * Bausteine, deren Aufgabe Infrastruktur IST — sie tragen den Zugriff
 * absichtlich und werden nicht mitgezählt.
 *
 * Exportiert, weil derselbe Begriff auch beim Schicht-Wächter gebraucht wird
 * (`hooks-ohne-components` in `layers-core.mjs`, AGENTS.md §3/ARCH-4): ein
 * Hook, der einen Context liest (`useAuth` aus `AuthProvider`), ist Provider-
 * Infrastruktur, kein Fachdaten-Zugriff — dasselbe Kriterium wie hier, also
 * ein Prädikat statt zwei.
 */
export function istInfrastruktur(relPath) {
  return (
    /\/providers\//.test(relPath) ||
    /Provider\.tsx$/.test(relPath) ||
    /\/FeatureGate\.tsx$/.test(relPath) ||
    /\/ErrorBoundary\.tsx$/.test(relPath)
  );
}

/** Nur die Darstellungsschicht wird gezählt. */
export function istDarstellung(relPath) {
  if (!/^src\/(components|pages)\//.test(relPath)) return false;
  if (relPath.includes('__tests__/')) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(relPath)) return false;
  return !istInfrastruktur(relPath);
}

/** Entfernt Zeilenkommentare, damit ein erklärendes `useQuery` nicht zählt. */
function ohneKommentar(line) {
  const idx = line.indexOf('//');
  return idx >= 0 ? line.slice(0, idx) : line;
}

/**
 * Zählt Datenzugriffe in einer Datei der Darstellungsschicht.
 *
 * @param relPath repo-relativer Pfad
 * @param source  Dateiinhalt
 * @returns `{ queries, serviceImports, total }`
 */
export function countDataAccess(relPath, source) {
  if (!istDarstellung(relPath)) return { queries: 0, serviceImports: 0, total: 0 };

  let queries = 0;
  let serviceImports = 0;
  let imBlockkommentar = false;

  for (const rohzeile of source.split('\n')) {
    const zeile = rohzeile.trim();

    if (imBlockkommentar) {
      if (zeile.includes('*/')) imBlockkommentar = false;
      continue;
    }
    // Erst ueberspringen, DANN merken: Ein einzeiliger Block `/* … */` schliesst
    // sich selbst und wuerde sonst durchfallen und mitgezaehlt werden.
    if (zeile.startsWith('/*')) {
      if (!zeile.includes('*/')) imBlockkommentar = true;
      continue;
    }
    if (zeile.startsWith('//') || zeile.startsWith('*')) continue;

    const code = ohneKommentar(zeile);
    if (SERVICE_IMPORT.test(code)) {
      serviceImports++;
      continue;
    }
    // `import { useQuery } from '@tanstack/react-query'` ist der Import, nicht
    // der Zugriff — sonst zaehlte jede Datei einmal zu viel.
    if (/^import\b/.test(code)) continue;

    queries += (code.match(QUERY_CALL) ?? []).length;
  }

  return { queries, serviceImports, total: queries + serviceImports };
}
