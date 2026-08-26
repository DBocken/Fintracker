/**
 * Zentrales Keyword-Matching für die Auto-Kategorisierung und Steuer-Vorschläge.
 *
 * Problem: reines Substring-Matching erzeugt False Positives bei kurzen
 * Keywords („verein" ⊂ „Bausparverein", „etf" ⊂ „GetFit", „verdi" ⊂
 * „Verdienstabrechnung"). Reines Wortgrenzen-Matching bricht dagegen deutsche
 * Komposita („heizung" in „Fernheizung", „kaltmiete").
 *
 * Kompromiss (Heuristik, im Test gepinnt):
 * - Kurze, rein alphabetische Keywords (≤ {@link WORD_BOUNDARY_MAX_LENGTH}
 *   Buchstaben) matchen nur als eigenständiges Wort.
 * - Lange Keywords und solche mit Nicht-Buchstaben (Leerzeichen, Punkte, Ziffern
 *   — Marken wie „e.on", Phrasen wie „trade republic") bleiben Substring.
 *
 * Bewusst OHNE Regex-\b: JavaScripts \b ist ASCII-basiert und setzt bei
 * Umlauten (ö/ä/ü/ß) Wortgrenzen mitten ins Wort. Stattdessen prüfen wir die
 * Nachbarzeichen jedes Vorkommens per Unicode-Kategorie (Buchstabe/Ziffer).
 */

export const WORD_BOUNDARY_MAX_LENGTH = 6;

const WORD_CHAR = /[\p{L}\p{N}]/u;
const PURE_LETTERS = /^\p{L}+$/u;

function isWordChar(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return WORD_CHAR.test(text[index]);
}

/**
 * Einmal vorbereitetes Keyword: kleingeschrieben, und die Frage „Wortgrenze
 * nötig?" schon beantwortet.
 *
 * Beides hängt allein am Keyword und nicht am geprüften Text — in der
 * Auto-Kategorisierung stehen aber Hunderte Keywords gegen jede Buchung, und
 * ohne diese Trennung wird je Paarung neu kleingeschrieben und die
 * Buchstaben-Regex neu ausgewertet (AGENTS.md §3, „Was vor der Schleife
 * indiziert wird").
 */
export interface PreparedKeyword {
  /** Kleingeschriebenes Keyword. */
  needle: string;
  /** Nur als eigenständiges Wort matchen (kurz und rein alphabetisch)? */
  needsBoundary: boolean;
}

/** Bereitet ein Keyword für wiederholte Vergleiche vor. */
export function prepareKeyword(keyword: string): PreparedKeyword {
  const needle = keyword.toLowerCase();
  return {
    needle,
    needsBoundary: needle.length <= WORD_BOUNDARY_MAX_LENGTH && PURE_LETTERS.test(needle),
  };
}

/**
 * Kern des Matchings. Erwartet den Text BEREITS kleingeschrieben — wer viele
 * Keywords gegen denselben Text prüft, schreibt ihn einmal klein statt je
 * Keyword erneut. Für den Einzelfall gibt es {@link matchesKeyword}.
 */
export function matchesPreparedKeyword(loweredText: string, keyword: PreparedKeyword): boolean {
  const { needle, needsBoundary } = keyword;
  if (!loweredText || !needle) return false;
  if (!needsBoundary) return loweredText.includes(needle);

  let from = 0;
  while (from <= loweredText.length - needle.length) {
    const idx = loweredText.indexOf(needle, from);
    if (idx === -1) return false;
    const beforeIsWord = isWordChar(loweredText, idx - 1);
    const afterIsWord = isWordChar(loweredText, idx + needle.length);
    if (!beforeIsWord && !afterIsWord) return true;
    from = idx + 1;
  }
  return false;
}

/**
 * Prüft, ob `keyword` in `text` vorkommt — kurze Wort-Keywords nur an
 * Wortgrenzen, alles andere als Substring. Case-insensitiv.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  return matchesPreparedKeyword(text.toLowerCase(), prepareKeyword(keyword));
}
