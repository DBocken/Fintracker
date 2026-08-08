import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getForecastOverrides, saveForecastOverrides } from '@/services/forecast-overrides-service';
import { DEFAULT_FORECAST_OVERRIDES, type ForecastOverrides } from '@/lib/forecast-types';

export const FORECAST_OVERRIDES_QUERY_KEY = ['forecast-overrides'] as const;

/**
 * Verwaltet die Forecast-Planungs-Overrides mit Persistenz.
 *
 * - `updateConfig`: reine Anzeige-/Rechenparameter (Horizont, Puffer, Basis).
 *   Lösen kein Refetch aus – die Engine rechnet neu im useMemo.
 * - `updatePlanning`: seed-relevante Felder (Zinsen, Budgets, Events,
 *   Rücklagen). Invalidieren den Forecast-Input, damit neu geladen wird.
 *
 * [REGRESSION] (WP 1.7) Vorher las dieser Hook per `void promise.then(...)`
 * **ohne `.catch`** — ein von `getForecastOverrides()` geworfener
 * `VaultCorruptError` (WP 1.1) wäre eine unhandled Rejection gewesen statt
 * eines Fehlerzustands. `useQuery` fängt die Rejection auf, hält sie als
 * `isError`/`error` und erlaubt einen echten Wiederholversuch (`refetch`) —
 * das Query-Error-Muster, das der Rest der App für Ladefehler benutzt.
 */
export function useForecastOverrides() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: FORECAST_OVERRIDES_QUERY_KEY,
    queryFn: getForecastOverrides,
  });

  const overrides = query.data ?? DEFAULT_FORECAST_OVERRIDES;

  const apply = useCallback(
    (patch: Partial<ForecastOverrides>, invalidate: boolean) => {
      const next = { ...overrides, ...patch };
      // Optimistisch im Query-Cache halten, damit die Eingabe sofort
      // widergespiegelt wird — der Schreibvorgang selbst läuft async weiter.
      queryClient.setQueryData<ForecastOverrides>(FORECAST_OVERRIDES_QUERY_KEY, next);
      void saveForecastOverrides(next);
      if (invalidate) {
        void queryClient.invalidateQueries({ queryKey: ['forecast-input'] });
      }
    },
    [overrides, queryClient],
  );

  const updateConfig = useCallback(
    (patch: Partial<ForecastOverrides>) => apply(patch, false),
    [apply],
  );

  const updatePlanning = useCallback(
    (patch: Partial<ForecastOverrides>) => apply(patch, true),
    [apply],
  );

  return {
    overrides,
    updateConfig,
    updatePlanning,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
