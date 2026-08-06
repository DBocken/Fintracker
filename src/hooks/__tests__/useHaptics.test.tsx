import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHaptics, supportsHaptics } from '../useHaptics';
import { hapticPattern, hapticDurationMs, type HapticKind } from '@/lib/haptics';

/**
 * WP-7.8 — Haptisches Feedback (Mobil).
 *
 * Haptik ist ein unaufgeforderter körperlicher Reiz. Die beiden Fälle, in
 * denen geschwiegen werden MUSS, sind deshalb der Kern dieses Tests — nicht
 * die Muster selbst.
 */

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');

function mockVibrate(impl?: (pattern: number | number[]) => boolean) {
  Object.defineProperty(navigator, 'vibrate', {
    value: impl ?? vi.fn(() => true),
    configurable: true,
    writable: true,
  });
  return navigator.vibrate as ReturnType<typeof vi.fn>;
}

function removeVibrate() {
  Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
}

beforeEach(() => reduceMock.mockReturnValue(false));

afterEach(() => {
  if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
  else removeVibrate();
  reduceMock.mockReturnValue(false);
});

describe('hapticPattern', () => {
  const kinds: HapticKind[] = ['select', 'confirm', 'warn'];

  it('sollte für jeden Anlass ein Muster liefern', () => {
    for (const kind of kinds) {
      expect(hapticPattern(kind)).toBeDefined();
    }
  });

  it('sollte kurz bleiben', () => {
    // Haptik, die man bewusst wahrnimmt, ist zu lang: sie soll eine
    // Rückmeldung unterstreichen, nicht selbst eine sein.
    for (const kind of kinds) {
      expect(hapticDurationMs(kind)).toBeLessThanOrEqual(150);
      expect(hapticDurationMs(kind)).toBeGreaterThan(0);
    }
  });

  it('sollte Auswahl leiser als Warnung halten', () => {
    // Die Stufung muss der Bewegungssprache entsprechen: ein Umschalten ist
    // keine Budgetüberschreitung.
    expect(hapticDurationMs('select')).toBeLessThan(hapticDurationMs('warn'));
  });

  it('sollte die Warnung als Doppelimpuls ausführen', () => {
    // Ein Doppelimpuls ist als Unterbrechung lesbar, ein längerer einzelner
    // nur als stärker.
    const pattern = hapticPattern('warn');
    expect(Array.isArray(pattern)).toBe(true);
    expect((pattern as number[]).length).toBeGreaterThan(1);
  });
});

describe('useHaptics', () => {
  it('sollte auf einem fähigen Gerät vibrieren', () => {
    const vibrate = mockVibrate();
    const { result } = renderHook(() => useHaptics());

    result.current('confirm');

    expect(vibrate).toHaveBeenCalledWith(hapticPattern('confirm'));
  });

  it('sollte bei prefers-reduced-motion schweigen', () => {
    // Wer weniger Bewegung verlangt, will kein Summen in der Hand — beides
    // sind unaufgeforderte körperliche Reize.
    const vibrate = mockVibrate();
    reduceMock.mockReturnValue(true);
    const { result } = renderHook(() => useHaptics());

    result.current('warn');

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('sollte ohne Vibrations-Unterstützung folgenlos bleiben', () => {
    removeVibrate();
    const { result } = renderHook(() => useHaptics());

    expect(() => result.current('select')).not.toThrow();
  });

  it('[REGRESSION] sollte einen werfenden vibrate-Aufruf nicht durchschlagen lassen', () => {
    // Manche WebViews werfen, wenn die Seite im Hintergrund liegt. Eine
    // fehlgeschlagene Vibration darf niemals eine Aktion abbrechen — sie ist
    // Beiwerk, nicht Inhalt.
    mockVibrate(() => {
      throw new Error('NotAllowedError');
    });
    const { result } = renderHook(() => useHaptics());

    expect(() => result.current('confirm')).not.toThrow();
  });
});

describe('supportsHaptics', () => {
  it('sollte die Verfügbarkeit melden', () => {
    mockVibrate();
    expect(supportsHaptics()).toBe(true);
    removeVibrate();
    expect(supportsHaptics()).toBe(false);
  });
});
