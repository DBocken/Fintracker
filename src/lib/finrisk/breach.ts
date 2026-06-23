/**
 * FinRisk – Tagesgenaue Pufferbruch-Wahrscheinlichkeit (v27)
 *
 * Für jede Schwelle der Anteil der Monte-Carlo-Pfade, die an einem Tag darunter
 * liegen. Ergänzt die skalare `breachProbability` des Monte-Carlo-Laufs um eine
 * tagesgenaue Kurve je Schwelle (z. B. 0 €, Mindestpuffer, 1×/2× Monatsfixkosten).
 */

/**
 * @param paths      Trial-Pfade der maßgeblichen Cash-Sicht (`paths[trial][tag]`).
 * @param thresholds Schwellen in EUR.
 * @returns          Map Schwelle → Tagesreihe der Bruch-Wahrscheinlichkeit (0..1).
 */
export function calculateBreachProbabilities(
  paths: number[][],
  thresholds: number[],
): Record<string, number[]> {
  const nDays = paths[0]?.length ?? 0;
  const total = paths.length;
  const result: Record<string, number[]> = {};

  for (const threshold of thresholds) {
    const series = new Array<number>(nDays).fill(0);
    if (total > 0) {
      for (let t = 0; t < nDays; t++) {
        let count = 0;
        for (const path of paths) if (path[t] < threshold) count++;
        series[t] = count / total;
      }
    }
    result[String(threshold)] = series;
  }

  return result;
}
