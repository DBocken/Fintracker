// Delta-Färbung mit Schwellenwert (Design-System, Issue #54).
//
// Regel „+5 % ist kein Alarm": Kleine Veränderungen bleiben NEUTRAL. Jede
// winzige Schwankung rot/grün einzufärben erzeugt Alarm-Müdigkeit (alarm
// fatigue) und Rauschen — ein gut belegtes UX-Problem aus Dashboard- und
// Medizingeräte-Design (Wickens et al.; Cvach 2012, „Monitor alarm fatigue").
// Erst jenseits einer Totzone (deadband) wird eingefärbt, jenseits einer
// kritischen Schwelle stärker. Richtungssinn ist datenabhängig: ein Anstieg
// beim Vermögen ist gut, bei den Ausgaben schlecht.

export type DeltaTone = "neutral" | "positive" | "warning" | "critical";

export interface DeltaToneOptions {
  /** Relative Totzone (0..1): darunter bleibt das Delta neutral. Default 0.05 (±5 %). */
  neutralBand?: number;
  /** Relative Schwelle (0..1) für den kritischen Ton in der „schlechten" Richtung. Default 0.25. */
  criticalBand?: number;
  /** Ist ein Anstieg positiv (Vermögen) oder negativ (Ausgaben)? Default true. */
  increaseIsGood?: boolean;
}

/** Relative Veränderung; bei Vorwert 0 → ±Infinity (bzw. 0, wenn beide 0). */
export function relativeDelta(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  return (current - previous) / Math.abs(previous);
}

/**
 * Semantischer Farbton für eine Veränderung – schwellwertbewusst.
 * Innerhalb der Totzone: neutral. Verbesserung: positive. Verschlechterung:
 * warning, jenseits der kritischen Schwelle: critical.
 */
export function deltaTone(
  current: number,
  previous: number,
  options: DeltaToneOptions = {},
): DeltaTone {
  const neutralBand = options.neutralBand ?? 0.05;
  const criticalBand = options.criticalBand ?? 0.25;
  const increaseIsGood = options.increaseIsGood ?? true;

  const rel = relativeDelta(current, previous);
  if (rel === 0 || Math.abs(rel) < neutralBand) return "neutral";

  const improving = rel > 0 ? increaseIsGood : !increaseIsGood;
  if (improving) return "positive";

  return Math.abs(rel) >= criticalBand ? "critical" : "warning";
}

/** Tailwind-Textfarbe je Ton (nutzt die App-Tokens). */
export const DELTA_TONE_CLASS: Record<DeltaTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-positive",
  warning: "text-warning",
  critical: "text-destructive",
};

export function deltaToneClass(tone: DeltaTone): string {
  return DELTA_TONE_CLASS[tone];
}
