import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  getQuarter,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction } from '@/types';
import type { DashboardRange } from './filter-constants';

export interface PeriodOption {
  /** Maschinen-Kennung, z.B. `2026`, `2026-Q2`, `2026-06`. */
  value: string;
  /** Anzeigelabel, z.B. „2026", „Q2 2026", „Juni 2026". */
  label: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Löst die konkrete Periode (Jahr/Quartal/Monat) zu einem Datumsintervall auf.
 * Gibt `null` zurück, wenn die Kennung nicht zur Granularität passt – Aufrufer
 * fallen dann auf „Gesamt" zurück.
 */
export function resolvePeriodRange(range: DashboardRange, period: string): DateRange | null {
  if (!period) return null;
  switch (range) {
    case 'Jahr': {
      const m = /^(\d{4})$/.exec(period);
      if (!m) return null;
      const d = new Date(Number(m[1]), 0, 1);
      return { start: startOfYear(d), end: endOfYear(d) };
    }
    case 'Quartal': {
      const m = /^(\d{4})-Q([1-4])$/.exec(period);
      if (!m) return null;
      const d = new Date(Number(m[1]), (Number(m[2]) - 1) * 3, 1);
      return { start: startOfQuarter(d), end: endOfQuarter(d) };
    }
    case 'Monat': {
      const m = /^(\d{4})-(\d{2})$/.exec(period);
      if (!m) return null;
      const month = Number(m[2]);
      if (month < 1 || month > 12) return null;
      const d = new Date(Number(m[1]), month - 1, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    default:
      return null;
  }
}

function yearKey(d: Date): string {
  return format(d, 'yyyy');
}
function quarterKey(d: Date): string {
  return `${format(d, 'yyyy')}-Q${getQuarter(d)}`;
}
function monthKey(d: Date): string {
  return format(d, 'yyyy-MM');
}

/**
 * Listet die in den Transaktionen tatsächlich vorhandenen Perioden der gewählten
 * Granularität, absteigend (neueste zuerst). So bietet die UI nur Perioden an,
 * für die auch Daten existieren.
 */
export function listAvailablePeriods(transactions: Transaction[], range: DashboardRange): PeriodOption[] {
  const seen = new Map<string, Date>();
  for (const t of transactions) {
    if (!t.date) continue;
    let d: Date;
    try {
      d = parseISO(t.date);
    } catch {
      continue;
    }
    if (Number.isNaN(d.getTime())) continue;
    let key: string;
    if (range === 'Jahr') key = yearKey(d);
    else if (range === 'Quartal') key = quarterKey(d);
    else if (range === 'Monat') key = monthKey(d);
    else continue;
    if (!seen.has(key)) seen.set(key, d);
  }

  const toLabel = (value: string, sample: Date): string => {
    if (range === 'Jahr') return value;
    if (range === 'Quartal') return `Q${getQuarter(sample)} ${format(sample, 'yyyy')}`;
    return format(sample, 'MMMM yyyy', { locale: de });
  };

  return Array.from(seen.entries())
    .map(([value, sample]) => ({ value, label: toLabel(value, sample) }))
    .sort((a, b) => (a.value < b.value ? 1 : a.value > b.value ? -1 : 0));
}
