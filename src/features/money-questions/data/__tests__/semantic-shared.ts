/**
 * Gemeinsame Helfer von Fixture-Generator und semantischer Ratsche — damit
 * beide EXAKT dieselbe Zeilenmenge und denselben Hash sehen. Zwei Kopien
 * wären der halb übersetzte Zeilen-Fehler in neu.
 */

export interface KorpusZeile {
  frage: string;
  familie: string;
}

export function alleKorpusZeilen(
  ...korpora: readonly (readonly { frage: string; familie: string }[])[]
): KorpusZeile[] {
  return korpora.flatMap((k) => k.map((z) => ({ frage: z.frage, familie: z.familie })));
}

/**
 * Die Textbasis des Fixture-Hashs: alle Paraphrasen und alle Korpusfragen.
 * Ändert sich eine davon, passt die Fixture nicht mehr zum Stand — die
 * Ratsche schlägt dann mit dem Regenerier-Befehl fehl, statt still gegen
 * veraltete Embeddings zu messen.
 */
export function fixtureHashQuelle(
  paraphrasen: Readonly<Record<string, readonly string[]>>,
  zeilen: readonly KorpusZeile[],
): string {
  const p = Object.entries(paraphrasen)
    .map(([k, texte]) => `${k}:${[...texte].join('|')}`)
    .sort()
    .join('\n');
  const f = zeilen
    .map((z) => z.frage)
    .sort()
    .join('\n');
  return `${p}\n---\n${f}`;
}
