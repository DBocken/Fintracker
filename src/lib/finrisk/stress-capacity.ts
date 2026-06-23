/**
 * FinRisk – Stress-Tragfähigkeit (v27, Kern-Neuerung)
 *
 * Beantwortet rückwärts: „Wie teuer darf ein zusätzlicher Stressfall sein, damit
 * der Saldo mit X % Sicherheit über dem Mindestpuffer bleibt?“ – immer relativ zu
 * einem Sicherheitsniveau, nie als absolute Obergrenze.
 *
 * Verfahren (auf echten Monte-Carlo-Pfaden, pfad-major `paths[trial][tag]`):
 *   headroom_i = min_t(paths[i][t] − threshold)
 *   maxAffordableShock(conf) = max(0, quantile(headrooms, 1 − conf))
 * Höheres Sicherheitsniveau ⇒ kleineres Quantil ⇒ kleinerer tragbarer Schock.
 */
import { percentile } from '../forecast-montecarlo';
import type { StressCapacityLevel } from './scenario-payload-types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Minimaler Wert eines Arrays ohne Spread (stack-sicher bei langen Pfaden). */
function minOf(values: number[]): number {
  let min = Infinity;
  for (const v of values) if (v < min) min = v;
  return min;
}

const DEFAULT_CONFIDENCE = [0.8, 0.9, 0.95];

/**
 * Berechnet die zusätzliche Stress-Tragfähigkeit je Sicherheitsniveau.
 *
 * @param paths            Trial-Pfade der maßgeblichen Cash-Sicht (`paths[trial][tag]`).
 * @param thresholdAmount  Mindestpuffer in EUR.
 * @param confidenceLevels Sicherheitsniveaus (0..1). Default [0.8, 0.9, 0.95].
 */
export function calculateStressCapacity(
  paths: number[][],
  thresholdAmount: number,
  confidenceLevels: number[] = DEFAULT_CONFIDENCE,
): StressCapacityLevel[] {
  if (paths.length === 0 || (paths[0]?.length ?? 0) === 0) {
    return confidenceLevels.map((conf) => ({
      confidenceLevel: conf,
      thresholdAmount,
      maxAffordableShock: 0,
      criticalDay: 0,
      interpretation: `Bei ${(conf * 100).toFixed(0)} % Sicherheitsniveau liegt keine belastbare Stress-Tragfähigkeit vor (zu wenige Daten).`,
    }));
  }

  // Geringster Abstand jedes Pfades zum Puffer über den gesamten Horizont.
  const headrooms = paths
    .map((path) => minOf(path.map((v) => v - thresholdAmount)))
    .sort((a, b) => a - b);

  // Kritischer Tag: geringster Abstand zum Puffer auf dem Median-Pfad.
  const nDays = paths[0].length;
  let criticalDay = 0;
  let minDistance = Infinity;
  for (let t = 0; t < nDays; t++) {
    const column = paths.map((p) => p[t]).sort((a, b) => a - b);
    const median = percentile(column, 50);
    const distance = median - thresholdAmount;
    if (distance < minDistance) {
      minDistance = distance;
      criticalDay = t;
    }
  }

  return confidenceLevels.map((conf) => {
    const maxAffordableShock = Math.max(0, percentile(headrooms, (1 - conf) * 100));
    return {
      confidenceLevel: conf,
      thresholdAmount,
      maxAffordableShock: round2(maxAffordableShock),
      criticalDay,
      interpretation: `Bei ${(conf * 100).toFixed(0)} % Sicherheitsniveau liegt die zusätzliche Stress-Tragfähigkeit bei ca. ${Math.round(
        maxAffordableShock,
      )} €.`,
    };
  });
}
