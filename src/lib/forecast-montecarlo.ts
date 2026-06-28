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
import { calculateDeterministicForecast, pickVariableExpenseAccount } from './forecast';
import { addDays, addMonths, format, getDay, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';
import { sampleOccurrenceMonth } from './finrisk/occurrence-amount';
import type {
  ForecastConfig,
  ForecastInput,
  PlannedForecastEvent,
  RecurringFlow,
  ResolvedForecastConfig,
  VariableExpenseBaseline,
} from './forecast-types';
import type {
  CategoryAssumption,
  IncomeAssumption,
  MonteCarloConfig,
  MonteCarloDistribution,
  MonteCarloResult,
  ResolvedMonteCarloConfig,
  TrialAssumptions,
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
    occurrenceSampling: mc.occurrenceSampling ?? false,
  };
}

/**
 * Erzeugt die spiky Tagesereignisse einer Baseline mit Occurrence-Modell über
 * den Horizont (PR 3). Jeder Monat wird erwartungstreu auf seinen Zielwert
 * kalibriert; gebucht werden nur Tage im Horizont.
 */
function buildOccurrenceEvents(
  baseline: VariableExpenseBaseline,
  accountId: string,
  startISO: string,
  horizonMonths: number,
  normal: () => number,
  rng: () => number,
): PlannedForecastEvent[] {
  const model = baseline.occurrenceModel;
  if (!model) return [];
  const start = parseISO(startISO);
  const endExclusive = addMonths(start, horizonMonths);
  const events: PlannedForecastEvent[] = [];

  for (let m = 0; m < horizonMonths; m++) {
    const monthDate = addMonths(start, m);
    const monthKey = format(monthDate, 'yyyy-MM');
    const target = baseline.monthlyAmounts?.[monthKey] ?? baseline.budgetOverride ?? baseline.monthlyAmount;
    if (target <= 0) continue;

    const monthStart = startOfMonth(monthDate);
    const dim = getDaysInMonth(monthDate);
    const fullWeekdays = Array.from({ length: dim }, (_, k) => getDay(addDays(monthStart, k)));

    // Nur Tage im Horizont (>= start, < endExclusive) emittieren.
    const emitDates: Date[] = [];
    const emitWeekdays: number[] = [];
    for (let k = 0; k < dim; k++) {
      const d = addDays(monthStart, k);
      if (d < start || d >= endExclusive) continue;
      emitDates.push(d);
      emitWeekdays.push(getDay(d));
    }
    if (emitDates.length === 0) continue;

    const daily = sampleOccurrenceMonth(model, fullWeekdays, emitWeekdays, target, normal, rng);
    daily.forEach((amount, i) => {
      if (amount <= 0) return;
      const date = format(emitDates[i], 'yyyy-MM-dd');
      events.push({
        id: `occ-${baseline.category}-${date}`,
        name: baseline.category,
        amount: -round2(amount),
        date,
        accountId,
      });
    });
  }

  return events;
}

/**
 * Erzeugt eine zufällig perturbierte Kopie des Inputs: variable Ausgaben je
 * Kategorie (um ihren Planwert) und – falls aktiviert – wiederkehrende
 * Einnahmen. Fixkosten/Transfers/Events bleiben unangetastet.
 *
 * Mit `occurrenceSampling` werden Baselines, die ein `occurrenceModel` tragen,
 * stattdessen als spiky Tagesereignisse gezogen (PR 3); alle übrigen behalten
 * die geglättete Perturbation.
 *
 * Mit `collectAssumptions` werden die gezogenen Werte (variable Ausgabe je
 * Kategorie/Monat, perturbierte Einnahmen) zusätzlich als {@link TrialAssumptions}
 * zurückgegeben. Das LIEST nur bereits gezogene Zufallswerte – die RNG-Sequenz
 * bleibt identisch, damit Band/Kennzahlen unabhängig vom Flag reproduzierbar sind.
 */
