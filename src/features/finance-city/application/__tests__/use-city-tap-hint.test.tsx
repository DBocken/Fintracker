/**
 * WP 6.4 (ARCH-5): Erst-Besuch-Hinweis „Tippe auf ein Viertel" (WP-D3).
 * Lag als `useState`-Initializer mit try/catch plus `useCallback` in
 * `CityPage.tsx`; der Privacy-Modus-Pfad (Storage wirft) war dort nur
 * ueber einen gemounteten WebGL-Canvas erreichbar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CITY_TAP_HINT_DISMISSED_KEY, useCityTapHint } from '../use-city-tap-hint';

describe('useCityTapHint', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sollte den Hinweis beim ersten Besuch zeigen', () => {
    const { result } = renderHook(() => useCityTapHint());

    expect(result.current.visible).toBe(true);
  });

  it('sollte den Hinweis nach einem frueheren Besuch nicht mehr zeigen', () => {
    window.localStorage.setItem(CITY_TAP_HINT_DISMISSED_KEY, '1');

    const { result } = renderHook(() => useCityTapHint());

    expect(result.current.visible).toBe(false);
  });

  it('sollte den Hinweis dauerhaft ausblenden', () => {
    const { result } = renderHook(() => useCityTapHint());

    act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(window.localStorage.getItem(CITY_TAP_HINT_DISMISSED_KEY)).toBe('1');
  });

  it('sollte ein zweites Ausblenden nicht erneut schreiben', () => {
    const { result } = renderHook(() => useCityTapHint());
    act(() => result.current.dismiss());
    const setItem = vi.spyOn(window.localStorage, 'setItem');

    act(() => result.current.dismiss());

    expect(setItem).not.toHaveBeenCalled();
  });

  it('sollte bei blockiertem Storage (Privacy-Modus) den Hinweis sessionweise zeigen und ausblendbar bleiben', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage blockiert');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blockiert');
    });

    const { result } = renderHook(() => useCityTapHint());
    expect(result.current.visible).toBe(true);

    act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
  });
});
