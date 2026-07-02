import type { FinancialHealth } from "@/services/financial-health-service";
import {
  getStatusBucket,
  getStatusStage,
  statusColorVar,
  type StatusBucket,
} from "@/lib/status-bucket";

/**
 * Reines Daten-Modell für die dynamisch generierte Finanzlandschaft.
 *
 * Statt statischer PNG-Stufenbilder wird die gesamte Szene aus den
 * Health-Scores abgeleitet: jede Metrik steuert ein Landschaftselement
 * kontinuierlich (Geometrie 0..1) UND diskret (5 Status-Stufen aus
 * `status-bucket`). Die Render-Komponente (`DynamicLandscape`) bleibt
 * dadurch dumm und die Abbildung Score → Bild ist ohne DOM testbar.
 */

export type LandscapeMetricKey =
  | "emergency_fund"
  | "debt"
  | "savings_rate"
  | "liquidity"
  | "contracts";

export interface SceneMetric {
  key: LandscapeMetricKey;
  score: number;
  stage: 1 | 2 | 3 | 4 | 5;
  bucket: StatusBucket;
  /** CSS-Farbausdruck (`hsl(var(--status-*))`) für Akzente/Chips. */
  color: string;
  explanation: string;
}

/** Notgroschen → Wetter: die Sonne schützt die Landschaft. */
export interface SunElement {
  /** 0..1 relative Sonnengröße. */
  size: number;
  /** Anzahl Wolken (mehr Wolken = dünnerer Puffer). */
  cloudCount: number;
  /** Stufe ≤ 2: Gewitterstimmung inkl. Regen. */
  stormy: boolean;
}

/** Schulden → Berg: je höher die Last, desto höher der Berg (invers zum Score). */
export interface MountainElement {
  /** 0..1 relative Berghöhe. */
  height: number;
}

/** Sparquote → Baum: wächst mit dem Score, trägt ab Stufe 3 Früchte. */
export interface TreeElement {
  /** 0..1 relatives Wachstum (Stamm + Krone). */
  growth: number;
  fruitCount: number;
}

/** Liquidität → Fluss: Wasserstand steigt mit dem Score. */
export interface WaterElement {
  /** 0..1 Füllstand des Flussbetts. */
  level: number;
}

/** Verträge/Fixkosten → Haus: bewohnt & beheizt, wenn die Fixkosten tragbar sind. */
export interface HouseElement {
  /** 0..3 beleuchtete Fenster. */
  litWindows: number;
  /** Kaminrauch ab Stufe 4 (alles läuft rund). */
  hasSmoke: boolean;
  /** 0..1 baulicher Zustand (Sättigung/Details). */
  condition: number;
}

export interface LandscapeScene {
  overallBucket: StatusBucket;
  /** Himmel-Verlauf [oben, unten] — schwellwertbewusst pro Gesamt-Bucket. */
  sky: [string, string];
  metrics: Partial<Record<LandscapeMetricKey, SceneMetric>>;
  sun: SunElement | null;
  mountain: MountainElement | null;
  tree: TreeElement | null;
  water: WaterElement | null;
  house: HouseElement | null;
}

/**
 * Hotspot-Positionen (Prozent des 9:16-Containers), deckungsgleich mit den
 * gezeichneten Elementen im 360×640-ViewBox von `DynamicLandscape`.
 */
export const SCENE_HOTSPOTS: Record<LandscapeMetricKey, { top: string; left: string }> = {
  emergency_fund: { top: "5%", left: "58%" },
  debt: { top: "24%", left: "6%" },
  savings_rate: { top: "47%", left: "56%" },
  contracts: { top: "54%", left: "10%" },
  liquidity: { top: "78%", left: "36%" },
};

/** Himmel-Verläufe von Gewittergrau bis Goldstunde — an Buckets, nicht Rohwerten. */
const SKY_BY_BUCKET: Record<StatusBucket, [string, string]> = {
  critical: ["#475569", "#94a3b8"],
  weak: ["#64748b", "#cbd5e1"],
  mid: ["#93c5fd", "#e0f2fe"],
  good: ["#7dd3fc", "#f0f9ff"],
  excellent: ["#38bdf8", "#fef9c3"],
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function buildLandscapeScene(health: FinancialHealth | undefined): LandscapeScene {
  const metrics: LandscapeScene["metrics"] = {};

  for (const sub of health?.subScores ?? []) {
    if (!(sub.key in SCENE_HOTSPOTS)) continue;
    const key = sub.key as LandscapeMetricKey;
    metrics[key] = {
      key,
      score: sub.score,
      stage: getStatusStage(sub.score),
      bucket: getStatusBucket(sub.score),
      color: statusColorVar(getStatusBucket(sub.score)),
      explanation: sub.explanation,
    };
  }

  const overallBucket = health ? getStatusBucket(health.score) : "mid";

  const sun = metrics.emergency_fund ?? null;
  const debt = metrics.debt ?? null;
  const savings = metrics.savings_rate ?? null;
  const liquidity = metrics.liquidity ?? null;
  const contracts = metrics.contracts ?? null;

  return {
    overallBucket,
    sky: SKY_BY_BUCKET[overallBucket],
    metrics,
    sun: sun && {
      size: 0.35 + 0.65 * clamp01(sun.score / 100),
      cloudCount: 5 - sun.stage,
      stormy: sun.stage <= 2,
    },
    // Mindesthöhe 0.12: auch (fast) schuldenfrei bleibt ein Hügel am Horizont.
    mountain: debt && { height: Math.max(0.12, clamp01(1 - debt.score / 100)) },
    tree: savings && {
      growth: 0.15 + 0.85 * clamp01(savings.score / 100),
      fruitCount: Math.max(0, savings.stage - 2),
    },
    // Mindestpegel 0.08: das Flussbett trocknet nie ganz aus (lesbar bleiben).
    water: liquidity && { level: 0.08 + 0.92 * clamp01(liquidity.score / 100) },
    house: contracts && {
      litWindows: Math.min(3, Math.max(0, contracts.stage - 1)),
      hasSmoke: contracts.stage >= 4,
      condition: clamp01(contracts.score / 100),
    },
  };
}
