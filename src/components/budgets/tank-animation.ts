/**
 * Parametrische Lottie-Tank-Animation. Die Flüssigkeit steigt linear über die
 * Frames 0..100 – Frame N entspricht also exakt N % Füllstand. Die Budget-Seite
 * rendert die Animation mit `autoplay={false}` und springt per `goToAndStop` auf
 * den Prozent-Frame. So ist der Füllstand datengetrieben und exakt.
 *
 * Lineare Interpolation: Die Keyframe-Tangenten o:(0,0) → i:(1,1) ergeben die
 * Gerade y = x, sodass Frame ↔ Füllstand verhältnisgleich bleibt.
 */

type LottieJSON = Record<string, unknown>;

// Innenmaße des Tanks (Composition 220 × 280).
const INNER_W = 160;
const INNER_H = 210;
const CENTER_X = 110;
const BOTTOM_Y = 250; // Unterkante der Flüssigkeit

const LINEAR = { i: { x: [1, 1], y: [1, 1] }, o: { x: [0, 0], y: [0, 0] } };

const BASE_TANK: LottieJSON = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 100,
  w: 220,
  h: 280,
  nm: "BudgetTank",
  ddd: 0,
  assets: [],
  layers: [
    // Tank-Umriss (oben gezeichnet)
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "outline",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "outline-group",
          it: [
            {
              ty: "rc",
              d: 1,
              s: { a: 0, k: [INNER_W, INNER_H] },
              p: { a: 0, k: [CENTER_X, BOTTOM_Y - INNER_H / 2] },
              r: { a: 0, k: 22 },
            },
            { ty: "st", c: { a: 0, k: [0.18, 0.2, 0.25, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 7 }, lc: 2, lj: 2 },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 101,
      st: 0,
      bm: 0,
    },
    // Flüssigkeit (steigt über die Frames)
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "liquid",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "liquid-group",
          it: [
            {
              ty: "rc",
              d: 1,
              s: {
                a: 1,
                k: [
                  { ...LINEAR, t: 0, s: [INNER_W, 0] },
                  { t: 100, s: [INNER_W, INNER_H] },
                ],
              },
              p: {
                a: 1,
                k: [
                  { ...LINEAR, t: 0, s: [CENTER_X, BOTTOM_Y] },
                  { t: 100, s: [CENTER_X, BOTTOM_Y - INNER_H / 2] },
                ],
              },
              r: { a: 0, k: 18 },
            },
            // Füllfarbe – wird von `buildTankAnimation` je nach Status überschrieben.
            { ty: "fl", c: { a: 0, k: [0.13, 0.55, 0.78, 1] }, o: { a: 0, k: 100 }, r: 1 },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 101,
      st: 0,
      bm: 0,
    },
    // Hintergrund (leerer Tank)
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: "tank-bg",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "bg-group",
          it: [
            {
              ty: "rc",
              d: 1,
              s: { a: 0, k: [INNER_W, INNER_H] },
              p: { a: 0, k: [CENTER_X, BOTTOM_Y - INNER_H / 2] },
              r: { a: 0, k: 22 },
            },
            { ty: "fl", c: { a: 0, k: [0.91, 0.93, 0.96, 1] }, o: { a: 0, k: 100 }, r: 1 },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 101,
      st: 0,
      bm: 0,
    },
  ],
};

interface FillShape {
  ty: string;
  c?: { a: number; k: number[] };
}
interface ShapeGroup {
  ty: string;
  it?: FillShape[];
}
interface TankLayer {
  nm?: string;
  shapes?: ShapeGroup[];
}

/**
 * Liefert eine eingefärbte Kopie der Tank-Animation. `rgb` sind 0..1-Werte
 * (Lottie-Konvention). Die Basis bleibt unverändert (reine Funktion).
 */
export function buildTankAnimation(rgb: [number, number, number]): LottieJSON {
  const clone: LottieJSON = JSON.parse(JSON.stringify(BASE_TANK));
  const layers = clone.layers as TankLayer[];
  const liquid = layers.find((l) => l.nm === "liquid");
  const fill = liquid?.shapes?.[0]?.it?.find((it) => it.ty === "fl");
  if (fill?.c) fill.c.k = [rgb[0], rgb[1], rgb[2], 1];
  return clone;
}

export { BASE_TANK };
