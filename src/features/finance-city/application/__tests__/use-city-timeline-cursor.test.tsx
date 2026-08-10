/**
 * WP 6.4 (ARCH-5): Position und Beschriftung der Monatsleiste. Lagen als zwei
 * `useMemo` plus ein `useCallback` in `CityPage.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CityMonth } from '../../domain/city-timeline';
import { useCityTimelineCursor } from '../use-city-timeline-cursor';

const TIMELINE: CityMonth[] = [
  { key: '2026-06', kind: 'past' },
  { key: '2026-07', kind: 'past' },
  { key: '2026-08', kind: 'current' },
  { key: '2026-09', kind: 'future' },
];

/**
 * Alle Parameter sind ausdruecklich uebergebbar — auch als explizites
 * `undefined`, dann greift die jeweilige Vorgabe.
 */
function renderCursor(options?: {
  timeline?: CityMonth[];
  selectedMonth?: string | null;
  onSelectMonth?: (key: string) => void;
  locale?: string;
}) {
  const onSelectMonth = options?.onSelectMonth ?? vi.fn();
  const result = renderHook(() =>
    useCityTimelineCursor({
      timeline: options?.timeline ?? TIMELINE,
      selectedMonth: options?.selectedMonth ?? null,
      onSelectMonth,
      locale: options?.locale ?? 'de',
    }),
  );
  return { ...result, onSelectMonth };
}

describe('useCityTimelineCursor', () => {
  it('sollte ohne Auswahl auf dem laufenden Monat stehen', () => {
    const { result } = renderCursor();

    expect(result.current.index).toBe(2);
    expect(result.current.month?.key).toBe('2026-08');
  });

  it('sollte den gewaehlten Monat anzeigen', () => {
    const { result } = renderCursor({ selectedMonth: '2026-06' });

    expect(result.current.index).toBe(0);
    expect(result.current.month?.key).toBe('2026-06');
  });

  it('sollte einen Prognosemonat als solchen melden', () => {
    const { result } = renderCursor({ selectedMonth: '2026-09' });

    expect(result.current.isForecast).toBe(true);
  });

  it('sollte den laufenden Monat NICHT als Prognose melden', () => {
    const { result } = renderCursor();

    expect(result.current.isForecast).toBe(false);
  });

  it('sollte den Monatsnamen in der App-Sprache beschriften', () => {
    const { result } = renderCursor({ selectedMonth: '2026-06', locale: 'de' });
    expect(result.current.label).toBe('Juni 2026');

    const englisch = renderCursor({ selectedMonth: '2026-06', locale: 'en' });
    expect(englisch.result.current.label).toBe('June 2026');
  });

  it('sollte einen Schritt zurueck den vorherigen Monat waehlen lassen', () => {
    const { result, onSelectMonth } = renderCursor({ selectedMonth: '2026-08' });

    act(() => result.current.step(-1));

    expect(onSelectMonth).toHaveBeenCalledWith('2026-07');
  });

  it('sollte am Rand der Zeitachse nicht weiterschalten', () => {
    const { result, onSelectMonth } = renderCursor({ selectedMonth: '2026-09' });

    expect(result.current.canStepForward).toBe(false);
    act(() => result.current.step(1));

    expect(onSelectMonth).not.toHaveBeenCalled();
  });

  it('sollte am linken Rand kein Zurueck anbieten', () => {
    const { result } = renderCursor({ selectedMonth: '2026-06' });

    expect(result.current.canStepBack).toBe(false);
    expect(result.current.canStepForward).toBe(true);
  });

  it('sollte bei leerer Zeitachse keinen Monat und keine Beschriftung liefern', () => {
    const { result } = renderCursor({ timeline: [] });

    expect(result.current.index).toBe(-1);
    expect(result.current.month).toBeUndefined();
    expect(result.current.label).toBe('');
  });

  it('sollte auf den ersten Monat fallen, wenn der gewaehlte Monat nicht mehr existiert', () => {
    const { result } = renderCursor({ selectedMonth: '1999-01' });

    expect(result.current.index).toBe(0);
  });
});
