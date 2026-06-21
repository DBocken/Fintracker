/**
 * Forecast Engine – Monte-Carlo-Layer (Stufe 4: Unsicherheit & Bandbreiten)
 *
 * Reine Logik ohne IO. Jeder Durchlauf perturbiert die {@link ForecastInput}
 * zufällig – kalibriert an der aus der Historie abgeleiteten Streuung – und
 * läuft durch denselben deterministischen Kern. Die Durchläufe werden zu
 * Wahrscheinlichkeiten (Pufferbruch) und Bandbreiten (P10/P50/P90) verdichtet.
 *
 * Mit festem Seed ist der Lauf vollständig reproduzierbar und damit testbar.
 */
import { calculateDeterministicForecast } from './forecast';
import type {
  ForecastConfig,
  ForecastInput,
  RecurringFlow,
  ResolvedForecastConfig,
  VariableExpenseBaseline,
} from './forecast-types';
import type {
  MonteCarloConfig,
  MonteCarloDistribution,
  MonteCarloResult,
  ResolvedMonteCarloConfig,
} from './forecast-montecarlo-types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** mulberry32: kompakter, schneller, seedbarer PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standardnormalverteilte Ziehung (Box-Muller) auf Basis eines Uniform-PRNG. */
function makeNormal(rng: () => number): () => number {
  let spare: number | null = null;
  return function () {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    // u in (0,1] vermeiden, damit ln(u) endlich bleibt.
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/**
 * Lognormaler Multiplikator mit Erwartungswert 1 und Variationskoeffizient cv.
 * So bleibt der Mittelwert der perturbierten Größe gleich der Baseline, nur die
 * Streuung kommt hinzu (kein systematischer Bias nach oben/unten).
 */
function lognormalMultiplier(normal: () => number, cv: number): number {
  if (cv <= 0) return 1;
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const z = normal();
  return Math.exp(sigma * z - (sigma * sigma) / 2);
}

function resolveMonteCarlo(mc: MonteCarloConfig): ResolvedMonteCarloConfig {
  return {
    trials: Math.min(Math.max(Math.round(mc.trials ?? 500), 1), 5000),
    seed: mc.seed ?? 1,
    variableVolatility: mc.variableVolatility ?? null,
    incomeVolatility: Math.max(0, mc.incomeVolatility ?? 0),
  };
}

/**
 * Erzeugt eine zufällig perturbierte Kopie des Inputs: variable Ausgaben je
 * Kategorie (um ihren Planwert) und – falls aktiviert – wiederkehrende
 * Einnahmen. Fixkosten/Transfers/Events bleiben unangetastet.
 */
function perturbInput(
  input: ForecastInput,
  normal: () => number,
  mc: ResolvedMonteCarloConfig,
): ForecastInput {
  const variableExpenses: VariableExpenseBaseline[] = (input.variableExpenses ?? []).map((b) => {
    const cv = mc.variableVolatility ?? b.volatility ?? 0;
    const effective = b.budgetOverride ?? b.monthlyAmount;
    const mult = lognormalMultiplier(normal, cv);
    return { ...b, budgetOverride: round2(effective * mult) };
  });

  const recurringFlows: RecurringFlow[] = (input.recurringFlows ?? []).map((f) => {
    if (f.amount > 0 && mc.incomeVolatility > 0) {
      const mult = lognormalMultiplier(normal, mc.incomeVolatility);
      return { ...f, amount: round2(f.amount * mult) };
    }
    return f;
  });

  return { ...input, variableExpenses, recurringFlows };
}

/** Linear interpoliertes Perzentil eines aufsteigend sortierten Arrays. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function distribution(values: number[]): MonteCarloDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
  return {
    p10: round2(percentile(sorted, 10)),
    p50: round2(percentile(sorted, 50)),
    p90: round2(percentile(sorted, 90)),
    mean: round2(mean),
  };
}

/**
 * Führt den Monte-Carlo-Lauf durch und verdichtet die Durchläufe zu Bandbreite,
 * Pufferbruch-Wahrscheinlichkeit und Verteilungen.
 *
 * @param input  Die (bereits override-bereinigten) Eingaben.
 * @param config Horizont/Puffer/Basis – identisch für alle Durchläufe.
 * @param mc     Monte-Carlo-Parameter (Durchläufe, Seed, Streuung).
 */
export function runMonteCarloForecast(
  input: ForecastInput,
  config: ForecastConfig = {},
  mc: MonteCarloConfig = {},
): MonteCarloResult {
  const resolvedMc = resolveMonteCarlo(mc);
  const rng = mulberry32(resolvedMc.seed);
  const normal = makeNormal(rng);

  let dates: string[] | null = null;
  // Wird beim ersten Durchlauf gesetzt (trials >= 1 garantiert).
  let resolvedConfig!: ResolvedForecastConfig;
  const useAvailable = (config.bufferBasis ?? 'operating') === 'available';

  let byDay: number[][] = [];
  const lowestArr: number[] = [];
  const endingNwArr: number[] = [];
  let breaches = 0;

  for (let t = 0; t < resolvedMc.trials; t++) {
    const result = calculateDeterministicForecast(perturbInput(input, normal, resolvedMc), config);
    if (!dates) {
      dates = result.daily.map((d) => d.date);
      resolvedConfig = result.config;
      byDay = dates.map(() => [] as number[]);
    }
    result.daily.forEach((p, i) => {
      byDay[i].push(useAvailable ? p.availableCash : p.operatingCash);
    });
    lowestArr.push(result.risk.lowestBalance);
    endingNwArr.push(result.daily.at(-1)?.netWorth ?? 0);
    if (result.risk.daysBelowSafetyBuffer > 0) breaches++;
  }

  const band = (dates ?? []).map((date, i) => {
    const sorted = [...byDay[i]].sort((a, b) => a - b);
    return {
      date,
      p10: round2(percentile(sorted, 10)),
      p50: round2(percentile(sorted, 50)),
      p90: round2(percentile(sorted, 90)),
    };
  });

  return {
    config: resolvedConfig,
    monteCarlo: resolvedMc,
    band,
    breachProbability: round2(breaches / resolvedMc.trials),
    lowestBalance: distribution(lowestArr),
    endingNetWorth: distribution(endingNwArr),
  };
}
