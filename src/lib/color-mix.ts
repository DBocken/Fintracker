/**
 * Numerisches Farb- und Rampen-Mixing für datengetriebene SVG-Animationen.
 *
 * Ursprünglich lokal im Budget-Tank entstanden und hier zentralisiert, damit
 * weitere animierte SVGs (Health-Ring, Celebration, …) exakt denselben weichen
 * Farbverlauf und dieselbe smoothstep-Rampe teilen statt sie nachzubauen.
 */

/** Begrenzt auf [0, 1]. */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Weiche 0→1-Rampe zwischen zwei Kanten (wie GLSL smoothstep). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export type RgbTuple = [number, number, number];

export function hexToRgb(hex: string): RgbTuple {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpRgb(a: RgbTuple, b: RgbTuple, t: number): RgbTuple {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export const rgbStr = ([r, g, b]: RgbTuple): string => `rgb(${r}, ${g}, ${b})`;
