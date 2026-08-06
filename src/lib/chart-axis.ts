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

/**
 * `niceTicks` über mehrere Serien eines Datensatzes (WP-6.8).
 *
 * Die Handrechnung dafür stand bisher nur in `AdvancedBalanceChart` — und war
 * dort schon nötig, weil eine Achse, die nur die erste Serie kennt, jede
 * weitere abschneidet. Jede Abschrift hätte denselben Fehler neu riskiert.
 *
 * Liefert `null`, wenn kein einziger brauchbarer Wert vorkommt; die
 * Aufrufstelle setzt dann gar keine Ticks, statt eine NaN-Achse zu bauen.
 */
export function niceTicksForData<T extends object>(
  data: readonly T[],
  keys: readonly (keyof T)[],
  options: AxisTickOptions = {}
): number[] | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const point of data) {
    for (const key of keys) {
      const value = point[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return niceTicks(min, max, options);
}

/**
 * `niceTicks` für **gestapelte** Serien (WP-6.8).
 *
 * Der Unterschied ist keine Feinheit: bei einem Stapel zeigt die Achse die
 * Summe der Segmente, nicht das größte Einzelsegment. Wer hier
 * {@link niceTicksForData} nähme, bekäme eine Achse, die bei drei Kategorien
 * à 400 € bei 400 € endet — die Balken ragten dann sichtbar über ihr eigenes
 * Diagramm hinaus.
 *
 * Negative und positive Segmente werden getrennt aufsummiert, damit ein
 * Stapel mit beiden Vorzeichen nicht fälschlich zu null verrechnet wird.
 *
 * Die Schlüssel sind hier bewusst `string[]` und nicht `keyof T` wie bei
 * {@link niceTicksForData}: Stapel-Serien entstehen aus Daten (Kategorie-IDs,
 * Konto-IDs), ihre Schlüssel stehen zur Übersetzungszeit nicht fest. Nicht
 * vorhandene Schlüssel werden übersprungen — das ist derselbe Fall wie ein
 * Monat, in dem eine Kategorie nicht vorkommt.
 */
export function niceTicksForStackedData(
  data: readonly Record<string, unknown>[],
  keys: readonly string[],
  options: AxisTickOptions = {}
): number[] | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sawValue = false;

  for (const point of data) {
    let positiveSum = 0;
    let negativeSum = 0;
    for (const key of keys) {
      const value = point[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      sawValue = true;
      if (value >= 0) positiveSum += value;
      else negativeSum += value;
    }
    if (positiveSum > max) max = positiveSum;
    if (negativeSum < min) min = negativeSum;
  }

  if (!sawValue) return null;
  return niceTicks(Math.min(min, 0), Math.max(max, 0), options);
}

/**
 * Einheitliche Optik einer Wert-Achse. Ausschließlich Design-Tokens, damit der
 * Dunkelmodus mitwandert.
 */
export const VALUE_AXIS_STYLE = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 12,
  tickLine: false as const,
  axisLine: false as const,
};

export interface ValueAxisOptions {
  /** Ergebnis von {@link niceTicksForData}; `null` bedeutet „Recharts entscheiden lassen". */
  ticks: number[] | null;
  tickFormatter?: (value: number, index: number) => string;
  /** Achsenbreite in Pixeln — hängt an der Stelligkeit der Beträge. */
  width?: number;
}

export interface ValueAxisProps {
  stroke: string;
  fontSize: number;
  tickLine: false;
  axisLine: false;
  width?: number;
  ticks?: number[];
  domain?: [number, number];
  tickFormatter?: (value: number, index: number) => string;
}

/**
 * Props für eine `<YAxis>` mit runden Ticks (WP-6.8, Befund D-1).
 *
 * Setzt Ticks **und** Domain gemeinsam: Recharts skaliert nach `domain`, nicht
 * nach `ticks`. Wer nur Ticks setzt, verliert die äußeren Beschriftungen —
 * genau deshalb gehört die Kopplung hierher und nicht an 13 Aufrufstellen.
 *
 * ```tsx
 * const ticks = niceTicksForData(data, ['income', 'expenses']);
 * <YAxis {...valueAxisProps({ ticks, tickFormatter: (v) => `${v} €` })} />
 * ```
 */
export function valueAxisProps({ ticks, tickFormatter, width }: ValueAxisOptions): ValueAxisProps {
  const props: ValueAxisProps = { ...VALUE_AXIS_STYLE };

  if (width !== undefined) props.width = width;
  if (tickFormatter) props.tickFormatter = tickFormatter;
  if (ticks && ticks.length > 0) {
    props.ticks = ticks;
    props.domain = [ticks[0], ticks[ticks.length - 1]];
  }

  return props;
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
