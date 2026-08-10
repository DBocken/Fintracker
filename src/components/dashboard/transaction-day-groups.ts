import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { t } from '@/i18n/serviceT';
import { resolveDateFnsLocale, weekdayAbbrevToken } from '@/i18n/date-fns-locale';
import { resolveInitialLocale } from '@/i18n/I18nProvider';
import type { Transaction, TransactionAllocation } from '@/types';

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
  | { type: 'row'; group: DayGroup; transaction: Transaction; isFirstRowOfDay: boolean }
  | {
      type: 'split';
      group: DayGroup;
      /** Buchung, zu der die Aufteilung gehört (Klick-Ziel + Einrückung). */
      transaction: Transaction;
      allocation: TransactionAllocation;
      /** Letzte sichtbare Aufteilung dieser Buchung (Baum-Optik `└` statt `├`). */
      isLastSplit: boolean;
    };

/**
 * Flacht Tages-Gruppen zu einer einzelnen Item-Liste ab (Heading, dann Zeilen),
 * damit die Liste fenster-virtualisiert werden kann: der Virtualizer braucht
 * eine flache, indexierbare Sequenz. `isFirstRowOfDay` erhält die
 * Trennlinien-Optik (divide-y) über die absolute Positionierung hinweg.
 *
 * `visibleSplits` (transaction_id → aktuell sichtbare Aufteilungen) reiht die
 * aufgeklappten Split-Zeilen direkt hinter ihre Buchung ein — bewusst als
 * eigene Flat-Items statt als verschachteltes Markup, damit der Virtualizer
 * ihre Höhen kennt.
 */
export function flattenDayGroups(
  groups: DayGroup[],
  visibleSplits: ReadonlyMap<string, TransactionAllocation[]> = new Map(),
): FlatDayItem[] {
  const flat: FlatDayItem[] = [];
  for (const group of groups) {
    flat.push({ type: 'heading', group });
    group.items.forEach((transaction, index) => {
      flat.push({ type: 'row', group, transaction, isFirstRowOfDay: index === 0 });
      const splits = transaction.id ? visibleSplits.get(transaction.id) ?? [] : [];
      splits.forEach((allocation, splitIndex) => {
        flat.push({
          type: 'split',
          group,
          transaction,
          allocation,
          isLastSplit: splitIndex === splits.length - 1,
        });
      });
    });
  }
  return flat;
}

/**
 * Menschliche Tages-Überschrift wie im Buchungs-Schema: „Heute · Do 3.7.",
 * „Gestern · Mi 2.7." bzw. „Di 1.7." für weiter zurückliegende Tage.
 * „Heute"/„Gestern" laufen über `serviceT` (kein React-Kontext in diesem
 * Modul) und folgen damit der aktuellen App-Sprache (`transactions.dayHeadingToday`
 * / `transactions.dayHeadingYesterday"). Das Wochentagskürzel folgt seit
 * WP 5.5b über `resolveDateFnsLocale` (`@/i18n/date-fns-locale`) derselben
 * Sprache — davor war es fest auf `date-fns/locale/de` verdrahtet (WP-5.5-
 * Befund: „Today · Mi 3.7.").
 *
 * Token-Breite folgt `weekdayAbbrevToken` (locale-bewusst, nicht einheitlich):
 * Deutsch/Russisch bleiben beim angestammten 2-stelligen Kürzel („Mi"/„пт" —
 * optisch UNVERÄNDERT), nur Englisch wechselt auf die 3-stellige, dort
 * übliche Form („Wed" statt „We") — Begründung im Kopfkommentar von
 * `weekdayAbbrevToken` (`@/i18n/date-fns-locale`).
 *
 * Bekannte Lücke (nicht Teil dieses Pakets): für weiter zurückliegende Tage
 * fehlt die Jahreszahl; bei Buchungen aus einem früheren Jahr ist „Di 1.7."
 * ohne Jahr mehrdeutig.
 */
export function formatDayHeading(dateKey: string, now = new Date()): string {
  let date: Date;
  try {
    date = parseISO(dateKey);
  } catch {
    return dateKey;
  }
  if (Number.isNaN(date.getTime())) return dateKey;

  const token = weekdayAbbrevToken(resolveInitialLocale());
  const short = format(date, `${token} d.M.`, { locale: resolveDateFnsLocale() });
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return `${t('transactions.dayHeadingToday', 'Heute')} · ${short}`;
  if (diff === 1) return `${t('transactions.dayHeadingYesterday', 'Gestern')} · ${short}`;
  return short;
}
