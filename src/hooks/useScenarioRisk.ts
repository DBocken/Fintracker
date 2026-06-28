import { useEffect, useState } from 'react';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import type { MonteCarloConfig } from '@/lib/forecast-montecarlo-types';
import type { LumpyRiskProfile } from '@/lib/finrisk/lumpy-risk';
import type { ScenarioPayload, ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

/**
 * Wertet ein FinRisk-Szenario lokal im Web-Worker aus (zwei Monte-Carlo-Läufe
 * mit Pfaden + Stress-Capacity/Breach/Diagnose). Läuft nur, wenn `payload`
 * gesetzt ist; das Ergebnis ist mit festem Seed reproduzierbar.
 */
export function useScenarioRisk(
  input: ForecastInput | null,
  config: ForecastConfig,
  payload: ScenarioPayload | null,
  options: { monteCarlo?: MonteCarloConfig; lumpy?: LumpyRiskProfile } = {},
): { result: ScenarioResult | null; isCalculating: boolean } {
  const { months, safetyBuffer, bufferBasis, startDate, overdraftAnnualRate, adaptiveSpending } = config;
  const payloadKey = payload ? JSON.stringify(payload) : null;
  const mcKey = options.monteCarlo ? JSON.stringify(options.monteCarlo) : null;
  const adaptiveKey = adaptiveSpending ? JSON.stringify(adaptiveSpending) : null;

  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (!input || !payload) {
      setResult(null);
      setIsCalculating(false);
      return;
    }

    setResult(null);
    setIsCalculating(true);
    const worker = new Worker(
      new URL('../workers/finrisk-scenario.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (event: MessageEvent<ScenarioResult>) => {
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
      config: { months, safetyBuffer, bufferBasis, startDate, overdraftAnnualRate, adaptiveSpending },
      payload,
      monteCarlo: options.monteCarlo,
      lumpy: options.lumpy,
    });

    return () => worker.terminate();
    // payloadKey/mcKey/adaptiveKey serialisieren die relevanten Objekt-Eingaben stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, months, safetyBuffer, bufferBasis, startDate, overdraftAnnualRate, adaptiveKey, payloadKey, mcKey, options.lumpy]);

  return { result, isCalculating };
}
