/**
 * FinRisk – Farbgebung der Dichte-Heatmap.
 *
 * Zwei orthogonale Achsen kodieren zwei Informationen:
 *  - WERTREGION (Vorzeichen-/Puffer-Lage) bestimmt den FARBTON: Defizit (rot),
 *    Risiko zwischen 0 und Puffer (amber), gesund über Puffer (emerald).
 *  - DICHTE bestimmt die INTENSITÄT innerhalb der jeweiligen Region.
 *
 * Damit nutzt jede Region ihren eigenen Gradienten (wie eine Heatmap), statt
 * eines einzigen Farbverlaufs über den gesamten Wertebereich. Multimodale
 * Verteilungen mit Masse in mehreren Regionen werden so farblich getrennt
 * sichtbar. Reine Funktionen ohne IO.
 */

export type ValueRegion = 'deficit' | 'caution' | 'healthy';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Gradient-Endpunkte je Region: `lo` = geringe Dichte, `hi` = hohe Dichte. */
const RAMPS: Record<ValueRegion, { lo: Rgb; hi: Rgb }> = {
  // Defizit (< 0): dunkles Bordeaux → grelles Rosé-Rot.
  deficit: { lo: { r: 45, g: 12, b: 20 }, hi: { r: 244, g: 63, b: 94 } },
  // Risiko (0 .. Puffer): dunkles Braun → warmes Amber.
  caution: { lo: { r: 51, g: 35, b: 8 }, hi: { r: 251, g: 191, b: 36 } },
  // Gesund (≥ Puffer): tiefes Teal → helles Emerald.
  healthy: { lo: { r: 6, g: 38, b: 35 }, hi: { r: 16, g: 185, b: 129 } },
};

/**
 * Ordnet einen Saldo-Wert seiner Region zu. Null ist die harte Defizit-Grenze;
 * ein positiver Puffer schneidet darüber ein Risiko-Band aus.
 */
export function regionForValue(value: number, buffer: number): ValueRegion {
  if (value < 0) return 'deficit';
  if (buffer > 0 && value < buffer) return 'caution';
  return 'healthy';
}

/** Begrenzt x auf [0,1]. */
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Liefert die `rgba()`-Füllfarbe einer Zelle aus Region und relativer Dichte
 * (0..1). Eine leichte Gamma-Korrektur hebt geringe Dichten an, damit auch
 * dünne Verteilungsausläufer sichtbar bleiben; das Alpha wächst mit der Dichte,
 * sodass leere Bereiche den Hintergrund durchscheinen lassen.
 */
export function densityColor(region: ValueRegion, intensity: number): string {
  const t = clamp01(intensity);
  const g = Math.pow(t, 0.7);
  const { lo, hi } = RAMPS[region];
  const r = Math.round(lo.r + (hi.r - lo.r) * g);
  const gg = Math.round(lo.g + (hi.g - lo.g) * g);
  const b = Math.round(lo.b + (hi.b - lo.b) * g);
  const a = 0.08 + 0.92 * g;
  return `rgba(${r}, ${gg}, ${b}, ${a.toFixed(3)})`;
}

/** Repräsentative Volltonfarbe einer Region (für Legende/Linien). */
export function regionAccent(region: ValueRegion): string {
  const { hi } = RAMPS[region];
  return `rgb(${hi.r}, ${hi.g}, ${hi.b})`;
}
