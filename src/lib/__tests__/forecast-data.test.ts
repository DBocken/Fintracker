import { describe, it, expect } from 'vitest';
import {
  buildVariableExpenseBaselines,
  buildRecurringFlows,
  cycleToCadence,
  accountTypeToKind,
  applyForecastOverrides,
} from '@/lib/forecast-data';
import { DEFAULT_FORECAST_OVERRIDES } from '@/services/forecast-overrides-service';
import type { Transaction } from '@/types';
import type { ForecastInput } from '@/lib/forecast-types';
import type { ContractRow } from '@/components/contracts/contract-types';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';

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
    // 3 Monate beobachtet, Summe 600 -> 200/Monat. Streuung [100,200,300]:
    // sd = sqrt(20000/3) ≈ 81.65 -> cv ≈ 0.41.
    expect(result).toEqual([
      { category: 'Lebensmittel', monthlyAmount: 200, confidence: 0.75, volatility: 0.41 },
    ]);
  });

  it('ignoriert Einnahmen, Transfers und Verträge', () => {
    const txns: Transaction[] = [
      tx({ date: '2026-06-01', amount: 2500, category: 'Gehalt' }), // Einnahme
      tx({ date: '2026-06-02', amount: -500, category: 'Sparen', is_transfer: true }),
      tx({ date: '2026-06-03', amount: -50, category: 'Netflix', is_contract: true }),
      tx({ date: '2026-06-04', amount: -40, category: 'Restaurant' }),
    ];
    const result = buildVariableExpenseBaselines(txns, { now: NOW });
    // Nur ein Monat beobachtet -> keine Streuungsinfo -> volatility 0.
    expect(result).toEqual([
      { category: 'Restaurant', monthlyAmount: 40, confidence: 0.5, volatility: 0 },
    ]);
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

  it('schließt bekannte Vertragsfamilien aus der variablen Baseline aus', () => {
    const netflix = tx({ date: '2026-06-01', amount: -20, payee: 'Netflix' });
    const food = tx({ date: '2026-06-02', amount: -40, payee: 'Aldi', category_id: 'food' });
    const result = buildVariableExpenseBaselines([netflix, food], {
      now: NOW,
      excludedFingerprints: new Set([merchantFingerprint(netflix)]),
      categoryNames: new Map([['food', 'Lebensmittel']]),
    });
    expect(result.map((entry) => entry.category)).toEqual(['Lebensmittel']);
  });
});

describe('buildRecurringFlows', () => {
  const row = (status: ContractRow['status']): ContractRow => ({
    key: `netflix-${status}`,
    type: 'Ausgabe',
    payee: 'Netflix',
    categoryName: 'Streaming',
    categoryId: null,
    amountTypical: 20,
    amountLast: 20,
    cycle: 'Monatlich',
    lastDateISO: '2026-06-01',
    firstDateISO: '2026-01-01',
    nextDateISO: '2026-07-01',
    changed: false,
    changeAmount: 0,
    changeSinceLabel: null,
    confirmed: status === 'active',
    transactionIds: [],
    fingerprint: `merchant:netflix|out`,
    status,
    stale: false,
    cycleKnown: true,
  });

  it('plant nur aktive Verträge, nicht Kandidaten oder beendete Verträge', () => {
    const result = buildRecurringFlows([row('active'), row('candidate'), row('ended')]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('netflix-active');
  });

  it('berücksichtigt eine aktuelle erkannte Gehaltsserie bereits als unsicheren Vorschlag', () => {
    const salary = {
      ...row('candidate'),
      key: 'salary-candidate',
      type: 'Einnahme' as const,
      payee: 'BREDEX Software Entwicklungs- und Beratungs-GmbH',
      amountTypical: 4044.26,
      amountRecentTypical: 4028.48,
      amountLast: 4028.48,
    };

    const result = buildRecurringFlows([salary]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'salary-candidate',
      amount: 4028.48,
      cadence: 'monthly',
      confidence: 0.6,
    });
  });

  it('berücksichtigt beendete oder veraltete Einnahmen nicht', () => {
    const endedSalary = { ...row('ended'), type: 'Einnahme' as const };
    const staleSalary = { ...row('candidate'), type: 'Einnahme' as const, stale: true };
    expect(buildRecurringFlows([endedSalary, staleSalary])).toEqual([]);
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

describe('applyForecastOverrides', () => {
  const base: ForecastInput = {
    accounts: [
      { id: 'giro', name: 'Giro', kind: 'checking', openingBalance: 1000 },
      { id: 'tg', name: 'Tagesgeld', kind: 'savings', openingBalance: 5000 },
    ],
    variableExpenses: [{ category: 'Restaurant', monthlyAmount: 360 }],
  };

  it('setzt Zinssätze auf die passenden Konten', () => {
    const result = applyForecastOverrides(base, {
      ...DEFAULT_FORECAST_OVERRIDES,
      accountInterest: { tg: 2.5 },
    });
    expect(result.accounts.find((a) => a.id === 'tg')?.annualInterestRate).toBe(2.5);
    expect(result.accounts.find((a) => a.id === 'giro')?.annualInterestRate).toBeUndefined();
  });

  it('legt Budget-Overrides als budgetOverride über die Baseline', () => {
    const result = applyForecastOverrides(base, {
      ...DEFAULT_FORECAST_OVERRIDES,
      categoryBudgets: { Restaurant: 200 },
    });
    expect(result.variableExpenses?.[0].budgetOverride).toBe(200);
    expect(result.variableExpenses?.[0].monthlyAmount).toBe(360); // Baseline bleibt
  });

  it('hängt geplante Events und Rücklagen an', () => {
    const result = applyForecastOverrides(base, {
      ...DEFAULT_FORECAST_OVERRIDES,
      plannedEvents: [{ id: 'e1', name: 'Urlaub', amount: -1500, date: '2026-08-01', accountId: 'giro' }],
      sinkingFunds: [
        { id: 'f1', name: 'Kfz', targetAmount: 1200, dueDate: '2026-12-01', accountId: 'tg' },
      ],
    });
    expect(result.plannedEvents).toHaveLength(1);
    expect(result.sinkingFunds).toHaveLength(1);
  });

  it('lässt den Input bei leeren Overrides inhaltlich unverändert', () => {
    const result = applyForecastOverrides(base, DEFAULT_FORECAST_OVERRIDES);
    expect(result.accounts).toEqual(base.accounts);
    expect(result.plannedEvents).toEqual([]);
    expect(result.sinkingFunds).toEqual([]);
  });
});
