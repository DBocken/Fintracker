import { describe, it, expect } from 'vitest';
import { buildIncomeBreakdown, buildIncomeOverTime } from '../income-breakdown';
import type { Transaction, Category, TransactionAllocation } from '@/types';
import { asTransactionId } from '@/lib/ids';

/**
 * Lag bis WP 6.6 in `src/lib/__tests__/analysis-data.test.ts` — mit dem Modul
 * mitgewandert (ARCH-6). Die Zusicherungen sind unverändert.
 */
describe('Income Breakdown & Over Time', () => {
  const incomeCategories: Category[] = [
    { id: 'anstellung', name: 'Anstellung', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'gehalt', name: 'Gehalt', filters: [], parent_id: 'anstellung', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'verkaeufe', name: 'Verkäufe', filters: [], parent_id: null, attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'onlineverkauf', name: 'Online-Verkäufe', filters: [], parent_id: 'verkaeufe', attributes: { ausgabenklasse: 'einkommen' } },
    { id: 'versicherungen', name: 'Versicherungen', filters: [], parent_id: null, attributes: { ausgabenklasse: 'essenziell' } },
  ];

  function itx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
    return {
      date: '2024-03-15',
      amount: 0,
      payee: '',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: false,
      ...overrides,
      id: asTransactionId(overrides.id ?? crypto.randomUUID()),
    };
  }

  describe('buildIncomeBreakdown', () => {
    it('gruppiert Einnahmen nach Haupt- und Unterkategorie, total === Summe', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: asTransactionId('2'), amount: 300, category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(2300);
      expect(result.groups).toHaveLength(2);
      const anstellung = result.groups.find((g) => g.id === 'anstellung');
      expect(anstellung?.value).toBe(2000);
      expect(anstellung?.children[0]).toMatchObject({ id: 'gehalt', value: 2000, share: 1 });
    });

    it('schließt Transfers und Ausgaben aus', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: asTransactionId('2'), amount: 1000, is_transfer: true }),
        itx({ id: asTransactionId('3'), amount: -50, category_id: 'versicherungen' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(2000);
    });

    it('positive Buchung in einer Nicht-Einkommens-Kategorie landet unter "Sonstige Zuflüsse"', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), amount: 15, category_id: 'versicherungen', description: 'Beitragsrückerstattung' }),
      ];
      const result = buildIncomeBreakdown(txs, incomeCategories);
      expect(result.total).toBe(15);
      expect(result.groups[0].id).toBe('__nonincome');
    });

    it('teilt eine aufgeteilte Buchung (Splits) korrekt auf zwei Einkommens-Subs auf', () => {
      const allocationsByTx = new Map<string, TransactionAllocation[]>([
        ['1', [
          { id: 'a1', transaction_id: '1', category_id: 'anstellung', subcategory_id: 'gehalt', amount_minor: 150000, source: 'manual' },
          { id: 'a2', transaction_id: '1', category_id: 'verkaeufe', subcategory_id: 'onlineverkauf', amount_minor: 50000, source: 'manual' },
        ]],
      ]);
      const txs: Transaction[] = [itx({ id: asTransactionId('1'), amount: 2000 })];
      const result = buildIncomeBreakdown(txs, incomeCategories, allocationsByTx);
      expect(result.total).toBe(2000);
      expect(result.groups.find((g) => g.id === 'anstellung')?.value).toBe(1500);
      expect(result.groups.find((g) => g.id === 'verkaeufe')?.value).toBe(500);
    });

    it('liefert leere Aufschlüsselung für leere Eingabe', () => {
      const result = buildIncomeBreakdown([], incomeCategories);
      expect(result).toEqual({ total: 0, groups: [] });
    });
  });

  describe('buildIncomeOverTime', () => {
    it('aggregiert Einnahmen je Monat und Hauptkategorie, aufsteigend sortiert', () => {
      const txs: Transaction[] = [
        itx({ id: asTransactionId('1'), date: '2024-02-01', amount: 2000, category_id: 'anstellung', subcategory_id: 'gehalt' }),
        itx({ id: asTransactionId('2'), date: '2024-01-01', amount: 300, category_id: 'verkaeufe', subcategory_id: 'onlineverkauf' }),
      ];
      const result = buildIncomeOverTime(txs, incomeCategories);
      expect(result.map((p) => p.month)).toEqual(['2024-01', '2024-02']);
      expect(result[1].byMain['anstellung']).toBe(2000);
    });

    it('liefert ein leeres Array für leere Eingabe', () => {
      expect(buildIncomeOverTime([], incomeCategories)).toEqual([]);
    });
  });
});
