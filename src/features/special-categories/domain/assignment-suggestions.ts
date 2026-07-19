import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { addDays, format, parseISO } from 'date-fns';

/**
 * Reine Vorschlags-Heuristik für Anlass-Zuordnungen. Kein I/O, kein React.
 *
 * Idee: Buchungen im Ereignis-Zeitfenster – inklusive eines Vorlaufs
 * (`lead_days`, Default 14) vor dem Start – sind Kandidaten (Taucherset-Fall:
 * 2 Wochen vor Abreise bestellt). Interne Überträge (I5) und bereits diesem
 * Anlass zugeordnete Buchungen werden ausgeschlossen.
 */

export const DEFAULT_LEAD_DAYS = 14;

export interface SuggestionOptions {
  /** Heutiges Datum (ISO `YYYY-MM-DD`) als Fensterende bei offenem Zeitraum. */
  today?: string;
}

/** Fenstergrenzen (ISO) für einen Anlass, oder null, wenn kein Startdatum gesetzt ist. */
export function suggestionWindow(
  cat: SpecialCategory,
  options: SuggestionOptions = {},
): { start: string; end: string } | null {
  if (!cat.start_date) return null;
  const lead = cat.lead_days ?? DEFAULT_LEAD_DAYS;
  const start = format(addDays(parseISO(cat.start_date), -lead), 'yyyy-MM-dd');
  const end = cat.end_date ?? options.today ?? format(new Date(), 'yyyy-MM-dd');
  return { start, end };
}

/**
 * Schlägt Buchungen vor, die zum Anlass `cat` passen könnten. Leeres Ergebnis,
 * wenn kein Startdatum gesetzt ist (ohne Zeitraum keine sinnvolle Heuristik).
 * Ergebnis ist nach Datum absteigend sortiert (jüngste zuerst).
 */
export function suggestTransactionsForEvent(
  cat: SpecialCategory,
  transactions: Transaction[],
  assignments: SpecialCategoryAssignment[],
  options: SuggestionOptions = {},
): Transaction[] {
  const window = suggestionWindow(cat, options);
  if (!window) return [];

  const alreadyAssigned = new Set(
    assignments
      .filter((a) => a.special_category_id === cat.id)
      .map((a) => a.transaction_id),
  );

  return transactions
    .filter((tx) => {
      if (tx.is_transfer) return false; // I5: interne Überträge nie vorschlagen.
      if (!tx.id || alreadyAssigned.has(tx.id)) return false;
      return tx.date >= window.start && tx.date <= window.end;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
