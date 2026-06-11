/**
 * Monochrome Chart-Farbrampe für das „Ruhe"-Theme (Issue #54).
 *
 * Charts nutzen Helligkeits-Abstufungen der Brand-Farbe (tiefes Petrol)
 * statt einer kategorialen Regenbogen-Palette. Unterscheidung erfolgt
 * über Helligkeit + Label.
 */

const BRAND_HUE = 174;
const BRAND_SATURATION = 55;

/** Hellster und dunkelster Punkt der Rampe (Lightness in %) */
const RAMP_LIGHT_MIN = 22;
const RAMP_LIGHT_MAX = 78;

/**
 * Liefert `count` monochrome Farben als HSL-Strings, von dunkel nach hell.
 * Bei einem einzelnen Wert wird die Brand-Farbe selbst verwendet.
 */
export function chartRamp(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [hslColor(RAMP_LIGHT_MIN)];
  const step = (RAMP_LIGHT_MAX - RAMP_LIGHT_MIN) / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    hslColor(RAMP_LIGHT_MIN + i * step)
  );
}

/** Farbe für Index `i` aus einer Rampe der Größe `count` (stabil pro Position). */
export function chartColorAt(i: number, count: number): string {
  const ramp = chartRamp(Math.max(count, 1));
  return ramp[Math.min(Math.max(i, 0), ramp.length - 1)];
}

function hslColor(lightness: number): string {
  return `hsl(${BRAND_HUE}, ${BRAND_SATURATION}%, ${Math.round(lightness)}%)`;
}

/** Brand-Farbe für einreihige Charts (Linien, einzelne Balkenserie). */
export const CHART_BRAND = hslColor(RAMP_LIGHT_MIN);
/** Gedämpfte Vergleichsfarbe (z. B. Vormonat) — hellere Stufe derselben Rampe. */
export const CHART_BRAND_MUTED = hslColor(60);
