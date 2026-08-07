import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getForecastOverrides, saveForecastOverrides } from '@/services/forecast-overrides-service';
import { DEFAULT_FORECAST_OVERRIDES, type ForecastOverrides } from '@/lib/forecast-types';

/**
 * Verwaltet die Forecast-Planungs-Overrides mit Persistenz.
 *
 * - `updateConfig`: reine Anzeige-/Rechenparameter (Horizont, Puffer, Basis).
 *   Lösen kein Refetch aus – die Engine rechnet neu im useMemo.
 * - `updatePlanning`: seed-relevante Felder (Zinsen, Budgets, Events,
 *   Rücklagen). Invalidieren den Forecast-Input, damit neu geladen wird.
 */
export function useForecastOverrides() {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<ForecastOverrides>(DEFAULT_FORECAST_OVERRIDES);

  useEffect(() => {
    let cancelled = false;
    void getForecastOverrides().then((stored) => {
      if (!cancelled) setOverrides(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(
    (patch: Partial<ForecastOverrides>, invalidate: boolean) => {
      setOverrides((prev) => {
        const next = { ...prev, ...patch };
        void saveForecastOverrides(next);
        if (invalidate) {
          void queryClient.invalidateQueries({ queryKey: ['forecast-input'] });
        }
        return next;
      });
    },
    [queryClient],
  );

  const updateConfig = useCallback(
    (patch: Partial<ForecastOverrides>) => apply(patch, false),
    [apply],
  );

  const updatePlanning = useCallback(
    (patch: Partial<ForecastOverrides>) => apply(patch, true),
    [apply],
  );

  return { overrides, updateConfig, updatePlanning };
}
