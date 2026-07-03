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
import { listFlowOccurrences } from '../forecast';
import { percentile, runMonteCarloForecast } from '../forecast-montecarlo';
import type { ForecastConfig, ForecastInput, RecurringFlow } from '../forecast-types';
import type { MonteCarloConfig } from '../forecast-montecarlo-types';
import { payloadToScenario } from './scenario-payload-adapter';
import { calculateStressCapacity } from './stress-capacity';
import { calculateBreachProbabilities } from './breach';
import { buildDensityField, type DensityField } from './density';
import { generateRiskDiagnosis } from './risk-diagnosis';
import type { LumpyRiskProfile } from './lumpy-risk';
import type { CompositionItem, ScenarioPayload, ScenarioResult } from './scenario-payload-types';

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
 * Sammelt je Heatmap-Zelle (Tag × Wert-Bin) ALLE Durchläufe, deren Tageswert in
 * die Zelle fällt – sortiert nach Nähe zum Bin-Zentrum, der Repräsentant steht
 * also vorn. Eine Zelle bündelt oft mehrere „Lösungen" (unterschiedliche
 * Annahme-Kombinationen mit demselben Saldo); mit den Indizes kann die UI
 * Zell-Spannen/Durchschnitt zeigen und durch die konkreten Pfade blättern, ohne
 * die vollständigen Pfade über die Worker-Grenze zu klonen. Die Bin-Zuordnung
 * spiegelt exakt {@link buildDensityField} wider.
 */
function buildTrialsByCell(paths: number[][], density: DensityField): number[][][] {
  const { bins, binSize, valueMin, dates } = density;
  const nDays = dates.length;
  if (!(binSize > 0) || paths.length === 0) {
    return dates.map(() => Array.from({ length: bins }, () => []));
  }
  const result: number[][][] = new Array(nDays);
  for (let d = 0; d < nDays; d++) {
    const cells: number[][] = Array.from({ length: bins }, () => []);
    for (let trial = 0; trial < paths.length; trial++) {
      const v = paths[trial][d];
      if (!Number.isFinite(v)) continue;
      let b = Math.floor((v - valueMin) / binSize);
      if (b < 0) b = 0;
      else if (b >= bins) b = bins - 1;
      cells[b].push(trial);
    }
    for (let b = 0; b < bins; b++) {
      if (cells[b].length < 2) continue;
      const center = valueMin + (b + 0.5) * binSize;
      // Stabil: bei Distanz-Gleichstand bleibt der niedrigere Trial-Index vorn.
      cells[b].sort((s, t) => Math.abs(paths[s][d] - center) - Math.abs(paths[t][d] - center));
    }
    result[d] = cells;
  }
  return result;
}

/**
 * Baut die benannten, deterministischen Geldfluss-Posten (Einnahmen, Fixkosten-
 * Verträge, geplante Einmalposten) mit ihren Buchungen im Horizont. Nutzt
 * dieselbe Fälligkeits-Logik wie die Engine ({@link listFlowOccurrences}), damit
 * die Zell-Zusammensetzung exakt zum gerechneten Pfad passt. Variable Ausgaben
 * fehlen bewusst – die streuen je Pfad und kommen aus den Annahmen.
 */
function buildCompositionSchedule(input: ForecastInput, dates: string[]): CompositionItem[] {
  if (dates.length === 0) return [];
  const dayIndex = new Map<string, number>();
  dates.forEach((iso, i) => dayIndex.set(iso, i));
  const startISO = dates[0];
  const endISO = dates[dates.length - 1];
  const items: CompositionItem[] = [];

  const addItem = (name: string, group: CompositionItem['group'], isoDates: string[], amount: number) => {
    const bookings = isoDates
      .map((iso) => ({ day: dayIndex.get(iso) ?? -1, amount }))
      .filter((b) => b.day >= 0);
    if (bookings.length > 0) items.push({ name, group, bookings });
  };

  for (const flow of input.recurringFlows ?? []) {
    if (!flow.amount) continue;
    addItem(
      flow.name,
      flow.amount >= 0 ? 'income' : 'fixed',
      listFlowOccurrences(flow, startISO, endISO),
      flow.amount,
    );
  }

  for (const event of input.plannedEvents ?? []) {
    if (!event.amount) continue;
    if (event.cadence) {
      // Wiederkehrender Posten: wie ein Flow behandeln (Anker = Datum).
      const pseudo: RecurringFlow = {
        id: event.id,
        name: event.name,
        amount: event.amount,
        cadence: event.cadence,
        anchorDate: event.date,
        intervalDays: event.intervalDays,
        endDate: event.endDate,
        accountId: event.accountId,
      };
      addItem(event.name, 'event', listFlowOccurrences(pseudo, startISO, endISO), event.amount);
    } else {
      const within = event.date >= startISO && event.date <= endISO ? [event.date] : [];
      addItem(event.name, 'event', within, event.amount);
    }
  }

  return items;
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
  const scenarioInput = applyScenario(input, scenario);

  const baselineRun = runMonteCarloForecast(input, effectiveConfig, mc);
  const scenarioRun = runMonteCarloForecast(scenarioInput, effectiveConfig, mc);

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

  // Alle Durchläufe je Zelle (Repräsentant zuerst) aus denselben Pfaden –
  // ermöglicht klickbare Zell-Details mit Spannen/Durchschnitt und Blättern,
  // ohne alle Pfade über die Worker-Grenze zu klonen.
  const trialsByCell = buildTrialsByCell(mixedPaths, density);
  const representativeByCell = trialsByCell.map((row) => row.map((cell) => cell[0] ?? -1));

  // Benannte Geldfluss-Posten (Einnahmen/Fixkosten/geplante Posten) für die
  // vollständige Zell-Zusammensetzung. Basiert auf dem Szenario-Input, damit die
  // Posten zu den gemischten Pfaden passen (bei Wahrscheinlichkeit 1 exakt).
  const compositionSchedule = buildCompositionSchedule(scenarioInput, dates);

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
    trialsByCell,
    compositionSchedule,
  };
}