function perturbInput(
  input: ForecastInput,
  normal: () => number,
  rng: () => number,
  mc: ResolvedMonteCarloConfig,
  monthKeys: string[],
  startISO: string,
  horizonMonths: number,
  collectAssumptions: boolean,
): { input: ForecastInput; assumptions: TrialAssumptions | null } {
  const useOccurrence = mc.occurrenceSampling === true;
  const variableAccountId = useOccurrence ? pickVariableExpenseAccount(input.accounts) : null;

  const variableExpenses: VariableExpenseBaseline[] = [];
  const occurrenceEvents: PlannedForecastEvent[] = [];
  const variableByCategory: CategoryAssumption[] = [];

  for (const b of input.variableExpenses ?? []) {
    // Occurrence-Pfad: Baselines mit Modell werden als Ereignisse gezogen und
    // verlassen die geglättete Baseline.
    if (useOccurrence && b.occurrenceModel && variableAccountId) {
      const events = buildOccurrenceEvents(b, variableAccountId, startISO, horizonMonths, normal, rng);
      occurrenceEvents.push(...events);
      if (collectAssumptions) {
        const monthly: Record<string, number> = {};
        for (const month of monthKeys) monthly[month] = 0;
        // Ereignisbeträge sind signiert-negativ (Abfluss); je Monat aufaddieren.
        for (const ev of events) {
          const monthKey = ev.date.slice(0, 7);
          monthly[monthKey] = round2((monthly[monthKey] ?? 0) - ev.amount);
        }
        variableByCategory.push({
          category: b.category,
          plannedMonthly: b.budgetOverride ?? b.monthlyAmount,
          monthly,
        });
      }
      continue;
    }
    const confidenceFloor =
      b.confidence == null ? 0 : b.confidence < 0.6 ? 0.5 : b.confidence < 0.85 ? 0.25 : 0.1;
    const cv = Math.max(mc.variableVolatility ?? b.volatility ?? 0, confidenceFloor);
    const effective = b.budgetOverride ?? b.monthlyAmount;
    const monthlyAmounts = Object.fromEntries(
      monthKeys.map((month) => [month, round2(effective * lognormalMultiplier(normal, cv))]),
    );
    variableExpenses.push({ ...b, monthlyAmounts });
    if (collectAssumptions) {
      variableByCategory.push({ category: b.category, plannedMonthly: effective, monthly: { ...monthlyAmounts } });
    }
  }

  const income: IncomeAssumption[] = [];
  const recurringFlows: RecurringFlow[] = (input.recurringFlows ?? []).map((f) => {
    if (f.amount > 0 && mc.incomeVolatility > 0) {
      const mult = lognormalMultiplier(normal, mc.incomeVolatility);
      const sampled = round2(f.amount * mult);
      if (collectAssumptions) income.push({ name: f.name, planned: f.amount, sampled });
      return { ...f, amount: sampled };
    }
    return f;
  });

  const plannedEvents = occurrenceEvents.length
    ? [...(input.plannedEvents ?? []), ...occurrenceEvents]
    : input.plannedEvents;

  return {
    input: { ...input, variableExpenses, recurringFlows, plannedEvents },
    assumptions: collectAssumptions ? { variableByCategory, income } : null,
  };
}

/** Linear interpoliertes Perzentil eines aufsteigend sortierten Arrays. */
export function percentile(sorted: number[], p: number): number {
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
  const startDate = config.startDate ?? format(new Date(), 'yyyy-MM-dd');
  const horizonMonths = Math.max(config.months ?? 6, 6);
  const monthKeys = Array.from({ length: horizonMonths }, (_, index) =>
    format(addMonths(parseISO(startDate), index), 'yyyy-MM'),
  );

  let byDay: number[][] = [];
  const lowestArr: number[] = [];
  const endingNwArr: number[] = [];
  let breaches = 0;
  // Pfad-major (paths[trial][tag]) – nur befüllt, wenn collectPaths aktiv ist.
  const paths: number[][] | null = mc.collectPaths ? [] : null;
  // Gezogene Annahmen je Trial – nur befüllt, wenn collectAssumptions aktiv ist.
  const collectAssumptions = mc.collectAssumptions === true;
  const assumptions: TrialAssumptions[] | null = collectAssumptions ? [] : null;

  for (let t = 0; t < resolvedMc.trials; t++) {
    const perturbed = perturbInput(
      input,
      normal,
      rng,
      resolvedMc,
      monthKeys,
      startDate,
      horizonMonths,
      collectAssumptions,
    );
    if (assumptions && perturbed.assumptions) assumptions.push(perturbed.assumptions);
    const result = calculateDeterministicForecast(perturbed.input, config);
    if (!dates) {
      dates = result.daily.map((d) => d.date);
      resolvedConfig = result.config;
      byDay = dates.map(() => [] as number[]);
    }
    const trialPath = paths ? new Array<number>(result.daily.length) : null;
    result.daily.forEach((p, i) => {
      const cash = useAvailable ? p.availableCash : p.operatingCash;
      byDay[i].push(cash);
      if (trialPath) trialPath[i] = cash;
    });
    if (paths && trialPath) paths.push(trialPath);
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
    ...(paths ? { paths } : {}),
    ...(assumptions ? { assumptions } : {}),
  };
}
