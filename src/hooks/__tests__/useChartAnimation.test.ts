import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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

  it('sollte animationEasing als MOTION_EASINGS.build liefern', () => {
    const { result } = renderHook(() => useChartAnimation());
    expect(result.current.animationEasing).toBe('cubic-bezier(0.33, 1, 0.68, 1)');
  });

  it('sollte bei reduced-motion animationDuration 0 liefern', () => {
    reduceMock.mockReturnValue(true);
    const { result } = renderHook(() => useChartAnimation());
    expect(result.current.animationDuration).toBe(0);
  });
});
