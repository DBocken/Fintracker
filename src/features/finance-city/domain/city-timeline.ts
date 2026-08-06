/**
 * WP-5.2 — Zeitachse der Finanzstadt.
 *
 * Die Stadt zeigte bisher immer denselben Ausschnitt: alle geladenen Buchungen
 * auf einmal. „Wie sah der letzte Monat aus" und „was kommt auf mich zu" waren
 * beide nicht beantwortbar.
 *
 * Diese Datei entscheidet nur, WELCHE Monate wählbar sind und wie sie
 * einzuordnen sind. Woher die Zahlen kommen, ist eine andere Frage:
 * Vergangenheit und laufender Monat aus den echten Buchungen, Zukunft aus der
 * Prognose des bestehenden Forecasts (`@/lib/forecast-category-projection`) —
 * die Stadt rechnet keine eigene.
 *
 * Rein und browserfrei (README-Architekturtabelle, `domain/`).
 */

export type CityMonthKind = 'past' | 'current' | 'future';

export type CityMonth = {
  /** `yyyy-MM`. */
  key: string;
  kind: CityMonthKind;
};

/** Wie weit die Prognose reicht. Drei Monate: darüber hinaus trägt die Baseline die Aussage nicht mehr. */
export const DEFAULT_FUTURE_MONTHS = 3;
/** Wie weit zurück gewählt werden kann. Ein Jahr deckt den Jahresrhythmus ab, ohne die Leiste unbenutzbar zu machen. */
export const DEFAULT_PAST_MONTHS = 12;

const MONTH_KEY = /^\d{4}-\d{2}$/;

/** `yyyy-MM` + n Monate, rein rechnerisch (kein `Date`, keine Zeitzonen-Verschiebung). */
export function shiftMonth(monthKey: string, delta: number): string {
  if (!MONTH_KEY.test(monthKey)) return monthKey;
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const zeroBased = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(zeroBased / 12);
  const shiftedMonth = zeroBased - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth).padStart(2, '0')}`;
}

export type CityTimelineInput = {
  /** Monate (`yyyy-MM`), in denen es tatsächlich Buchungen gibt — Reihenfolge egal. */
  monthsWithData: readonly string[];
  /** Der laufende Monat (`yyyy-MM`). */
  nowMonth: string;
  futureMonths?: number;
  maxPastMonths?: number;
};

/**
 * Baut die wählbaren Monate, aufsteigend sortiert.
 *
 * Regeln:
 * - **Vergangenheit** nur, wo es Daten gibt. Ein leerer Monat wäre eine leere
 *   Stadt ohne Erklärung; die Leiste soll nicht ins Nichts führen.
 * - **Der laufende Monat ist immer dabei**, auch ohne Buchungen — er ist der
 *   Einstiegspunkt und darf nie fehlen.
 * - **Zukunft** ist immer Prognose, nie Datenbestand. Buchungen mit
 *   Datum in der Zukunft (vordatierte Erfassung) begründen deshalb KEINEN
 *   Vergangenheitsmonat: ein Monat, der Ist- und Prognosewerte mischt, wäre
 *   nicht mehr erklärbar.
 */
export function buildCityTimeline(input: CityTimelineInput): CityMonth[] {
  const { nowMonth } = input;
  if (!MONTH_KEY.test(nowMonth)) return [];

  const futureCount = Math.max(0, input.futureMonths ?? DEFAULT_FUTURE_MONTHS);
  const pastLimit = Math.max(0, input.maxPastMonths ?? DEFAULT_PAST_MONTHS);
  const earliestAllowed = shiftMonth(nowMonth, -pastLimit);

  const past = [...new Set(input.monthsWithData)]
    .filter((key) => MONTH_KEY.test(key) && key < nowMonth && key >= earliestAllowed)
    .sort();

  const future = Array.from({ length: futureCount }, (_, index) => shiftMonth(nowMonth, index + 1));

  return [
    ...past.map((key): CityMonth => ({ key, kind: 'past' })),
    { key: nowMonth, kind: 'current' },
    ...future.map((key): CityMonth => ({ key, kind: 'future' })),
  ];
}

/** Einordnung eines einzelnen Monats relativ zum laufenden — ohne die ganze Liste zu bauen. */
export function monthKind(monthKey: string, nowMonth: string): CityMonthKind {
  if (monthKey === nowMonth) return 'current';
  return monthKey < nowMonth ? 'past' : 'future';
}
