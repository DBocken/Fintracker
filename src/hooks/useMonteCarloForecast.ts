import { useMemo } from 'react';
import { runMonteCarloForecast } from '@/lib/forecast-montecarlo';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import type { MonteCarloConfig, MonteCarloResult } from '@/lib/forecast-montecarlo-types';

/**
 * Rechnet die Monte-Carlo-Bandbreite über der bereits geladenen Eingabe.
 *
 * Der Lauf ist rechenintensiv (viele Engine-Durchläufe), daher nur aktiv, wenn
 * `enabled` gesetzt ist. Das Ergebnis ist memoisiert und mit festem Seed
 * reproduzierbar; Änderungen an Input, Horizont/Puffer oder MC-Parametern lösen
 * eine Neuberechnung aus.
 */
export function useMonteCarloForecast(
  input: ForecastInput | null,
  config: ForecastConfig,
  mc: MonteCarloConfig,
  enabled: boolean,
): MonteCarloResult | null {
  const { months, safetyBuffer, bufferBasis, startDate } = config;
  const { trials, seed, variableVolatility, incomeVolatility } = mc;

  return useMemo(() => {
    if (!enabled || !input) return null;
    return runMonteCarloForecast(
      input,
      { months, safetyBuffer, bufferBasis, startDate },
      { trials, seed, variableVolatility, incomeVolatility },
    );
  }, [
    enabled,
    input,
    months,
    safetyBuffer,
    bufferBasis,
    startDate,
    trials,
    seed,
    variableVolatility,
    incomeVolatility,
  ]);
}
