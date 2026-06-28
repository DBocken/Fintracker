/**
 * FinRisk – Geometrie & Gesten-Erkennung der Wahrscheinlichkeits-Heatmap.
 *
 * Reine Funktionen ohne React/DOM, damit sich die Zell-Zuordnung (Pixel → Tag ×
 * Wert-Bin) und die Tap-Erkennung unabhängig testen lassen – die Canvas hat in
 * jsdom keine Größe, deshalb wäre das im Komponenten-Test sonst blind.
 */

/** Innenabstände der Zeichenfläche in CSS-Pixeln (Achsen/Beschriftung). */
export const HEATMAP_PAD = { top: 10, right: 12, bottom: 22, left: 58 } as const;

/** Default-Toleranz (CSS-Pixel), bis zu der ein Zeiger noch als „Tap" gilt. */
export const TAP_SLOP_PX = 12;

export interface HeatmapDims {
  /** Breite der Zeichenfläche (CSS-Pixel). */
  width: number;
  /** Höhe der Zeichenfläche (CSS-Pixel). */
  height: number;
  /** Anzahl Tage (Spalten). */
  nDays: number;
  /** Anzahl Wert-Bins (Zeilen). */
  bins: number;
}

/**
 * Bildet einen Punkt (CSS-Pixel relativ zur oberen linken Ecke der
 * Zeichenfläche) auf eine Zelle (Tag × Wert-Bin) ab. Liefert `null`, wenn der
 * Punkt außerhalb des Plot-Bereichs liegt (z. B. in der Achsenbeschriftung) oder
 * die Maße noch nicht gemessen sind. Die Bin-Achse ist – wie beim Zeichnen –
 * invertiert: oben = höchster Wert (Bin `bins-1`), unten = niedrigster (Bin 0).
 */
export function resolveHeatmapCell(
  px: number,
  py: number,
  { width, height, nDays, bins }: HeatmapDims,
): { day: number; bin: number } | null {
  if (nDays <= 0 || bins <= 0) return null;
  const { top, right, bottom, left } = HEATMAP_PAD;
  if (width <= left + right || height <= top + bottom) return null;
  if (px < left || px > width - right || py < top || py > height - bottom) return null;

  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const day = Math.max(0, Math.min(nDays - 1, Math.floor(((px - left) / plotW) * nDays)));
  const binPx = plotH / bins;
  const row = Math.floor((py - top) / binPx);
  const bin = Math.max(0, Math.min(bins - 1, bins - 1 - row));
  return { day, bin };
}

/**
 * Tap-Erkennung: ein Zeiger gilt als TAP (nicht Wischen/Scrubben), wenn er sich
 * zwischen Drücken und Loslassen um weniger als `threshold` CSS-Pixel bewegt hat.
 * So öffnet ein gezieltes Antippen die Details, während das Ziehen entlang der
 * Tage (Vorschau) keinen Dialog auslöst. Bewusst NICHT vom synthetischen
 * `click`-Event abhängig, das nach einem Touch-Drag gar nicht feuert.
 */
export function isTap(
  down: { x: number; y: number } | null | undefined,
  up: { x: number; y: number },
  threshold: number = TAP_SLOP_PX,
): boolean {
  if (!down) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) <= threshold;
}
