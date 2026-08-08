import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useIdleTimer } from '../useIdleTimer';

/**
 * WP 3.2 (SEC-2): generischer Inaktivitäts-Timer, den `LocalEncryptionProvider`
 * für den Auto-Lock verwendet. Der Hook selbst kennt keine Verschlüsselungs-
 * Domäne — reine DOM-Aktivität (+ optionaler Zusatzkanal) gegen eine
 * Zeitspanne. Getestet mit `vi.useFakeTimers()` statt echter Wartezeit
 * (Vorgabe WP 3.2).
 */
describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sollte onIdle nach Ablauf der Frist ohne Aktivität aufrufen', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ timeoutMs: 10_000, onIdle }));

    act(() => {
      vi.advanceTimersByTime(9_999);
    });
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('sollte den Timer bei einem DOM-Aktivitätsereignis zurücksetzen', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ timeoutMs: 10_000, onIdle }));

    act(() => {
      vi.advanceTimersByTime(9_000);
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(9_000);
    });
    // 18s seit Start, aber nur 9s seit der letzten Aktivität vergangen.
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('sollte bei timeoutMs=null keinen Timer starten', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ timeoutMs: null, onIdle }));

    act(() => {
      vi.advanceTimersByTime(1_000_000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('sollte einen zusätzlichen Aktivitätskanal (extraActivity) ebenfalls als Reset werten', () => {
    const onIdle = vi.fn();
    let pulse: (() => void) | undefined;
    const extraActivity = (listener: () => void) => {
      pulse = listener;
      return () => {
        pulse = undefined;
      };
    };

    renderHook(() => useIdleTimer({ timeoutMs: 10_000, onIdle, extraActivity }));

    act(() => {
      vi.advanceTimersByTime(9_000);
      pulse?.();
      vi.advanceTimersByTime(9_000);
    });
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('sollte beim Unmount aufräumen und danach nicht mehr feuern', () => {
    const onIdle = vi.fn();
    const { unmount } = renderHook(() => useIdleTimer({ timeoutMs: 10_000, onIdle }));

    unmount();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });
});
