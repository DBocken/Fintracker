import { describe, it, expect } from 'vitest';
import {
  buildVariableExpenseBaselines,
  buildRecurringFlows,
  buildAllContractFlowsForDisplay,
  buildDetectedSalaryFlows,
  composeForecastInput,
  cycleToCadence,
  accountTypeToKind,
  applyForecastOverrides,
} from '@/lib/forecast-data';
import { DEFAULT_FORECAST_OVERRIDES } from '@/services/forecast-overrides-service';
import type { Account, Transaction } from '@/types';
import type { ForecastInput } from '@/lib/forecast-types';
import type { ContractRow } from '@/components/contracts/contract-types';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import { normalizeMerchantName } from '@/services/merchant-normalization';
import { calculateDeterministicForecast } from '@/lib/forecast';

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

describe('buildAllContractFlowsForDisplay', () => {
  const makeRow = (status: ContractRow['status'], extra: Partial<ContractRow> = {}): ContractRow => ({
    key: `contract-${status}`,
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
    confirmed: false,
    transactionIds: [],
    fingerprint: `merchant:netflix|out`,
    status,
    stale: false,
    cycleKnown: true,
    ...extra,
  });

  it('sollte aktive Verträge ohne disabled-Flag zurückgeben', () => {
    const result = buildAllContractFlowsForDisplay([makeRow('active')]);
    expect(result).toHaveLength(1);
    expect(result[0].disabled).toBeUndefined();
    expect(result[0].amount).toBe(-20);
  });

  it('sollte beendete Verträge als disabled markieren statt sie auszuschließen', () => {
    const result = buildAllContractFlowsForDisplay([makeRow('ended')]);
    expect(result).toHaveLength(1);
    expect(result[0].disabled).toBe(true);
  });

  it('[REGRESSION] sollte abgelehnte und pausierte Verträge als disabled markieren', () => {
    const rejected = buildAllContractFlowsForDisplay([makeRow('rejected')]);
    const paused = buildAllContractFlowsForDisplay([makeRow('paused')]);
    expect(rejected[0].disabled).toBe(true);
    expect(paused[0].disabled).toBe(true);
  });

  it('sollte veraltete (stale) Verträge als disabled markieren', () => {
    const result = buildAllContractFlowsForDisplay([makeRow('candidate', { stale: true })]);
    expect(result).toHaveLength(1);
    expect(result[0].disabled).toBe(true);
  });

  it('[REGRESSION] sollte nutzerseitig deaktivierte Flows trotzdem anzeigen (nicht ausfiltern)', () => {
    const overrides = { 'contract-active': { enabled: false as const } };
    const result = buildAllContractFlowsForDisplay([makeRow('active')], overrides);
    // Muss sichtbar bleiben – die Checkbox-Logik in der UI filtert via override
    expect(result).toHaveLength(1);
    expect(result[0].disabled).toBeUndefined(); // kein auto-disabled, nur user-disabled
  });

  it('sollte Einnahme-Verträge korrekt als positive Beträge darstellen', () => {
    const incomeRow = makeRow('active', { type: 'Einnahme', amountTypical: 4000 });
    const result = buildAllContractFlowsForDisplay([incomeRow]);
    expect(result[0].amount).toBe(4000); // positiv = Einnahme
  });

  it('sollte Verträge ohne bekannten Zyklus ausschließen', () => {
    const result = buildAllContractFlowsForDisplay([makeRow('active', { cycle: 'Unbekannt', cycleKnown: false })]);
    expect(result).toHaveLength(0);
  });
});

