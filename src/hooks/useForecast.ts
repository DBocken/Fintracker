import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildForecastInput } from '@/lib/forecast-data';
import { calculateDeterministicForecast } from '@/lib/forecast';
import { analyzeRisk, type RiskAnalysis } from '@/lib/forecast-insights';
import type { ForecastConfig, ForecastResult, ForecastInput } from '@/lib/forecast-types';

/**
 * Lädt die echten Forecast-Eingaben (Konten, wiederkehrende Flows, variable
 * Baseline) und berechnet die deterministische Liquiditätsprojektion.
 *
 * Die teure, IO-behaftete Daten-Beschaffung läuft über react-query (gecached).
 * Die reine Engine rechnet danach in einem `useMemo` – Änderungen an der
 * Konfiguration (Horizont, Puffer …) lösen kein erneutes Laden aus.
 */
export function useForecast(config: ForecastConfig = {}): {
  forecast: ForecastResult | null;
  input: ForecastInput | null;
  analysis: RiskAnalysis | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { months, safetyBuffer, bufferBasis, startDate } = config;

  const query = useQuery({
    queryKey: ['forecast-input'],
    queryFn: buildForecastInput,
    staleTime: 5 * 60 * 1000,
  });

  const forecast = useMemo(() => {
    if (!query.data) return null;
    return calculateDeterministicForecast(query.data, {
      months,
      safetyBuffer,
      bufferBasis,
      startDate,
    });
  }, [query.data, months, safetyBuffer, bufferBasis, startDate]);

  const analysis = useMemo(() => {
    if (!query.data || !forecast) return null;
    return analyzeRisk(query.data, forecast);
  }, [query.data, forecast]);

  return {
    forecast,
    input: query.data ?? null,
    analysis,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
