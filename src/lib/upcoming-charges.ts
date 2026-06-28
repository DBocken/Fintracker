/**
 * Anstehende Abbuchungen & Geldeingänge – ein geteilter Selektor.
 *
 * Beide neuen Features ("Welche Abbuchungen stehen als Nächstes an?" und
 * "Verfügbar bis Gehalt") brauchen dieselbe Frage beantwortet: *welche
 * wiederkehrenden Zahlungen fallen wann an?*. Diese Datei ist die EINE Quelle
 * dafür. Sie baut nichts neu, sondern expandiert die bereits vorzeichen-
 * behafteten, konto-gebundenen {@link RecurringFlow}s (Gehalt + Verträge,
 * status-gefiltert) über den kalender-korrekten {@link listFlowOccurrences}.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { RecurringFlow } from '@/lib/forecast-types';
import { listFlowOccurrences } from '@/lib/forecast';

const ISO = 'yyyy-MM-dd';

export interface UpcomingCharge {
  flowId: string;
  name: string;
  /** Fälligkeitsdatum (ISO yyyy-mm-dd). */
  dateISO: string;
  /** Signierter Betrag (negativ = Ausgabe/Abbuchung, positiv = Eingang). */
  amount: number;
  category?: string;
  accountId: string;
  /** Kalendertage von `fromISO` bis `dateISO` (0 = heute). */
  daysUntil: number;
  direction: 'expense' | 'income';
}

export interface UpcomingChargesOptions {
  /** Fensterbeginn (ISO yyyy-mm-dd), inklusive. */
  fromISO: string;
  /** Fensterende (ISO yyyy-mm-dd), inklusive. Alternativ `horizonDays`. */
  toISO?: string;
  /** Fensterlänge in Tagen ab `fromISO` (Default 30), nur wenn `toISO` fehlt. */
  horizonDays?: number;
}

/**
 * Alle Fälligkeiten der übergebenen Flows im Fenster [fromISO, toISO], aufsteigend
 * nach Datum sortiert. Deaktivierte Flows (beendete/abgelehnte/pausierte Verträge)
 * und Null-Beträge werden übersprungen. `toISO` hat Vorrang vor `horizonDays`.
 */
export function getUpcomingCharges(
  flows: RecurringFlow[],
  options: UpcomingChargesOptions,
): UpcomingCharge[] {
  const { fromISO } = options;
  const endISO =
    options.toISO ??
    format(addDays(parseISO(fromISO), Math.max(0, options.horizonDays ?? 30)), ISO);

  // Leeres/negatives Fenster → keine Fälligkeiten (listFlowOccurrences ist
  // inklusiv; ein Ende vor dem Anfang liefert ohnehin nichts).
  if (endISO < fromISO) return [];

  const from = parseISO(fromISO);
  const charges: UpcomingCharge[] = [];

  for (const flow of flows) {
    if (flow.disabled) continue;
    if (!Number.isFinite(flow.amount) || flow.amount === 0) continue;

    for (const dateISO of listFlowOccurrences(flow, fromISO, endISO)) {
      charges.push({
        flowId: flow.id,
        name: flow.name,
        dateISO,
        amount: flow.amount,
        category: flow.category,
        accountId: flow.accountId,
        daysUntil: differenceInCalendarDays(parseISO(dateISO), from),
        direction: flow.amount < 0 ? 'expense' : 'income',
      });
    }
  }

  // Primär nach Datum; gleicher Tag → größere Beträge zuerst, dann Name (stabil).
  charges.sort(
    (a, b) =>
      a.dateISO.localeCompare(b.dateISO) ||
      Math.abs(b.amount) - Math.abs(a.amount) ||
      a.name.localeCompare(b.name),
  );

  return charges;
}

/** Nur die Abbuchungen (Ausgaben) eines Fensters. */
export function expenseCharges(charges: UpcomingCharge[]): UpcomingCharge[] {
  return charges.filter((c) => c.direction === 'expense');
}

/** Summe der Abbuchungen eines Fensters als positive Zahl. */
export function sumExpenses(charges: UpcomingCharge[]): number {
  return charges.reduce((sum, c) => (c.direction === 'expense' ? sum + Math.abs(c.amount) : sum), 0);
}

/**
 * Der nächste Geldeingang (Gehalt/Einnahme) ab `fromISO`, oder null. Da
 * {@link getUpcomingCharges} aufsteigend nach Datum sortiert, ist der erste
 * Eingang automatisch der früheste – inkl. korrektem Vorrollen in die Zukunft,
 * falls der Anker eines Flows in der Vergangenheit liegt.
 */
export function getNextIncomeCharge(
  flows: RecurringFlow[],
  options: UpcomingChargesOptions,
): UpcomingCharge | null {
  return getUpcomingCharges(flows, options).find((c) => c.direction === 'income') ?? null;
}
