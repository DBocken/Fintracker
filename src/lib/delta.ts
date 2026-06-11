/**
 * Schwellenwert-Logik für Delta-Färbung (Issue #54, Korrektur 4):
 * Deltas werden erst ab einem Schwellenwert farblich hervorgehoben —
 * +5 % ist kein Alarm. Unterhalb des Schwellenwerts bleibt das Delta neutral.
 */

export type DeltaSeverity = 'neutral' | 'positive' | 'warning';

/** Standard-Schwellenwert in Prozentpunkten (±10 %). */
export const DELTA_THRESHOLD_PERCENT = 10;

export interface DeltaOptions {
  /** Schwellenwert in %, ab dem gefärbt wird (Default: 10). */
  thresholdPercent?: number;
  /**
   * Ob ein steigender Wert gut ist (z. B. Einnahmen, Sparquote: true)
   * oder schlecht (z. B. Ausgaben, Schuldenstand: false). Default: true.
   */
  increaseIsGood?: boolean;
}

/**
 * Bestimmt, ob ein prozentuales Delta neutral bleibt oder als
 * positiv/warnend hervorgehoben wird.
 */
export function deltaSeverity(
  deltaPercent: number,
  options: DeltaOptions = {}
): DeltaSeverity {
  const { thresholdPercent = DELTA_THRESHOLD_PERCENT, increaseIsGood = true } = options;
  if (!Number.isFinite(deltaPercent)) return 'neutral';
  if (Math.abs(deltaPercent) < thresholdPercent) return 'neutral';
  const isGood = increaseIsGood ? deltaPercent > 0 : deltaPercent < 0;
  return isGood ? 'positive' : 'warning';
}

/** Tailwind-Textklasse für eine Delta-Severity (Tokens aus dem Ruhe-Theme). */
export function deltaTextClass(severity: DeltaSeverity): string {
  switch (severity) {
    case 'positive':
      return 'text-positive';
    case 'warning':
      return 'text-warning';
    default:
      return 'text-muted-foreground';
  }
}
