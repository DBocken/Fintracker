import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MOTION_EASINGS_CHART } from '@/lib/motion-tokens';
import { useChartAnimation } from '../useChartAnimation';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

describe('useChartAnimation (WP-6.7)', () => {
  it('sollte animate=true bei normaler Bewegung liefern', () => {
    const { result } = renderHook(() => useChartAnimation());
    expect(result.current.animate).toBe(true);
  });

  it('sollte animate=false bei reduced-motion liefern', () => {
    reduceMock.mockReturnValue(true);
    const { result } = renderHook(() => useChartAnimation());
    expect(result.current.animate).toBe(false);
  });

  it('sollte animationDuration als MOTION_DURATIONS.slow liefern', () => {
    const { result } = renderHook(() => useChartAnimation());
    expect(result.current.animationDuration).toBe(600);
  });

  it('sollte animationEasing in der Recharts-Schreibweise von build liefern', () => {
    const { result } = renderHook(() => useChartAnimation());
    // Gegen die Konstante geprueft, nicht gegen einen kopierten String: Recharts
    // verlangt die Schreibweise ohne Leerzeichen (Template-Literal-Typ), die
    // Gleichheit beider Fassungen sichert motion-tokens.test.ts.
    expect(result.current.animationEasing).toBe(MOTION_EASINGS_CHART.build);
    expect(result.current.animationEasing).not.toContain(' ');
  });

  it('sollte bei reduced-motion animationDuration 0 liefern', () => {
    reduceMock.mockReturnValue(true);
    const { result } = renderHook(() => useChartAnimation());
    expect(result.current.animationDuration).toBe(0);
  });
});
