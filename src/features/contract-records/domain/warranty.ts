import { parseISO, format, addMonths } from 'date-fns';
import type { ContractRecord, PriceHistoryEntry } from '@/lib/schemas/contract-record.schema';

/**
 * Reine Ableitungen für Garantie und Preisverlauf (kein React, kein I/O).
 * Der Garantieablauf wird NIE gespeichert (AD5), sondern aus Kaufdatum +
 * Garantiedauer bzw. einem expliziten Garantieende berechnet.
 */

const ISO = 'yyyy-MM-dd';

/** Abgeleiteter Garantieablauf: explizites Ende oder Kaufdatum + Garantiedauer. */
export function warrantyExpiry(record: ContractRecord): string | null {
  if (record.warranty_end) return record.warranty_end;
  if (record.purchase_date && record.warranty_months != null) {
    return format(addMonths(parseISO(record.purchase_date), record.warranty_months), ISO);
  }
  return null;
}

/** Besteht am Stichtag noch Garantie? */
export function isUnderWarranty(record: ContractRecord, todayISO: string): boolean {
  const expiry = warrantyExpiry(record);
  return expiry != null && expiry >= todayISO;
}

/** Sortierter Preisverlauf (aufsteigend nach Datum, stabil). */
export function sortedPriceHistory(record: ContractRecord): PriceHistoryEntry[] {
  return [...(record.price_history ?? [])].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/** Jüngster bekannter Preis in Cent (oder null). */
export function latestPriceMinor(record: ContractRecord): number | null {
  const history = sortedPriceHistory(record);
  return history.length > 0 ? history[history.length - 1].amount_minor : null;
}

export interface PriceChange {
  date: string;
  fromMinor: number;
  toMinor: number;
  deltaMinor: number;
}

/** Erkannte Preisänderungen zwischen aufeinanderfolgenden Preisverlaufs-Punkten. */
export function detectPriceChanges(record: ContractRecord): PriceChange[] {
  const history = sortedPriceHistory(record);
  const changes: PriceChange[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    if (curr.amount_minor !== prev.amount_minor) {
      changes.push({
        date: curr.date,
        fromMinor: prev.amount_minor,
        toMinor: curr.amount_minor,
        deltaMinor: curr.amount_minor - prev.amount_minor,
      });
    }
  }
  return changes;
}
