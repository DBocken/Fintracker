import { useMemo } from 'react';
import { calculateDeterministicForecast } from '@/lib/forecast';
import { applyScenario, compareForecastResults } from '@/lib/forecast-scenario';
import type { ForecastConfig, ForecastInput, ForecastResult } from '@/lib/forecast-types';
import type { ForecastScenario, ScenarioComparison } from '@/lib/forecast-scenario-types';

/**
 * Rechnet ein aktives Szenario gegen die bereits vorliegende Basis-Projektion.
 *
 * Die Basis (`baseline`) und der `input` stammen aus {@link useForecast}; das
 * Szenario transformiert den Input und läuft durch dieselbe pure Engine. So
 * wird nur das Szenario neu gerechnet – die Basis nicht doppelt. Ohne aktives
 * Szenario liefert der Hook `null`.
 */
export function useScenarioForecast(
  input: ForecastInput | null,
  baseline: ForecastResult | null,
  config: ForecastConfig,
  scenario: ForecastScenario | null,
): { scenarioResult: ForecastResult | null; comparison: ScenarioComparison | null } {
  const { months, safetyBuffer, bufferBasis, startDate } = config;

  const scenarioResult = useMemo(() => {
    if (!input || !scenario) return null;
    return calculateDeterministicForecast(applyScenario(input, scenario), {
      months,
      safetyBuffer,
      bufferBasis,
      startDate,
    });
  }, [input, scenario, months, safetyBuffer, bufferBasis, startDate]);

  const comparison = useMemo(() => {
    if (!baseline || !scenarioResult || !scenario) return null;
    return compareForecastResults(baseline, scenarioResult, scenario);
  }, [baseline, scenarioResult, scenario]);

  return { scenarioResult, comparison };
}
