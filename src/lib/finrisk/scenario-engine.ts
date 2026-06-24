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
import { generateRiskDiagnosis } from './risk-diagnosis';
import type { LumpyRiskProfile } from './lumpy-risk';
import type { ScenarioPayload, ScenarioResult } from './scenario-payload-types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Mischt zwei gleich lange Pfadmengen im Verhältnis `probability`. */
function mixPaths(
  baseline: number[][],
  scenario: number[][],
  probability: number,
): number[][] {
  const p = Math.min(Math.max(probability, 0), 1);
  const affected = Math.round(scenario.length * p);
  return [...scenario.slice(0, affected), ...baseline.slice(affected)];
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
    occurrenceSampling: options.monteCarlo?.occurrenceSampling ?? true,
  };
  const scenario = payloadToScenario(payload, startISO);

  const baselineRun = runMonteCarloForecast(input, effectiveConfig, mc);
  const scenarioRun = runMonteCarloForecast(
    applyScenario(input, scenario),
    effectiveConfig,
    mc,
  );

  const baselinePaths = baselineRun.paths ?? [];
  const scenarioPaths = scenarioRun.paths ?? [];
  const probability = payload.probability ?? 1;
  const mixedPaths = mixPaths(baselinePaths, scenarioPaths, probability);

  const dates = baselineRun.band.map((b) => b.date);
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

  const diagnosis = generateRiskDiagnosis({
    baselineEndP50,
    scenarioEndP50,
    stressCapacity,
    lumpy: options.lumpy,
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
  };
}
