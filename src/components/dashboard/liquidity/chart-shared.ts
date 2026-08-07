/**
 * Gemeinsame Bausteine der Liquiditäts-Darstellung.
 *
 * Standen zuvor mitten in `LiquidityReport.tsx` zwischen Abfragen und JSX.
 * Sie werden von mehreren Ansichten gebraucht und gehören deshalb an eine
 * eigene Stelle statt in die grösste der Ansichten.
 */
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const BAND_LAYERS = [
  /** P05–P95: das Moeglichkeitsfeld. */
  { key: 'outer', floorKey: 'outerFloor', heightKey: 'outerHeight', opacityFactor: 0.45 },
  /** P10–P90: die fachlich benannte Bandbreite. */
  { key: 'band', floorKey: 'bandFloor', heightKey: 'bandHeight', opacityFactor: 0.7 },
  /** P25–P75: wo die Haelfte aller Durchlaeufe landet. */
  { key: 'core', floorKey: 'coreFloor', heightKey: 'coreHeight', opacityFactor: 1 },
] as const;

/** Ein Datenpunkt der Linien-Ansicht (Plan + optionales P10–P90-Band + Median). */
export interface ChartPoint {
  date: string;
  operating: number;
  outerFloor?: number;
  outerHeight?: number;
  bandFloor?: number;
  bandHeight?: number;
  coreFloor?: number;
  coreHeight?: number;
  median?: number;
}

export function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd. MMM yyyy', { locale: de });
  } catch {
    return iso;
  }
}

export function fmtMonth(yyyymm: string): string {
  try {
    return format(parseISO(`${yyyymm}-01`), 'MMM yyyy', { locale: de });
  } catch {
    return yyyymm;
  }
}

/** Höchste Pufferbruch-Wahrscheinlichkeit über den Horizont für eine Schwelle. */
export function maxBreach(breach: Record<string, number[]> | undefined, threshold: number): number | null {
  if (!breach) return null;
  const series = breach[String(threshold)];
  if (!series || series.length === 0) return 0;
  return Math.max(...series);
}

export const HORIZON_OPTIONS = [6, 12, 24, 36];

/** Dispozins p. a. – eine Überziehung kostet Geld (siehe FinRisk). */
export const OVERDRAFT_RATE = 11;

export type ChartView = 'lines' | 'heatmap';
