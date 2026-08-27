/**
 * Eine Frage auf die Form bringen, in der alle Router-Stufen sie gleich lesen.
 *
 * Die Funktion lag bis hierher als WORTGLEICHE Kopie in vier Dateien
 * (`question-matcher`, `question-intent-model`, `scenario-intent`,
 * `action-intent`). Solange sie nur Umlaute faltete, war das folgenlos —
 * beim ersten Zusatz aber wäre er an einer Stelle gelandet und an drei
 * nicht, und dann sähe die Wortebene eine andere Frage als der
 * Klassifikator. Genau diese Sorte Auseinanderlaufen ist der Grund, warum
 * das Register überhaupt EIN Imperativ-Gate hat statt vier (AGENTS.md §3).
 *
 * Rein und ohne I/O: gehört nach `src/lib/` (§3, „Wohin ein Typ gehört").
 */

/**
 * Zusammengeschriebene Fragewendungen, die dieselbe Absicht tragen wie ihre
 * getrennte Form.
 *
 * Browser-Fund am Prod-Build: „Wieviel geld habe ich" blieb unbeantwortet,
 * „wie viel geld habe ich" traf `konto.gesamt`. Der Unterschied war ein
 * Leerzeichen. „wieviel" ist keine Nachlässigkeit, sondern bis zur
 * Rechtschreibreform die REGELFORM gewesen und heute noch verbreitet — wer
 * so tippt, meint nichts anderes.
 *
 * Die Liste bleibt bewusst kurz und auf Fragewendungen beschränkt: Eine
 * allgemeine Worttrennung würde raten, und ein Router, der rät, ist genau
 * das, was dieses Register nicht sein soll.
 */
const SCHREIBVARIANTEN: readonly [RegExp, string][] = [
  [/\bwieviele\b/g, 'wie viele'],
  [/\bwieviel\b/g, 'wie viel'],
  [/\bsoviel\b/g, 'so viel'],
];

/** Umlaute falten und Schreibvarianten auflösen — die gemeinsame Lesart. */
export function normalisiereFrage(text: string): string {
  let normalisiert = text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  for (const [muster, ersatz] of SCHREIBVARIANTEN) {
    normalisiert = normalisiert.replace(muster, ersatz);
  }
  return normalisiert;
}
