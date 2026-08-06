/**
 * Chart-Achsen-Hygiene (#54): gleichmäßige Ticks, Verlaufscharts müssen
 * nicht zwingend bei 0 beginnen, wenn Werte eng beieinander liegen.
 * Über `includeZero` lässt sich die Null-Linie explizit erzwingen.
 */

export interface AxisDomainOptions {
  /** Erzwingt, dass die Achse die 0 einschließt (Default: false). */
  includeZero?: boolean;
  /** Polster ober-/unterhalb der Daten relativ zur Spannweite (Default: 8 %). */
  paddingRatio?: number;
}

/**
 * Berechnet eine „saubere" Y-Achsen-Domain für einen Wertebereich:
 * gepolstert und auf runde Schrittweiten gerundet, damit Ticks
 * gleichmäßig fallen.
 */
export function niceDomain(
  dataMin: number,
  dataMax: number,
  options: AxisDomainOptions = {}
): [number, number] {
  const { includeZero = false, paddingRatio = 0.08 } = options;

  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) return [0, 1];
  if (dataMin > dataMax) [dataMin, dataMax] = [dataMax, dataMin];

  if (includeZero) {
    dataMin = Math.min(0, dataMin);
    dataMax = Math.max(0, dataMax);
  }

  const span = dataMax - dataMin;
  if (span === 0) {
    // Flache Serie: symmetrisch polstern, damit die Linie nicht am Rand klebt
    const pad = Math.max(Math.abs(dataMax) * paddingRatio, 1);
    return [niceFloor(dataMin - pad), niceCeil(dataMax + pad)];
  }

  const pad = span * paddingRatio;
  let lower = dataMin - pad;
  let upper = dataMax + pad;

  // Null-Linie nicht durch Polsterung überschreiten
  if (dataMin >= 0 && lower < 0 && !includeZero) lower = 0;
  if (includeZero) {
    if (dataMin >= 0) lower = 0;
    if (dataMax <= 0) upper = 0;
  }

  return [niceFloor(lower), niceCeil(upper)];
}

/**
 * Recharts-kompatible Domain (Funktions-Tupel), z. B.
 * `<YAxis domain={yAxisDomain({ includeZero })} />`.
 */
export function yAxisDomain(options: AxisDomainOptions = {}) {
  return [
    (dataMin: number) => niceDomain(dataMin, dataMin, options)[0],
    (dataMax: number) => niceDomain(dataMax, dataMax, options)[1],
  ] as [(dataMin: number) => number, (dataMax: number) => number];
}

export interface AxisTickOptions {
  /** Erzwingt, dass die Ticks die 0 einschließen (Default: false). */
  includeZero?: boolean;
  /** Ziel-Anzahl der Intervalle zwischen den Ticks (Default: 4). */
  targetIntervals?: number;
}

/**
 * Explizite, runde Tick-Werte für eine Y-Achse (Befund D-1, WP-4.6-Review):
 * Recharts verteilt seine Ticks gleichmäßig über die Domain und erzeugt damit
 * krumme Zwischenwerte (895 €, 1795 €, …). Diese Funktion wählt stattdessen
 * eine runde Schrittweite (1/2/5 × 10^n) nahe an `span / targetIntervals` und
 * legt Anfang und Ende auf Vielfache davon — die Achse wird ablesbar statt
 * nur korrekt. Verwendung: `<YAxis ticks={ticks} domain={[ticks[0],
 * ticks[ticks.length - 1]]} />`.
 */
export function niceTicks(
  dataMin: number,
  dataMax: number,
  options: AxisTickOptions = {}
): number[] {
  const { includeZero = false, targetIntervals = 4 } = options;

  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) return [0, 1];
  if (dataMin > dataMax) [dataMin, dataMax] = [dataMax, dataMin];

  if (includeZero) {
    dataMin = Math.min(0, dataMin);
    dataMax = Math.max(0, dataMax);
  }

  if (dataMin === dataMax) {
    // Flache Serie: symmetrisch aufspannen, damit überhaupt Intervalle entstehen.
    const pad = Math.max(Math.abs(dataMax) * 0.05, 1);
    dataMin -= pad;
    dataMax += pad;
  }

  const ideal = (dataMax - dataMin) / targetIntervals;
  const exponent = Math.floor(Math.log10(ideal));
  let step = Math.pow(10, exponent);
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const exp of [exponent, exponent + 1]) {
    for (const mantissa of [1, 2, 5]) {
      const candidate = mantissa * Math.pow(10, exp);
      const distance = Math.abs(Math.log(candidate / ideal));
      if (distance < bestDistance) {
        bestDistance = distance;
        step = candidate;
      }
    }
  }

  const first = Math.floor(dataMin / step) * step;
  const count = Math.round((Math.ceil(dataMax / step) * step - first) / step);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    // Über Indizes statt Aufsummieren, sonst driftet Fließkomma (0.1-Schritte).
    ticks.push(Number((first + i * step).toFixed(10)));
  }
  return ticks;
}

/** Rundet auf eine „runde" Schrittweite ab (1/2/2.5/5 × 10^n). */
function niceFloor(value: number): number {
  if (value === 0) return 0;
  const step = niceStep(Math.abs(value));
  return Math.floor(value / step) * step;
}

/** Rundet auf eine „runde" Schrittweite auf (1/2/2.5/5 × 10^n). */
function niceCeil(value: number): number {
  if (value === 0) return 0;
  const step = niceStep(Math.abs(value));
  return Math.ceil(value / step) * step;
}

function niceStep(magnitude: number): number {
  const exp = Math.floor(Math.log10(magnitude)) - 1;
  return Math.pow(10, Math.max(exp, 0)) * 5;
}
