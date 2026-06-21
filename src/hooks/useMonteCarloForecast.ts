import { useEffect, useState } from 'react';
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
): { result: MonteCarloResult | null; isCalculating: boolean } {
  const { months, safetyBuffer, bufferBasis, startDate } = config;
  const { trials, seed, variableVolatility, incomeVolatility } = mc;

  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (!enabled || !input) {
      setResult(null);
      setIsCalculating(false);
      return;
    }

    setResult(null);
    setIsCalculating(true);
    const worker = new Worker(
      new URL('../workers/forecast-montecarlo.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (event: MessageEvent<MonteCarloResult>) => {
      setResult(event.data);
      setIsCalculating(false);
      worker.terminate();
    };
    worker.onerror = () => {
      setResult(null);
      setIsCalculating(false);
      worker.terminate();
    };
    worker.postMessage({
      input,
      config: { months, safetyBuffer, bufferBasis, startDate },
      monteCarlo: { trials, seed, variableVolatility, incomeVolatility },
    });

    return () => worker.terminate();
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

  return { result, isCalculating };
}
