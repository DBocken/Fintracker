/**
 * FinRisk – Dichtefeld für die Wahrscheinlichkeits-Heatmap.
 *
 * Verdichtet die Monte-Carlo-Pfade (`paths[trial][tag]`) zu einem Wert×Tag-Gitter:
 * je Tag ein Histogramm der Saldo-Werte über alle Pfade. Anders als ein
 * P10/P50/P90-Band bildet das Gitter MULTIMODALE Verteilungen ab – etwa die
 * Mischung aus Basis- und Szenario-Pfaden (zwei getrennte Dichte-Rücken), die ein
 * glattes Band zu einem irreführenden Mittelwert verschmölze.
 *
 * Reine Logik ohne IO – damit unabhängig testbar.
 */

export interface DensityField {
  /** Tagesachse (ISO), Länge D. */
  dates: string[];
  /** Untere Kante des Wertefensters (EUR). */
  valueMin: number;
  /** Obere Kante des Wertefensters (EUR). */
  valueMax: number;
  /** Anzahl Wert-Bins B. */
  bins: number;
  /** Bin-Höhe in EUR. */
  binSize: number;
  /** `counts[tag][bin]` – Anzahl Pfade in diesem Wert-Bin an diesem Tag. */
  counts: number[][];
  /** Maximale Bin-Anzahl je Tag – für spaltenweise Intensitäts-Normierung. */
  columnMax: number[];
  /** Pfade je Spalte (konstant) – für absolute Wahrscheinlichkeiten. */
  total: number;
}

export interface BuildDensityOptions {
  /** Anzahl Wert-Bins. Default 48. */
  bins?: number;
  /** Werte, die immer im Fenster liegen müssen (z. B. 0 und Puffer). */
  include?: number[];
  /** Robustes Clipping: unteres/oberes Perzentil fürs Achsenfenster (in %). Default 1 → [P1, P99]. */
  clipPercent?: number;
  /** Relativer Rand oben/unten aufs Fenster. Default 0.04. */
  pad?: number;
}

/** Lineares Quantil eines aufsteigend sortierten Arrays (q in [0,1]). */
function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/**
 * Baut das Dichtefeld aus den Pfaden. Out-of-range-Werte (jenseits des robusten
 * Fensters) landen im jeweiligen Randbin – es geht KEIN Pfad verloren, sodass die
 * Spaltensumme der Counts immer exakt `total` ergibt.
 *
 * @param paths   `paths[trial][tag]` der maßgeblichen Cash-Sicht.
 * @param dates   Tagesachse (ISO), Länge = Tage je Pfad.
 * @param options Bins, einzuschließende Schwellen, Clipping, Rand.
 */
export function buildDensityField(
  paths: number[][],
  dates: string[],
  options: BuildDensityOptions = {},
): DensityField {
  const bins = Math.max(2, Math.round(options.bins ?? 48));
  const include = options.include ?? [];
  const clip = Math.max(0, Math.min(40, options.clipPercent ?? 1));
  const pad = options.pad ?? 0.04;

  const nDays = dates.length;
  const total = paths.length;

  // Leerfall: formgleiches Nullfeld, damit die UI nicht gesondert prüfen muss.
  if (total === 0 || nDays === 0) {
    return {
      dates,
      valueMin: 0,
      valueMax: 0,
      bins,
      binSize: 0,
      counts: dates.map(() => new Array<number>(bins).fill(0)),
      columnMax: dates.map(() => 0),
      total: 0,
    };
  }

  // Robustes Wertefenster über ALLE Pfadwerte (gegen Ausreißer-Auswaschung).
  const all: number[] = [];
  for (const path of paths) {
    for (let t = 0; t < nDays; t++) {
      const v = path[t];
      if (Number.isFinite(v)) all.push(v);
    }
  }
  all.sort((a, b) => a - b);
  let lo = quantileSorted(all, clip / 100);
  let hi = quantileSorted(all, 1 - clip / 100);

  // Eingeschlossene Schwellen (0, Puffer) müssen sichtbar bleiben.
  for (const v of include) {
    if (Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  // Degenerierte Spanne (alle Werte gleich) auf ein Mindestfenster aufziehen.
  if (!(hi > lo)) {
    const center = lo;
    const eps = Math.max(1, Math.abs(center) * 0.01);
    lo = center - eps;
    hi = center + eps;
  }
  const span = hi - lo;
  lo -= span * pad;
  hi += span * pad;

  const binSize = (hi - lo) / bins;

  const counts: number[][] = new Array(nDays);
  const columnMax: number[] = new Array<number>(nDays).fill(0);
  for (let t = 0; t < nDays; t++) counts[t] = new Array<number>(bins).fill(0);

  for (const path of paths) {
    for (let t = 0; t < nDays; t++) {
      const v = path[t];
      if (!Number.isFinite(v)) continue;
      let b = Math.floor((v - lo) / binSize);
      if (b < 0) b = 0;
      else if (b >= bins) b = bins - 1;
      counts[t][b] += 1;
    }
  }
  for (let t = 0; t < nDays; t++) {
    let mx = 0;
    const col = counts[t];
    for (let b = 0; b < bins; b++) if (col[b] > mx) mx = col[b];
    columnMax[t] = mx;
  }

  return { dates, valueMin: lo, valueMax: hi, bins, binSize, counts, columnMax, total };
}

/**
 * Findet die lokalen Maxima (Moden) einer Tagesspalte – die „Rücken" der
 * Verteilung. Mehr als eine Mode = Multimodalität (z. B. Basis vs. Szenario).
 * Liefert die Bin-Mittelwerte (EUR) absteigend nach Häufigkeit, gefiltert auf
 * Moden mit mind. `minShare` der Spaltenmasse.
 */
export function columnModes(
  field: DensityField,
  day: number,
  minShare = 0.12,
): Array<{ value: number; share: number }> {
  const col = field.counts[day];
  if (!col || field.total === 0) return [];
  const modes: Array<{ value: number; share: number }> = [];
  for (let b = 0; b < field.bins; b++) {
    const c = col[b];
    if (c === 0) continue;
    const left = b > 0 ? col[b - 1] : -1;
    const right = b < field.bins - 1 ? col[b + 1] : -1;
    // Lokales Maximum (Plateaus über die linke Kante zulassen).
    if (c >= left && c > right) {
      const share = c / field.total;
      if (share >= minShare) {
        const value = field.valueMin + (b + 0.5) * field.binSize;
        modes.push({ value: Math.round(value), share });
      }
    }
  }
  return modes.sort((a, b) => b.share - a.share);
}
