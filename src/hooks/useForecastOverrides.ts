import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getForecastOverrides,
  saveForecastOverrides,
  type ForecastOverrides,
} from '@/services/forecast-overrides-service';

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
  const [overrides, setOverrides] = useState<ForecastOverrides>(getForecastOverrides);

  const apply = useCallback(
    (patch: Partial<ForecastOverrides>, invalidate: boolean) => {
      setOverrides((prev) => {
        const next = { ...prev, ...patch };
        saveForecastOverrides(next);
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
