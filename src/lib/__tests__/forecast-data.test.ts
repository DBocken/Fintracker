import { describe, it, expect } from 'vitest';
import { buildVariableExpenseBaselines, cycleToCadence, accountTypeToKind } from '@/lib/forecast-data';
import type { Transaction } from '@/types';

const NOW = new Date('2026-06-15');

function tx(partial: Partial<Transaction>): Transaction {
  return {
    date: '2026-06-01',
    amount: -10,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...partial,
  };
}

describe('buildVariableExpenseBaselines', () => {
  it('mittelt Ausgaben je Kategorie über die beobachteten Monate', () => {
    const txns: Transaction[] = [
      tx({ date: '2026-04-10', amount: -100, category: 'Lebensmittel' }),
      tx({ date: '2026-05-10', amount: -200, category: 'Lebensmittel' }),
      tx({ date: '2026-06-10', amount: -300, category: 'Lebensmittel' }),
    ];
    const result = buildVariableExpenseBaselines(txns, { now: NOW, monthsBack: 6 });
    // 3 Monate beobachtet, Summe 600 -> 200/Monat.
    expect(result).toEqual([{ category: 'Lebensmittel', monthlyAmount: 200, confidence: 0.75 }]);
  });

  it('ignoriert Einnahmen, Transfers und Verträge', () => {
    const txns: Transaction[] = [
      tx({ date: '2026-06-01', amount: 2500, category: 'Gehalt' }), // Einnahme
      tx({ date: '2026-06-02', amount: -500, category: 'Sparen', is_transfer: true }),
      tx({ date: '2026-06-03', amount: -50, category: 'Netflix', is_contract: true }),
      tx({ date: '2026-06-04', amount: -40, category: 'Restaurant' }),
    ];
    const result = buildVariableExpenseBaselines(txns, { now: NOW });
    expect(result).toEqual([{ category: 'Restaurant', monthlyAmount: 40, confidence: 0.5 }]);
  });

  it('blendet Transaktionen außerhalb des Fensters aus', () => {
    const txns: Transaction[] = [
      tx({ date: '2024-01-01', amount: -999, category: 'Alt' }),
      tx({ date: '2026-06-01', amount: -30, category: 'Neu' }),
    ];
    const result = buildVariableExpenseBaselines(txns, { now: NOW, monthsBack: 6 });
    expect(result.map((b) => b.category)).toEqual(['Neu']);
  });

  it('sortiert die größten Kategorien zuerst', () => {
    const txns: Transaction[] = [
      tx({ date: '2026-06-01', amount: -10, category: 'Klein' }),
      tx({ date: '2026-06-01', amount: -500, category: 'Groß' }),
    ];
    const result = buildVariableExpenseBaselines(txns, { now: NOW });
    expect(result.map((b) => b.category)).toEqual(['Groß', 'Klein']);
  });

  it('nutzt Sonstiges als Fallback-Kategorie', () => {
    const result = buildVariableExpenseBaselines([tx({ date: '2026-06-01', amount: -20 })], {
      now: NOW,
    });
    expect(result[0].category).toBe('Sonstiges');
  });
});

describe('Mapping-Helfer', () => {
  it('mappt Zyklen korrekt – Unbekannt wird ausgelassen', () => {
    expect(cycleToCadence('Monatlich')).toBe('monthly');
    expect(cycleToCadence('Halbjährlich')).toBe('semiannual');
    expect(cycleToCadence('Jährlich')).toBe('annual');
    expect(cycleToCadence('Unbekannt')).toBeNull();
  });

  it('mappt Kontoarten auf Forecast-Kinds', () => {
    expect(accountTypeToKind('checking')).toBe('checking');
    expect(accountTypeToKind('savings')).toBe('savings');
    expect(accountTypeToKind('credit_card')).toBe('credit_card');
    expect(accountTypeToKind('other')).toBe('other');
  });
});
