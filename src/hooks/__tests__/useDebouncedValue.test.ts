import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sollte den Anfangswert sofort liefern', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('sollte den neuen Wert erst nach dem Delay übernehmen', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    expect(result.current).toBe('a'); // vor dem Delay noch alt

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b'); // nach dem Delay neu
  });

  it('sollte bei schnellen Änderungen nur den letzten Wert übernehmen (Bündelung)', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 'abcd' });
    // Zwischendurch nie ein Zwischenwert.
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('abcd');
  });

  it('sollte den Timer beim Unmount aufräumen (kein später Wert-Set)', () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });
    unmount();
    // Nach dem Unmount dürfen keine Timer mehr feuern (kein Fehler, kein Update).
    expect(() => act(() => vi.advanceTimersByTime(500))).not.toThrow();
    expect(result.current).toBe('a');
  });
});
