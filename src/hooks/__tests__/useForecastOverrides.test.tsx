/**
 * WP 1.7 — `useForecastOverrides` auf das Query-Error-Muster umgebaut.
 *
 * Vorher konsumierte der Hook `getForecastOverrides()` per
 * `void promise.then(...)` **ohne `.catch`**. Ein geworfener Fehler (etwa ein
 * `VaultCorruptError`, WP 1.1) wäre damit eine unhandled Rejection gewesen —
 * kein Fehlerzustand, den eine Fläche darstellen könnte. `useQuery` fängt die
 * Rejection auf und hält sie als `isError`/`error`; `refetch` erlaubt den
 * zweiten Versuch, der in einer local-first App fast immer der
 * erfolgreiche ist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';
import { DEFAULT_FORECAST_OVERRIDES } from '@/lib/forecast-types';

vi.mock('@/services/forecast-overrides-service', () => ({
  getForecastOverrides: vi.fn(),
  saveForecastOverrides: vi.fn().mockResolvedValue(undefined),
}));

import { getForecastOverrides } from '@/services/forecast-overrides-service';
import { useForecastOverrides } from '../useForecastOverrides';

const getForecastOverridesMock = vi.mocked(getForecastOverrides);

beforeEach(() => {
  getForecastOverridesMock.mockReset();
});

describe('useForecastOverrides', () => {
  it('sollte Defaults liefern und isError=false melden, solange nichts schiefgeht', async () => {
    getForecastOverridesMock.mockResolvedValue({ ...DEFAULT_FORECAST_OVERRIDES, safetyBuffer: 1500 });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useForecastOverrides(), { wrapper });

    await waitFor(() => expect(result.current.overrides.safetyBuffer).toBe(1500));
    expect(result.current.isError).toBe(false);
  });

  it('[REGRESSION] sollte einen abgelehnten Ladeversuch als isError melden statt als unhandled Rejection zu verschwinden', async () => {
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (event: PromiseRejectionEvent) => unhandled.push(event.reason);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    getForecastOverridesMock.mockRejectedValue(new Error('Envelope korrupt'));
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useForecastOverrides(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Die abgelehnte Promise ist behandelt (react-query hat sie abgefangen) —
    // kein `unhandledrejection`-Event, egal wie lange man wartet.
    await new Promise((resolve) => setTimeout(resolve, 20));
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    expect(unhandled).toEqual([]);
  });

  it('sollte refetch() erneut laden lassen, nachdem der Fehler behoben wurde', async () => {
    getForecastOverridesMock.mockRejectedValueOnce(new Error('Envelope korrupt'));
    getForecastOverridesMock.mockResolvedValueOnce({ ...DEFAULT_FORECAST_OVERRIDES, safetyBuffer: 900 });
    const { wrapper } = createHookWrapper();

    const { result } = renderHook(() => useForecastOverrides(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    await result.current.refetch();

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.overrides.safetyBuffer).toBe(900);
  });
});
