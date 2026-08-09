import { describe, it, expect } from 'vitest';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import {
  DEFAULT_LEAD_DAYS,
  suggestTransactionsForEvent,
  suggestionWindow,
} from '../assignment-suggestions';

function tx(id: string, date: string, over: Omit<Partial<Transaction>, 'id'> = {}): Transaction {
  return {
    date,
    amount: -20,
    payee: 'P',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...over,
    id: asTransactionId(id),
  };
}

const flitter: SpecialCategory = {
  id: 'flitter',
  name: 'Flitterwochen',
  parent_id: 'hochzeit',
  start_date: '2026-09-01',
  end_date: '2026-09-14',
  lead_days: 14,
};

describe('Anlass-Vorschläge (S6)', () => {
  it('sollte das Fenster inkl. Vorlauf berechnen', () => {
    // 14 Tage vor dem 01.09. = 18.08.
    expect(suggestionWindow(flitter)).toEqual({ start: '2026-08-18', end: '2026-09-14' });
  });

  it('sollte eine Buchung im Vorlauf vorschlagen (Taucherset 2 Wochen vorher)', () => {
    const taucherset = tx('taucher', '2026-08-20', { payee: 'Amazon', amount: -180 });
    const restaurant = tx('rest', '2026-09-05', { amount: -45 });
    const result = suggestTransactionsForEvent(flitter, [taucherset, restaurant], []);
    expect(result.map((t) => t.id)).toEqual(['rest', 'taucher']); // Datum absteigend.
  });

  it('sollte Buchungen außerhalb des Fensters ausschließen', () => {
    const zuFrueh = tx('frueh', '2026-08-01'); // vor dem 18.08.
    const zuSpaet = tx('spaet', '2026-09-20'); // nach dem 14.09.
    const result = suggestTransactionsForEvent(flitter, [zuFrueh, zuSpaet], []);
    expect(result).toHaveLength(0);
  });

  it('sollte interne Überträge nicht vorschlagen (I5)', () => {
    const transfer = tx('tr', '2026-09-05', { is_transfer: true });
    const result = suggestTransactionsForEvent(flitter, [transfer], []);
    expect(result).toHaveLength(0);
  });

  it('sollte bereits zugeordnete Buchungen ausschließen', () => {
    const drin = tx('drin', '2026-09-05');
    const assigned: SpecialCategoryAssignment = {
      id: 'a1',
      special_category_id: 'flitter',
      transaction_id: 'drin',
      source: 'manual',
    };
    const result = suggestTransactionsForEvent(flitter, [drin], [assigned]);
    expect(result).toHaveLength(0);
  });

  it('sollte ohne Startdatum nichts vorschlagen', () => {
    const ohneZeitraum: SpecialCategory = { id: 'x', name: 'X', parent_id: null };
    expect(suggestionWindow(ohneZeitraum)).toBeNull();
    expect(suggestTransactionsForEvent(ohneZeitraum, [tx('a', '2026-09-05')], [])).toEqual([]);
  });

  it('sollte den Default-Vorlauf nutzen, wenn lead_days fehlt', () => {
    const ohneLead: SpecialCategory = { ...flitter, lead_days: null };
    const w = suggestionWindow(ohneLead)!;
    // 01.09. minus DEFAULT_LEAD_DAYS.
    expect(w.start).toBe('2026-08-18');
    expect(DEFAULT_LEAD_DAYS).toBe(14);
  });

  it('sollte bei offenem Ende und laufendem Anlass bis heute fenstern', () => {
    const offen: SpecialCategory = { ...flitter, end_date: null };
    const w = suggestionWindow(offen, { today: '2026-09-10' })!;
    expect(w.end).toBe('2026-09-10');
  });

  it('sollte bei offenem Ende und zukünftigem Anlass bis zum Startdatum fenstern (Vorab-Buchungen)', () => {
    const geplant: SpecialCategory = { ...flitter, end_date: null };
    // „Heute" liegt vor dem Start → Fenster kollabiert NICHT, es reicht bis zum Start.
    const w = suggestionWindow(geplant, { today: '2026-07-19' })!;
    expect(w).toEqual({ start: '2026-08-18', end: '2026-09-01' });
  });
});
