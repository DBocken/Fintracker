/**
 * Die Dichte am Hook — die Regel selbst prüft
 * `features/shared/domain/__tests__/display-density.test.ts` ohne DOM.
 *
 * Hier geht es um die zwei Dinge, die nur der Hook beantworten kann:
 * die Capacitor-Abfrage und dass der Wert beim ERSTEN Render schon stimmt
 * (ADR `darstellungsdichte.md`, Regel 7). Ein Hook, der die Dichte erst im
 * Effekt bestimmt, zeigt auf dem Telefon einen Wimpernschlag lang die
 * kompakte Fassung und baut sie dann um.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const isNativePlatform = vi.fn(() => false);
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

import { useDisplayDensity } from '../useDisplayDensity';

const echteBreite = window.innerWidth;

function setzeBreite(px: number) {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });
}

beforeEach(() => {
  isNativePlatform.mockReturnValue(false);
});

afterEach(() => {
  setzeBreite(echteBreite);
});

describe('useDisplayDensity', () => {
  it('sollte in der App fokussiert liefern, auch bei Tablet-Breite', () => {
    isNativePlatform.mockReturnValue(true);
    setzeBreite(1280);

    const { result } = renderHook(() => useDisplayDensity());

    expect(result.current).toBe('fokussiert');
  });

  it('sollte im Browser unter der Schwelle fokussiert liefern', () => {
    setzeBreite(412);

    const { result } = renderHook(() => useDisplayDensity());

    expect(result.current).toBe('fokussiert');
  });

  it('sollte im Browser ab der Schwelle kompakt liefern', () => {
    setzeBreite(1280);

    const { result } = renderHook(() => useDisplayDensity());

    expect(result.current).toBe('kompakt');
  });

  it('sollte den richtigen Wert schon beim ERSTEN Render liefern, nicht erst danach', () => {
    // Der Kern von Regel 7. `renderHook` gibt `result.current` nach dem
    // ersten Render zurück; stünde die Entscheidung in einem Effekt, wäre
    // hier noch der Startwert zu sehen und die Fläche würde sichtbar
    // umgebaut.
    setzeBreite(412);
    const renderZaehler = vi.fn();

    const { result } = renderHook(() => {
      renderZaehler();
      return useDisplayDensity();
    });

    expect(result.current).toBe('fokussiert');
    expect(renderZaehler).toHaveBeenCalledTimes(1);
  });
});
