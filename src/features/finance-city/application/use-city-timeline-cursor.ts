/**
 * Position und Beschriftung der Monatsleiste (WP-5.2, herausgelöst in WP 6.4).
 *
 * Ohne gewählten Monat steht der Zeiger auf dem laufenden Monat — der
 * Vorgabe-Ausschnitt zeigt zwar ALLE Buchungen, aber „jetzt" ist der
 * ehrlichste Ankerpunkt für den nächsten Schritt in beide Richtungen.
 *
 * Bewusst Schritte statt eines Reglers: ein Regler suggeriert stufenlose Zeit,
 * tatsächlich sind es diskrete Monate.
 */

import { useCallback, useMemo } from 'react';
import { cityDateLocale } from '../domain/city-date-locale';
import type { CityMonth } from '../domain/city-timeline';

export type CityTimelineCursor = {
  /** Index in `timeline`; `-1` bei leerer Zeitachse. */
  index: number;
  month?: CityMonth;
  /** Monat + Jahr in der App-Sprache; leer bei leerer Zeitachse. */
  label: string;
  isForecast: boolean;
  canStepBack: boolean;
  canStepForward: boolean;
  step: (delta: number) => void;
};

export function useCityTimelineCursor(args: {
  timeline: CityMonth[];
  selectedMonth: string | null;
  onSelectMonth: (key: string) => void;
  locale: string;
}): CityTimelineCursor {
  const { timeline, selectedMonth, onSelectMonth, locale } = args;

  const index = useMemo(() => {
    if (timeline.length === 0) return -1;
    const target = selectedMonth ?? timeline.find((month) => month.kind === 'current')?.key;
    const found = timeline.findIndex((month) => month.key === target);
    return found === -1 ? 0 : found;
  }, [timeline, selectedMonth]);

  const month = index >= 0 ? timeline[index] : undefined;

  const label = useMemo(() => {
    if (!month) return '';
    const date = new Date(`${month.key}-01T12:00:00`);
    return date.toLocaleDateString(cityDateLocale(locale), { month: 'long', year: 'numeric' });
  }, [month, locale]);

  const step = useCallback(
    (delta: number) => {
      const next = timeline[index + delta];
      if (next) onSelectMonth(next.key);
    },
    [timeline, index, onSelectMonth],
  );

  return {
    index,
    month,
    label,
    isForecast: month?.kind === 'future',
    canStepBack: index > 0,
    canStepForward: index >= 0 && index < timeline.length - 1,
    step,
  };
}
