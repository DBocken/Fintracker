/**
 * FinRisk – Szenario-Orchestrator (v27)
 *
 * Verbindet die Bausteine zu einer Auswertung: Payload → Szenario (Adapter) →
 * Monte-Carlo auf echten Pfaden → Mixture nach Eintrittswahrscheinlichkeit →
 * Stress-Capacity, Breach-Kurven und Diagnose. Reine Logik ohne IO; der
 * Engine-Kern (`calculateDeterministicForecast`, `runMonteCarloForecast`,
 * `applyScenario`) bleibt unverändert.
 *
 * Mixture: `probability < 1` ist eine Mischung über Pfade. Statt den Engine-Kern
 * zu verändern, werden Basis- und Szenario-Pfade mit identischem Seed gerechnet
 * und im Verhältnis `probability` gemischt – das entspricht dem v27-Referenz-
 * verhalten (`applyEventToPaths` betrifft einen Anteil der Pfade).
 */
import { format } from 'date-fns';
import { applyScenario } from '../forecast-scenario';
import { percentile, runMonteCarloForecast } from '../forecast-montecarlo';
import type { ForecastConfig, ForecastInput } from '../forecast-types';
import type { MonteCarloConfig } from '../forecast-montecarlo-types';
import { payloadToScenario } from './scenario-payload-adapter';
import { calculateStressCapacity } from './stress-capacity';
import { calculateBreachProbabilities } from './breach';
import { buildDensityField, type DensityField } from './density';
import { generateRiskDiagnosis } from './risk-diagnosis';
import type { LumpyRiskProfile } from './lumpy-risk';
import type { ScenarioPayload, ScenarioResult } from './scenario-payload-types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Mischt zwei gleich lange Mengen im Verhältnis `probability`: die ersten
 * `probability`-Anteil stammen aus `scenario`, der Rest aus `baseline`. Wird
 * sowohl für Pfade als auch für die parallel gesammelten Annahmen genutzt –
 * damit bleibt Index i in beiden Mengen derselbe Durchlauf.
 */
function mixByProbability<T>(baseline: T[], scenario: T[], probability: number): T[] {
  const p = Math.min(Math.max(probability, 0), 1);
  const affected = Math.round(scenario.length * p);
  return [...scenario.slice(0, affected), ...baseline.slice(affected)];
}

/**
 * Bestimmt je Heatmap-Zelle (Tag × Wert-Bin) den repräsentativen Durchlauf –
 * den Pfad, dessen Tageswert dem Bin-Zentrum am nächsten liegt. Liefert die
 * Trial-Indizes (`[tag][bin]`, -1 für leere Zellen), sodass die UI ohne die
 * vollständigen Pfade die Annahmen genau eines Pfads je Zelle zeigen kann. Die
 * Bin-Zuordnung spiegelt exakt {@link buildDensityField} wider.
 */
function buildRepresentativeByCell(paths: number[][], density: DensityField): number[][] {
  const { bins, binSize, valueMin, dates } = density;
  const nDays = dates.length;
  if (!(binSize > 0) || paths.length === 0) {
    return dates.map(() => new Array<number>(bins).fill(-1));
  }
  const result: number[][] = new Array(nDays);
  for (let d = 0; d < nDays; d++) {
    const reps = new Array<number>(bins).fill(-1);
    const bestDist = new Array<number>(bins).fill(Infinity);
    for (let trial = 0; trial < paths.length; trial++) {
      const v = paths[trial][d];
      if (!Number.isFinite(v)) continue;
      let b = Math.floor((v - valueMin) / binSize);
      if (b < 0) b = 0;
      else if (b >= bins) b = bins - 1;
      const center = valueMin + (b + 0.5) * binSize;
      const dist = Math.abs(v - center);
      if (dist < bestDist[b]) {
        bestDist[b] = dist;
        reps[b] = trial;
      }
    }
    result[d] = reps;
  }
  return result;
}

/** Median einer Tagesspalte über alle Pfade. */
function dailyBand(paths: number[][], dates: string[]) {
  return dates.map((date, day) => {
    const column = paths.map((p) => p[day]).sort((a, b) => a - b);
    return {
      date,
      p10: round2(percentile(column, 10)),
      p50: round2(percentile(column, 50)),
      p90: round2(percentile(column, 90)),
    };
  });
}

export interface RunScenarioOptions {
  monteCarlo?: MonteCarloConfig;
  /** Optionales Lumpy-Profil für die Diagnose. */
  lumpy?: LumpyRiskProfile;
}

/**
 * Wertet ein {@link ScenarioPayload} gegen einen {@link ForecastInput} aus.
 *
 * @param input   Die (override-bereinigten) Forecast-Eingaben.
 * @param config  Horizont/Puffer/Basis. `safetyBuffer` dient als Fallback-Schwelle.
 * @param payload Das auszuwertende Szenario.
 * @param options Monte-Carlo-Parameter und optionales Lumpy-Profil.
 */
