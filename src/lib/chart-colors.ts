/**
 * Chart-Farben für das „Ruhe"-Theme — Pastell-Update (Design-Direktive C).
 *
 * Statt der früheren monochromen Petrol-Rampe nutzen Charts jetzt klar
 * unterscheidbare Pastelltöne: Kontrast ohne Knalligkeit. Die Töne kommen
 * aus CSS-Variablen (index.css) und folgen damit dem aktiven Theme
 * (inkl. Dark Mode).
 *
 * Semantik:
 * - CHART_INCOME  (Mint-Salbei)   → Einnahmen
 * - CHART_EXPENSE (Warm-Koralle)  → Ausgaben
 * - CHART_NET     (Periwinkle)    → Saldo/Nettowert
 * - chartRamp(n)  → kategoriale Töne für Kreis-/Kategorie-Charts
 */

/** Semantische Cashflow-Farben. */
export const CHART_INCOME = "hsl(var(--chart-income))";
export const CHART_EXPENSE = "hsl(var(--chart-expense))";
export const CHART_NET = "hsl(var(--chart-net))";

/** Kategoriale Pastell-Palette (Mint, Periwinkle, Koralle, Amber, Lavendel, Rose). */
const CATEGORICAL = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

/**
 * Liefert `count` klar unterscheidbare Farben. Bei mehr als 6 Kategorien
 * wiederholt sich die Palette (Unterscheidung dann über Label).
 */
export function chartRamp(count: number): string[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => CATEGORICAL[i % CATEGORICAL.length]);
}

/** Farbe für Index `i` (stabil pro Position). */
export function chartColorAt(i: number, count: number): string {
  void count;
  return CATEGORICAL[Math.max(0, i) % CATEGORICAL.length];
}

/** Brand-Farbe für einreihige Charts (Linien, einzelne Balkenserie). */
export const CHART_BRAND = "hsl(var(--brand))";
/** Gedämpfte Vergleichsfarbe (z. B. Vormonat). */
export const CHART_BRAND_MUTED = "hsl(var(--chart-net))";
