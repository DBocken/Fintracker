/**
 * WP-9.3 — Verbindungszustand.
 *
 * Bis hierher gab es dazu **nichts**: `navigator.onLine` kam im gesamten
 * Quelltext genau einmal vor, dienst-intern. Ein Verbindungsverlust sah damit
 * aus wie ein Ausfall der App — obwohl in einer local-first App fast alles
 * weiterläuft.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from '../useOnlineStatus';

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
  setOnLine(true);
});

describe('useOnlineStatus (WP-9.3)', () => {
  it('sollte den Ausgangszustand aus navigator.onLine übernehmen', () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('sollte auf das offline-Ereignis reagieren', () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });

  it('sollte auf das online-Ereignis reagieren', () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('sollte seine Zuhörer beim Abbau wieder entfernen', () => {
    // Ohne das sammelt jeder Screen-Wechsel einen weiteren Zuhörer an, und
    // React warnt beim Setzen von Zustand auf einer abgebauten Komponente.
    setOnLine(true);
    const { unmount } = renderHook(() => useOnlineStatus());
    const before = window.dispatchEvent(new Event('offline'));
    expect(before).toBe(true);

    unmount();
    // Nach dem Abbau darf ein weiteres Ereignis keine Warnung mehr erzeugen.
    expect(() => window.dispatchEvent(new Event('offline'))).not.toThrow();
  });
});