export function runScenarioPayload(
  input: ForecastInput,
  config: ForecastConfig,
  payload: ScenarioPayload,
  options: RunScenarioOptions = {},
): ScenarioResult {
  const startISO = config.startDate ?? format(new Date(), 'yyyy-MM-dd');
  // Horizont so wählen, dass er die Szenario-Tage abdeckt (MC erzwingt min. 6 Monate).
  const neededMonths = Math.ceil(payload.timeHorizonDays / 30);
  const effectiveConfig: ForecastConfig = {
    ...config,
    months: Math.max(config.months ?? 0, neededMonths),
  };

  // Risiko-Pfade nutzen die spiky Occurrence-Amount-Stufe (PR 3), damit
  // Stress-Capacity und Breach realistische Saldo-Verläufe sehen. Kategorien
  // ohne Modell behalten automatisch die geglättete Perturbation.
  const mc: MonteCarloConfig = {
    ...options.monteCarlo,
    collectPaths: true,
    collectAssumptions: true,
    occurrenceSampling: options.monteCarlo?.occurrenceSampling ?? true,
  };
  const scenario = payloadToScenario(payload, startISO);

  const baselineRun = runMonteCarloForecast(input, effectiveConfig, mc);
  const scenarioRun = runMonteCarloForecast(
    applyScenario(input, scenario),
    effectiveConfig,
    mc,
  );

  // Auswertungsfenster auf den gefragten Horizont begrenzen. Der Monte-Carlo-Lauf
  // erzwingt einen 6-Monats-Boden für stabile Bänder; die Risiko-Kennzahlen
  // (Breach, Stress, Endsaldo, Heatmap) dürfen aber NICHT über ein längeres
  // Fenster als die gestellte Frage laufen – sonst wäre die kumulative
  // Bruchwahrscheinlichkeit künstlich aufgebläht.
  const fullDates = baselineRun.band.map((b) => b.date);
  const horizonDays = Math.max(1, Math.min(fullDates.length, payload.timeHorizonDays));
  const dates = fullDates.slice(0, horizonDays);
  const clipToHorizon = (paths: number[][]): number[][] =>
    horizonDays >= fullDates.length ? paths : paths.map((p) => p.slice(0, horizonDays));

  const baselinePaths = clipToHorizon(baselineRun.paths ?? []);
  const scenarioPaths = clipToHorizon(scenarioRun.paths ?? []);
  const probability = payload.probability ?? 1;
  const mixedPaths = mixByProbability(baselinePaths, scenarioPaths, probability);
  // Annahmen sind pro Durchlauf (tagunabhängig) – identisch mischen, damit Index
  // i in `mixedAssumptions` denselben Pfad wie in `mixedPaths` beschreibt.
  const mixedAssumptions = mixByProbability(
    baselineRun.assumptions ?? [],
    scenarioRun.assumptions ?? [],
    probability,
  );

  const daily = dailyBand(mixedPaths, dates);

  const lastDay = dates.length - 1;
  const baselineEndP50 =
    baselinePaths.length > 0 && lastDay >= 0
      ? round2(percentile(baselinePaths.map((p) => p[lastDay]).sort((a, b) => a - b), 50))
      : 0;
  const scenarioEndP50 = daily.at(-1)?.p50 ?? 0;

  const threshold = payload.thresholdAmount ?? config.safetyBuffer ?? 0;
  const confidenceLevels = payload.confidenceLevels ?? [0.8, 0.9, 0.95];
  const stressCapacity = calculateStressCapacity(mixedPaths, threshold, confidenceLevels);

  // Schwellen für Breach-Kurven: 0 € und der Mindestpuffer (dedupliziert).
  const breachThresholds = Array.from(new Set([0, threshold]));
  const breachProbabilities = calculateBreachProbabilities(mixedPaths, breachThresholds);

  // Dichtefeld der gemischten Pfade – Grundlage der Heatmap. 0 € und der Puffer
  // bleiben garantiert im Wertefenster, damit die Trennlinien sichtbar sind.
  const density = buildDensityField(mixedPaths, dates, { bins: 48, include: [0, threshold] });

  // Repräsentanten je Zelle aus denselben Pfaden – ermöglicht klickbare
  // Zell-Details, ohne alle Pfade über die Worker-Grenze zu klonen.
  const representativeByCell = buildRepresentativeByCell(mixedPaths, density);

  const diagnosis = generateRiskDiagnosis({
    baselineEndP50,
    scenarioEndP50,
    stressCapacity,
    lumpy: options.lumpy,
    threshold,
  });

  const warnings: string[] = [];
  if (mixedPaths.length < 200) {
    warnings.push('Wenige Monte-Carlo-Durchläufe – Bänder können instabil sein.');
  }
  if (threshold === 0) {
    warnings.push('Kein Mindestpuffer gesetzt – Stress-Tragfähigkeit gegen 0 € berechnet.');
  }

  return {
    scenarioId: payload.scenarioId,
    scenarioType: payload.scenarioType,
    baselineEndP50,
    scenarioEndP50,
    deltaEndP50: round2(scenarioEndP50 - baselineEndP50),
    breachProbabilities,
    stressCapacity,
    diagnosis: diagnosis.summary,
    warnings,
    daily,
    density,
    horizonDays,
    assumptions: mixedAssumptions,
    representativeByCell,
  };
}
