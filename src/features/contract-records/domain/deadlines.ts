import { parseISO, format, addDays, addMonths, differenceInCalendarMonths } from 'date-fns';
import type { ContractRecord, ContractCycle } from '@/lib/schemas/contract-record.schema';

/**
 * Reine Ableitung der Vertragsfristen (kein React, kein I/O). Diese Werte werden
 * NIE gespeichert (AD5) — sie ergeben sich immer neu aus den Stammdaten, damit
 * keine veralteten Termine entstehen.
 */

const ISO = 'yyyy-MM-dd';
const CYCLE_MONTHS: Record<Exclude<ContractCycle, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** Effektives Ende der aktuellen Vertragsperiode (explizit oder aus Beginn + Mindestlaufzeit). */
export function resolveContractEnd(record: ContractRecord): string | null {
  if (record.vertragsende) return record.vertragsende;
  if (record.contract_start && record.min_term_months != null) {
    return format(addMonths(parseISO(record.contract_start), record.min_term_months), ISO);
  }
  return null;
}

/**
 * Spätester Kündigungstermin: Periodenende minus Kündigungsfrist. Bei
 * automatischer Verlängerung wird auf die nächste noch nicht verpasste
 * Periodengrenze weitergerollt, bis der Termin frühestens heute liegt.
 */
export function latestCancellationDate(record: ContractRecord, todayISO: string): string | null {
  const end0 = resolveContractEnd(record);
  if (!end0) return null;
  const notice = record.kuendigungsfrist_tage ?? 0;
  let end = parseISO(end0);
  let cancelBy = addDays(end, -notice);
  const renew = record.renewal_interval_months;
  if (renew && renew > 0) {
    let guard = 0;
    while (format(cancelBy, ISO) < todayISO && guard < 1000) {
      end = addMonths(end, renew);
      cancelBy = addDays(end, -notice);
      guard++;
    }
  }
  return format(cancelBy, ISO);
}

/** Restlaufzeit der aktuellen (ggf. weitergerollten) Periode in Monaten (≥ 0). */
export function remainingTermMonths(record: ContractRecord, todayISO: string): number | null {
  const cancelBy = latestCancellationDate(record, todayISO);
  if (!cancelBy) return null;
  const notice = record.kuendigungsfrist_tage ?? 0;
  const effectiveEnd = format(addDays(parseISO(cancelBy), notice), ISO);
  return Math.max(0, differenceInCalendarMonths(parseISO(effectiveEnd), parseISO(todayISO)));
}

/** Nächste Fälligkeit ab heute aus Anker + Zyklus (falls beides gesetzt). */
export function nextDueDate(record: ContractRecord, todayISO: string): string | null {
  if (!record.cycle || !record.next_due_anchor) return null;
  let due = parseISO(record.next_due_anchor);
  let guard = 0;
  if (record.cycle === 'weekly') {
    while (format(due, ISO) < todayISO && guard < 10000) {
      due = addDays(due, 7);
      guard++;
    }
  } else {
    const step = CYCLE_MONTHS[record.cycle];
    while (format(due, ISO) < todayISO && guard < 10000) {
      due = addMonths(due, step);
      guard++;
    }
  }
  return format(due, ISO);
}

export interface DeadlineView {
  contract_record_id: string;
  name: string;
  latestCancellationDate: string | null;
  nextDueDate: string | null;
  remainingTermMonths: number | null;
}

export function buildDeadlineView(record: ContractRecord, todayISO: string): DeadlineView {
  return {
    contract_record_id: record.id,
    name: record.name,
    latestCancellationDate: latestCancellationDate(record, todayISO),
    nextDueDate: nextDueDate(record, todayISO),
    remainingTermMonths: remainingTermMonths(record, todayISO),
  };
}

/**
 * In-App-Fristenliste (kein OS-Push): aktive Verträge, deren spätester
 * Kündigungstermin in den nächsten `withinDays` Tagen liegt — nach Termin
 * aufsteigend sortiert.
 */
export function upcomingCancellationDeadlines(
  records: ContractRecord[],
  todayISO: string,
  withinDays = 60,
): DeadlineView[] {
  const horizon = format(addDays(parseISO(todayISO), withinDays), ISO);
  return records
    .filter((r) => r.status === 'active')
    .map((r) => buildDeadlineView(r, todayISO))
    .filter(
      (v) =>
        v.latestCancellationDate != null &&
        v.latestCancellationDate >= todayISO &&
        v.latestCancellationDate <= horizon,
    )
    .sort((a, b) =>
      (a.latestCancellationDate ?? '') < (b.latestCancellationDate ?? '') ? -1 : 1,
    );
}
