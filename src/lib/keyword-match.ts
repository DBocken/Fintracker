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
 * Prüft, ob `keyword` in `text` vorkommt — kurze Wort-Keywords nur an
 * Wortgrenzen, alles andere als Substring. Case-insensitiv.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  const haystack = text.toLowerCase();
  const needle = keyword.toLowerCase();

  const needsBoundary = needle.length <= WORD_BOUNDARY_MAX_LENGTH && PURE_LETTERS.test(needle);
  if (!needsBoundary) return haystack.includes(needle);

  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) return false;
    const beforeIsWord = isWordChar(haystack, idx - 1);
    const afterIsWord = isWordChar(haystack, idx + needle.length);
    if (!beforeIsWord && !afterIsWord) return true;
    from = idx + 1;
  }
  return false;
}
