import { describe, it, expect } from 'vitest';
import {
  buildCityTimeline,
  shiftMonth,
  monthKind,
  DEFAULT_FUTURE_MONTHS,
  DEFAULT_PAST_MONTHS,
} from '../city-timeline';

/**
 * WP-5.2 — welche Monate sind wählbar?
 *
 * Die Stadt zeigte immer alle geladenen Buchungen auf einmal. „Wie sah der
 * letzte Monat aus" und „was kommt auf mich zu" waren beide nicht
 * beantwortbar.
 */
describe('shiftMonth', () => {
  it('sollte innerhalb eines Jahres rechnen', () => {
    expect(shiftMonth('2026-03', 2)).toBe('2026-05');
    expect(shiftMonth('2026-05', -2)).toBe('2026-03');
  });

  it('sollte über Jahresgrenzen rechnen', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-01', -13)).toBe('2024-12');
  });

  it('sollte einen unbrauchbaren Schlüssel unverändert lassen', () => {
    expect(shiftMonth('kaputt', 1)).toBe('kaputt');
  });
});

describe('buildCityTimeline', () => {
  const NOW = '2026-06';

  it('sollte den laufenden Monat immer enthalten, auch ohne Daten', () => {
    // Er ist der Einstiegspunkt — ohne ihn hätte die Seite keinen Startzustand.
    const timeline = buildCityTimeline({ monthsWithData: [], nowMonth: NOW });
    expect(timeline.find((m) => m.key === NOW)).toEqual({ key: NOW, kind: 'current' });
  });

  it('sollte Vergangenheitsmonate nur anbieten, wo es Daten gibt', () => {
    // Ein leerer Monat wäre eine leere Stadt ohne Erklärung.
    const timeline = buildCityTimeline({ monthsWithData: ['2026-04', '2026-05'], nowMonth: NOW });
    const past = timeline.filter((m) => m.kind === 'past').map((m) => m.key);
    expect(past).toEqual(['2026-04', '2026-05']);
  });

  it('sollte immer die vorgesehene Zahl Zukunftsmonate anbieten', () => {
    const timeline = buildCityTimeline({ monthsWithData: [], nowMonth: NOW });
    const future = timeline.filter((m) => m.kind === 'future').map((m) => m.key);
    expect(future).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(future).toHaveLength(DEFAULT_FUTURE_MONTHS);
  });

  it('sollte aufsteigend sortiert sein', () => {
    const timeline = buildCityTimeline({
      monthsWithData: ['2026-05', '2026-01', '2026-03'],
      nowMonth: NOW,
    });
    const keys = timeline.map((m) => m.key);
    expect([...keys].sort()).toEqual(keys);
  });

  it('[REGRESSION] sollte vordatierte Buchungen KEINEN Vergangenheitsmonat begründen lassen', () => {
    // Zukunft ist immer Prognose, nie Datenbestand. Ein Monat, der Ist- und
    // Prognosewerte mischt, wäre nicht mehr erklärbar — und der Nutzer könnte
    // nicht sagen, welche Zahl woher kommt.
    const timeline = buildCityTimeline({ monthsWithData: ['2026-08'], nowMonth: NOW });
    const august = timeline.find((m) => m.key === '2026-08');
    expect(august?.kind).toBe('future');
    expect(timeline.filter((m) => m.kind === 'past')).toEqual([]);
  });

  it('sollte die Vergangenheit deckeln', () => {
    const many = Array.from({ length: 30 }, (_, index) => shiftMonth(NOW, -(index + 1)));
    const timeline = buildCityTimeline({ monthsWithData: many, nowMonth: NOW });

    const past = timeline.filter((m) => m.kind === 'past');
    expect(past.length).toBeLessThanOrEqual(DEFAULT_PAST_MONTHS);
    // Die JÜNGSTEN bleiben — der letzte Monat ist relevanter als der vor drei Jahren.
    expect(past.at(-1)?.key).toBe(shiftMonth(NOW, -1));
  });

  it('sollte doppelte Monatsangaben zusammenfassen', () => {
    const timeline = buildCityTimeline({ monthsWithData: ['2026-05', '2026-05'], nowMonth: NOW });
    expect(timeline.filter((m) => m.key === '2026-05')).toHaveLength(1);
  });

  it('sollte unbrauchbare Monatsangaben ignorieren', () => {
    const timeline = buildCityTimeline({ monthsWithData: ['kaputt', '', '2026-05'], nowMonth: NOW });
    expect(timeline.filter((m) => m.kind === 'past').map((m) => m.key)).toEqual(['2026-05']);
  });

  it('sollte bei unbrauchbarem Jetzt-Monat leer bleiben statt zu raten', () => {
    expect(buildCityTimeline({ monthsWithData: ['2026-05'], nowMonth: 'kaputt' })).toEqual([]);
  });
});

describe('monthKind', () => {
  it('sollte relativ zum laufenden Monat einordnen', () => {
    expect(monthKind('2026-05', '2026-06')).toBe('past');
    expect(monthKind('2026-06', '2026-06')).toBe('current');
    expect(monthKind('2026-07', '2026-06')).toBe('future');
  });
});
