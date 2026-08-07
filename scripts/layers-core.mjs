/**
 * Kernlogik des Schicht-Wächters (AGENTS.md §3).
 *
 * Bewusst getrennt vom Runner `check-layers.mjs`, damit sie ohne Dateisystem
 * und ohne Prozess-Exit testbar ist (`scripts/__tests__/layers-core.test.mjs`)
 * — dieselbe Aufteilung wie bei `test-structure-core.mjs`.
 */

import path from 'node:path';

/**
 * Regeln, jeweils: welche Dateien betroffen sind, was sie NICHT importieren
 * dürfen, und warum. Die Begründung landet in der Fehlermeldung — ein Wächter,
 * der nur „verboten" sagt, wird umgangen statt verstanden.
 */
export const RULES = [
  {
    id: 'lib-rein',
    appliesTo: (rel) => rel.startsWith('src/lib/'),
    forbids: (target) => /^src\/(services|hooks|components|pages|features)\//.test(target),
    why: '`src/lib/` ist reine Domänen- und Berechnungslogik: kein React, kein I/O, keine Feature-Bindung. Gehört der Typ oder die Funktion zur Domäne, wandert sie nach unten in `src/lib/`; braucht der Code wirklich I/O, gehört er selbst nach `src/services/`.',
  },
  {
    id: 'services-ohne-ui',
    appliesTo: (rel) => rel.startsWith('src/services/'),
    // Feature-`domain` ist selbst reine Fachlogik und liegt damit auf der
    // Höhe von `lib` — ein Service darf sie benutzen.
    forbids: (target) =>
      /^src\/(hooks|components|pages)\//.test(target) ||
      /^src\/features\/[^/]+\/(data|application|presentation)\//.test(target),
    why: '`src/services/` kapselt I/O und darf die Oberfläche nicht kennen. Ein Typ, den Service und Komponente teilen, gehört nach `src/lib/` (oder in die `domain` des Slices).',
  },
  {
    id: 'components-ohne-pages',
    appliesTo: (rel) => rel.startsWith('src/components/'),
    forbids: (target) => /^src\/pages\//.test(target),
    why: '`src/pages/` sind dünne Routen-Einstiege und stehen über den Komponenten. Gemeinsames wandert nach `src/components/` oder `src/lib/`.',
  },
  {
    id: 'feature-domain-rein',
    appliesTo: (rel) => /^src\/features\/[^/]+\/domain\//.test(rel),
    forbids: (target) =>
      /^src\/(services|hooks|components|pages)\//.test(target) ||
      /^src\/features\/[^/]+\/(data|application|presentation)\//.test(target),
    why: 'Die `domain` eines Slices ist sein reiner Kern (AGENTS.md §3, docs/architecture/feature-structure.md). Wird ein Typ von Slice und Service gebraucht, gehört er nach `src/lib/`; brauchen ihn mehrere Slices, nach `src/features/shared/`.',
  },
  {
    id: 'feature-data-ohne-ui',
    appliesTo: (rel) => /^src\/features\/[^/]+\/data\//.test(rel),
    forbids: (target) =>
      /^src\/(components|pages)\//.test(target) ||
      /^src\/features\/[^/]+\/(application|presentation)\//.test(target),
    why: 'Die `data`-Schicht eines Slices liefert Daten nach oben und darf nicht zurückgreifen.',
  },
  {
    id: 'feature-application-ohne-presentation',
    appliesTo: (rel) => /^src\/features\/[^/]+\/application\//.test(rel),
    forbids: (target) => /^src\/features\/[^/]+\/presentation\//.test(target),
    why: 'Das ViewModel eines Slices kennt seine Darstellung nicht — sonst lässt es sich nicht für Desktop und Mobile gemeinsam nutzen (AGENTS.md §4).',
  },
];

/**
 * Tests sind ausgenommen: ein Test in `lib/__tests__/` darf einen Service
 * heranziehen, um das Zusammenspiel zu prüfen — das ist die Absicht des Tests,
 * keine Abhängigkeit des Produktionscodes.
 */
export function isTestFile(rel) {
  return (
    rel.includes('__tests__/') ||
    /\.(test|spec)\.tsx?$/.test(rel) ||
    rel.startsWith('src/test-utils/')
  );
}

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Blendet Kommentare aus, damit ein Beispiel-Import im Doc-Kommentar nicht zählt. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Löst einen Import-Spezifizierer auf einen repo-relativen `src/…`-Pfad auf.
 * Liefert `null` für externe Pakete (die interessieren hier nicht).
 */
export function resolveTarget(spec, fromRel) {
  let resolved;
  if (spec.startsWith('@/')) {
    resolved = path.posix.join('src', spec.slice(2));
  } else if (spec.startsWith('.')) {
    resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  } else {
    return null;
  }
  return resolved.startsWith('src/') ? resolved : null;
}

/**
 * Prüft eine einzelne Datei.
 *
 * @param rel        repo-relativer Pfad, POSIX-Trenner
 * @param source     Dateiinhalt
 * @param exception  Eintrag aus `layer-allowlist.json` für diese Datei (oder undefined)
 * @returns {{violations: Array, usedExceptions: string[]}}
 */
export function analyzeFile(rel, source, exception) {
  const violations = [];
  const usedExceptions = [];
  if (isTestFile(rel)) return { violations, usedExceptions };

  const rules = RULES.filter((r) => r.appliesTo(rel));
  if (rules.length === 0) return { violations, usedExceptions };

  for (const match of stripComments(source).matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    const target = resolveTarget(spec, rel);
    if (!target) continue;

    for (const rule of rules) {
      if (!rule.forbids(target)) continue;
      if (exception?.imports?.includes(spec)) {
        usedExceptions.push(spec);
        continue;
      }
      violations.push({ file: rel, spec, target, ruleId: rule.id, why: rule.why });
    }
  }

  return { violations, usedExceptions };
}
