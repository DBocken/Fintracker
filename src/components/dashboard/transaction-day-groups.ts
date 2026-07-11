import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction } from '@/types';

export interface DayGroup {
  /** ISO-Datum als stabiler Key (z. B. `2026-07-03`). */
  key: string;
  items: Transaction[];
  /** Tagessaldo = Summe der Beträge des Tages (Einnahmen positiv, Ausgaben negativ). */
  delta: number;
  /** Kontostand am Ende dieses Tages (rückwärts aus dem aktuellen Saldo abgeleitet). */
  runningBalance: number;
}

/** Cent-genaues Runden – verhindert Float-Drift beim Aufsummieren von Beträgen. */
function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Gruppiert (bereits absteigend sortierte) Transaktionen nach Kalendertag und
 * leitet je Tag den Tagessaldo (`delta`) sowie den Kontostand am Tagesende
 * (`runningBalance`) ab. Der jüngste Tag endet exakt auf `endingBalance` (dem
 * aktuellen Gesamtsaldo); ältere Tage werden rückwärts berechnet, indem der
 * Tagessaldo des jeweils jüngeren Tages wieder herausgerechnet wird.
 *
 * So entspricht die Kopfzeile jedes Tages dem echten Kontostand-Verlauf – die
 * Ableitung „von heute rückwärts" braucht keine Eröffnungssalden pro Tag.
 */
export function buildDayGroups(transactions: Transaction[], endingBalance: number): DayGroup[] {
  const byKey = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = tx.date;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(tx);
    else byKey.set(key, [tx]);
  }

  // Absteigend nach Tag ordnen (ISO-Daten sortieren lexikografisch = chronologisch).
  const keys = [...byKey.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  let balance = roundCents(endingBalance);
  const groups: DayGroup[] = [];
  for (const key of keys) {
    const items = byKey.get(key)!;
    const delta = roundCents(items.reduce((sum, tx) => sum + (tx.amount || 0), 0));
    groups.push({ key, items, delta, runningBalance: balance });
    // Der nächst ältere Tag endete um den Tagessaldo niedriger.
    balance = roundCents(balance - delta);
  }
  return groups;
}

export type FlatDayItem =
  | { type: 'heading'; group: DayGroup }
  | { type: 'row'; group: DayGroup; transaction: Transaction; isFirstRowOfDay: boolean };

/**
 * Flacht Tages-Gruppen zu einer einzelnen Item-Liste ab (Heading, dann Zeilen),
 * damit die Liste fenster-virtualisiert werden kann: der Virtualizer braucht
 * eine flache, indexierbare Sequenz. `isFirstRowOfDay` erhält die
 * Trennlinien-Optik (divide-y) über die absolute Positionierung hinweg.
 */
export function flattenDayGroups(groups: DayGroup[]): FlatDayItem[] {
  const flat: FlatDayItem[] = [];
  for (const group of groups) {
    flat.push({ type: 'heading', group });
    group.items.forEach((transaction, index) => {
      flat.push({ type: 'row', group, transaction, isFirstRowOfDay: index === 0 });
    });
  }
  return flat;
}

/**
 * Menschliche Tages-Überschrift wie im Buchungs-Schema: „Heute · Do 3.7.",
 * „Gestern · Mi 2.7." bzw. „Di 1.7." für weiter zurückliegende Tage.
 */
export function formatDayHeading(dateKey: string, now = new Date()): string {
  let date: Date;
  try {
    date = parseISO(dateKey);
  } catch {
    return dateKey;
  }
  if (Number.isNaN(date.getTime())) return dateKey;

  const short = format(date, 'EEEEEE d.M.', { locale: de });
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return `Heute · ${short}`;
  if (diff === 1) return `Gestern · ${short}`;
  return short;
}