describe('buildDetectedSalaryFlows', () => {
  it('erkennt die reale BREDEX-Serie unabhängig von Kategorie und wechselnder IBAN-Abdeckung', () => {
    const dates = [
      '2025-07-31', '2025-08-28', '2025-09-29', '2025-10-29', '2025-11-27', '2025-12-29',
      '2026-01-28', '2026-02-27', '2026-03-30', '2026-04-29', '2026-05-28',
    ];
    const transactions = dates.map((date, index) => tx({
      id: `salary-${index}`,
      date,
      amount: index < 6 ? 4044.26 : 4028.48,
      payee: 'BREDEX Software Entwicklungs- und Beratungs-GmbH',
      description: `Lohn - Gehalt Abrechnung ${date.slice(5, 7)}/${date.slice(0, 4)}`,
      category_id: null,
      counterparty_iban: index < 6 ? null : 'DE02120300000000202051',
      account_id: 'giro',
    }));

    const result = buildDetectedSalaryFlows(transactions, undefined, new Date('2026-06-22T12:00:00'));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      amount: 4028.48,
      cadence: 'monthly',
      anchorDate: '2026-06-28',
      accountId: 'giro',
      confidence: 0.95,
    });

    const forecast = calculateDeterministicForecast({
      accounts: [{ id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance: 0 }],
      recurringFlows: result,
    }, { startDate: '2026-06-22', months: 2 });
    const salaryDay = forecast.daily.find((day) => day.date === '2026-06-28');
    expect(salaryDay?.inflows).toBe(4028.48);
    expect(salaryDay?.operatingCash).toBe(4028.48);
  });

  it('ignoriert alte Gehälter und respektiert ein lokales Deaktivieren', () => {
    const oldSalary = ['2025-01-28', '2025-02-28', '2025-03-28'].map((date, index) => tx({
      id: `old-${index}`,
      date,
      amount: 3000,
      payee: 'Alter Arbeitgeber',
      description: 'Gehalt',
    }));
    expect(buildDetectedSalaryFlows(oldSalary, undefined, new Date('2026-06-22T12:00:00'))).toEqual([]);

    const currentSalary = ['2026-03-28', '2026-04-28', '2026-05-28'].map((date, index) => tx({
      id: `current-${index}`,
      date,
      amount: 3000,
      payee: 'Aktueller Arbeitgeber',
      description: 'Gehalt',
    }));
    const id = `salary:${normalizeMerchantName('Aktueller Arbeitgeber')}`;
    expect(buildDetectedSalaryFlows(currentSalary, { [id]: { enabled: false } }, new Date('2026-06-22T12:00:00'))).toEqual([]);
  });
});

describe('[REGRESSION] composeForecastInput – regelmäßiges Einkommen wird in der Forecast-Darstellung berücksichtigt', () => {
  const NOW_INCOME = new Date('2026-06-22T12:00:00');

  function acct(id = 'giro', opening_balance = 1000): Account {
    return {
      id,
      user_id: 'u',
      name: 'Girokonto',
      type: 'checking',
      currency: 'EUR',
      color: '#000000',
      icon: 'bank',
      is_budget_pool_member: false,
      order_index: 0,
      opening_balance,
    } as Account;
  }

  /** Vier aufeinanderfolgende Monatsbuchungen (letzte aktuell zu NOW_INCOME). */
  function monthlyIncome(partial: Partial<Transaction>): Transaction[] {
    return ['2026-03-30', '2026-04-29', '2026-05-28', '2026-06-26'].map((date, index) =>
      tx({ ...partial, id: `${partial.payee ?? 'in'}-${index}`, account_id: 'giro', date }),
    );
  }

  function compose(transactions: Transaction[]) {
    return composeForecastInput({
      accounts: [acct()],
      accountBalances: { giro: 1000 },
      categories: [],
      decisions: new Map(),
      transactions,
      overrides: DEFAULT_FORECAST_OVERRIDES,
      now: NOW_INCOME,
    });
  }

  it('berücksichtigt ein erkanntes Gehalt (Schlüsselwort) als positiven Flow und in der Projektion', () => {
    const input = compose(
      monthlyIncome({ amount: 3000, payee: 'Aktueller Arbeitgeber', description: 'Gehalt' }),
    );

    const incomeFlows = (input.recurringFlows ?? []).filter((f) => f.amount > 0);
    expect(incomeFlows.length).toBeGreaterThan(0);
    expect(incomeFlows.some((f) => f.amount === 3000)).toBe(true);

    // Darstellung: die Projektion weist die Einnahme in einem Monat aus.
    const result = calculateDeterministicForecast(input, { startDate: '2026-06-22', months: 3 });
    expect(result.monthly.some((m) => m.income >= 3000)).toBe(true);
  });

  it('berücksichtigt regelmäßiges Einkommen OHNE Gehalts-Schlüsselwort (IBAN-Vertrag) in der Projektion', () => {
    // Freiberufliche/wiederkehrende Einnahme: kein „Gehalt"-Text, aber gleiche
    // Gegen-IBAN und stabiler Betrag -> als Einnahmen-Vertrag erkennbar.
    const input = compose(
      monthlyIncome({
        amount: 2400,
        payee: 'Studio Kunde GmbH',
        description: 'Rechnung',
        counterparty_iban: 'DE02120300000000202051',
      }),
    );

    const incomeFlows = (input.recurringFlows ?? []).filter((f) => f.amount > 0);
    expect(incomeFlows.some((f) => f.amount === 2400)).toBe(true);

    const result = calculateDeterministicForecast(input, { startDate: '2026-06-22', months: 3 });
    expect(result.monthly.some((m) => m.income >= 2400)).toBe(true);
  });

  it('das Einkommen erscheint auch in allRecurringFlows (UI-Darstellung der Einträge)', () => {
    const input = compose(
      monthlyIncome({ amount: 3000, payee: 'Aktueller Arbeitgeber', description: 'Gehalt' }),
    );
    expect((input.allRecurringFlows ?? []).some((f) => f.amount === 3000)).toBe(true);
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
