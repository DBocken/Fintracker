import { useEffect, useState } from 'react';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import type {
  AffordabilityGoal,
  AffordabilityOptions,
  AffordabilityResult,
} from '@/lib/finrisk/affordability';

/**
 * Wertet „Frag dein Geld" (Leistbarkeit + Trade-off-Menü) lokal im Web-Worker
 * aus. Läuft nur, wenn `goal` gesetzt ist; das Ergebnis ist mit festem Seed
 * reproduzierbar. Schwer (inverse Monte-Carlo-Suche), daher abseits des Main-Threads.
 */
export function useAffordability(
  input: ForecastInput | null,
  config: ForecastConfig,
  goal: AffordabilityGoal | null,
  options: AffordabilityOptions = {},
): { result: AffordabilityResult | null; isCalculating: boolean } {
  const { months, safetyBuffer, bufferBasis, startDate, overdraftAnnualRate } = config;
  const goalKey = goal ? JSON.stringify(goal) : null;
  const optionsKey = JSON.stringify(options);

  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (!input || !goal) {
      setResult(null);
      setIsCalculating(false);
      return;
    }

    setResult(null);
    setIsCalculating(true);
    const worker = new Worker(new URL('../workers/affordability.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<AffordabilityResult>) => {
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
      config: { months, safetyBuffer, bufferBasis, startDate, overdraftAnnualRate },
      goal,
      options,
    });

    return () => worker.terminate();
    // goalKey/optionsKey serialisieren die relevanten Objekt-Eingaben stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, months, safetyBuffer, bufferBasis, startDate, overdraftAnnualRate, goalKey, optionsKey]);

  return { result, isCalculating };
}
