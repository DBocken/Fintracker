/**
 * Plattform-Parität, der maschinell prüfbare Teil (AGENTS.md §4).
 *
 * **Was die Regel eigentlich sagt** — „Jedes Feature muss in beiden Varianten
 * existieren" — ist eine Aussage über BEDEUTUNG und damit nicht prüfbar. Ob
 * eine Desktop-Tabelle und eine Mobil-Kartenliste dasselbe Feature sind,
 * entscheidet niemand über Klassennamen.
 *
 * **Was prüfbar ist**, ist die schwächere, aber scharfe Teilaussage: Eine
 * Fläche, die per `hidden <bp>:*` ab einem Breakpoint erscheint, ist unterhalb
 * davon NICHT DA. Wenn im selben Bauteil nirgends ein `<bp>:hidden` steht, gibt
 * es dort auch kein Gegenstück — dann ist das kein Dichte-Unterschied, sondern
 * ein fehlendes Feature.
 *
 * Genau dieser Fall lag in der Geldfluss-Visualisierung vor (WP-8.3): Die
 * Export-Reihe trug `hidden sm:flex` ohne jedes Gegenstück, und auf dem Telefon
 * gab es den Export schlicht nicht.
 *
 * **Die Grenze, bewusst so.** Das Gegenstück darf in einer NACHBARDATEI liegen
 * — `TransactionTable` (Desktop) und `TransactionListMobile` sind getrennte
 * Bauteile, und das ist gut so. Solche Paare stehen in der Ausnahmeliste, mit
 * Nennung des Partners. Eine Prüfung, die versucht, das Paar automatisch zu
 * finden, müsste raten; eine Regel mit Fehlalarmen wird abgeschaltet.
 */

import { stripComments } from './layers-core.mjs';

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl'];

/**
 * `hidden <bp>:<display>` — die Fläche ist erst ab dem Breakpoint da.
 *
 * Die Display-Werte sind aufgezählt statt `\w+`, damit `hidden md:opacity-50`
 * (eine reine Gestaltungsänderung an einer ohnehin versteckten Fläche) nicht
 * als Weiche zählt.
 */
const HIDE_BELOW = new RegExp(
  String.raw`\bhidden\s+(${BREAKPOINTS.join('|')}):(block|flex|grid|inline|inline-flex|inline-block|table|table-cell|table-row|contents|list-item)\b`,
  'g',
);

/** `<bp>:hidden` — die Fläche verschwindet ab dem Breakpoint. Das Gegenstück. */
const HIDE_ABOVE = new RegExp(String.raw`\b(${BREAKPOINTS.join('|')}):hidden\b`, 'g');

/**
 * Welche Breakpoints in dieser Datei eine Fläche einblenden, ohne dass an
 * derselben Stelle etwas ausgeblendet würde.
 *
 * @returns {string[]} Breakpoints ohne Gegenstück, aufsteigend. Leer = in
 *   Ordnung.
 */
export function unpairedBreakpoints(content) {
  // Kommentare zaehlen nicht. Der Waechter las bis hierher den ROHEN
  // Quelltext, und damit war ein erklaerender Satz ein Befund: Die
  // Coach-Fläche wurde gemeldet, weil ihr Kopfkommentar `hidden lg:block`
  // ZITIERTE — die Klasse, die dort gerade ABGESCHAFFT worden war. Ein
  // Waechter, den man durch Dokumentieren ausloest, erzieht zum Schweigen.
  //
  // `check:i18n`, `check:query-errors`, `check:external-endpoints` und
  // `check:touch-targets` blenden Kommentare laengst aus; hier fehlte es.
  // Derselbe Baustein wie bei `check:layers` und `check:slice-presentation`,
  // statt eines vierten eigenen Ausdrucks.
  const sichtbar = stripComments(content);

  const shown = new Set();
  for (const match of sichtbar.matchAll(HIDE_BELOW)) shown.add(match[1]);
  if (shown.size === 0) return [];

  const hidden = new Set();
  for (const match of sichtbar.matchAll(HIDE_ABOVE)) hidden.add(match[1]);

  return BREAKPOINTS.filter((bp) => shown.has(bp) && !hidden.has(bp));
}

/**
 * Dateien, für die die Prüfung nicht gilt.
 *
 * Die UI-Primitiven definieren Bausteine, statt Features zu zeigen — ein
 * `hidden sm:block` in einem `Sheet` ist Mechanik, keine Produktentscheidung.
 */
export function isExemptFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return (
    normalized.includes('/__tests__/') ||
    normalized.includes('/components/ui/') ||
    normalized.endsWith('.test.tsx')
  );
}

/**
 * Ein Befund je Datei, oder `null`.
 *
 * @returns {{ violates: boolean, breakpoints: string[], reason: string | null }}
 */
export function analyzeParity(relativePath, content) {
  if (isExemptFile(relativePath)) {
    return { violates: false, breakpoints: [], reason: null };
  }

  const breakpoints = unpairedBreakpoints(content);
  if (breakpoints.length === 0) {
    return { violates: false, breakpoints: [], reason: null };
  }

  return {
    violates: true,
    breakpoints,
    reason:
      `Fläche erscheint erst ab ${breakpoints.join('/')} und hat in dieser Datei ` +
      `kein Gegenstück (${breakpoints.map((bp) => `${bp}:hidden`).join('/')}). ` +
      'Entweder fehlt die schmale Variante des Features (AGENTS.md §4) — oder ' +
      'das Gegenstück liegt in einer Nachbardatei; dann gehört der Partner in ' +
      'platform-parity-allowlist.json eingetragen.',
  };
}
