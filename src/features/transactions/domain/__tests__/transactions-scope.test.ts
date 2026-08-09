import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from '@/types';
import type { EffectiveBalance } from '@/features/shared/domain/balance-calculations';
// filterTransactions/DEFAULT_DASHBOARD_FILTERS sind laut WP-B2-Auftrag nur in
// Tests für Äquivalenz-/Regressionsvergleiche erlaubt, nicht in den
// Domain-Dateien selbst (die dürfen von `src/components/` nur Typen beziehen).
import { filterTransactions } from '@/features/shared/domain/dashboard-filtering';
import type { DashboardFilterState } from '@/features/shared/domain/dashboard-filters';
import { DEFAULT_DASHBOARD_FILTERS } from '@/features/shared/domain/dashboard-filters';
import {
  isInAccountScope,
  computeScopedBalance,
  computeEndingBalanceAnchor,
  hasContentFilter,
  countActiveFilters,
} from '../transactions-scope';
import { asTransactionId } from '@/lib/ids';

function makeTx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: '2026-01-01',
    amount: 0,
    payee: '',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
    id: overrides.id !== undefined ? asTransactionId(overrides.id) : undefined,
  };
}

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Girokonto',
    type: 'checking' as Account['type'],
    currency: 'EUR',
    color: '#000',
    icon: 'bank',
    is_budget_pool_member: true,
    order_index: 0,
    ...overrides,
  };
}

const accounts: Account[] = [
  makeAccount({ id: 'a', is_budget_pool_member: true }),
  makeAccount({ id: 'b', is_budget_pool_member: true }),
  makeAccount({ id: 'c', is_budget_pool_member: false }),
];
const accountsById = new Map(accounts.map((a) => [a.id, a]));

describe('isInAccountScope', () => {
  const scopeFixture: Transaction[] = [
    makeTx({ id: '1', account_id: 'a' }),
    makeTx({ id: '2', account_id: 'b' }),
    makeTx({ id: '3', account_id: 'c' }),
    makeTx({ id: '4', account_id: undefined }),
  ];

  describe('Happy Path', () => {
    it("sollte bei scope 'all' immer true liefern", () => {
      for (const tx of scopeFixture) {
        expect(isInAccountScope(tx, accountsById, 'all')).toBe(true);
      }
    });

    it("sollte bei scope 'budget-pool' nur Buchungen auf Budget-Pool-Konten matchen", () => {
      expect(isInAccountScope(scopeFixture[0], accountsById, 'budget-pool')).toBe(true); // a: Pool
      expect(isInAccountScope(scopeFixture[1], accountsById, 'budget-pool')).toBe(true); // b: Pool
      expect(isInAccountScope(scopeFixture[2], accountsById, 'budget-pool')).toBe(false); // c: kein Pool
    });

    it('sollte bei konkretem Konto-Scope nur exakte account_id matchen', () => {
      expect(isInAccountScope(scopeFixture[0], accountsById, 'a')).toBe(true);
      expect(isInAccountScope(scopeFixture[1], accountsById, 'a')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it("sollte bei scope 'budget-pool' Buchungen ohne account_id ausschließen", () => {
      expect(isInAccountScope(scopeFixture[3], accountsById, 'budget-pool')).toBe(false);
    });

    it('sollte bei unbekannter account_id im konkreten Scope false liefern', () => {
      expect(isInAccountScope(makeTx({ account_id: 'unknown' }), accountsById, 'a')).toBe(false);
    });
  });

  describe('Regression Protection', () => {
    it.each(['all', 'budget-pool', 'a'] as const)(
      'sollte für scope=%s dieselben IDs liefern wie filterTransactions (nur Account-Filter aktiv)',
      (scope) => {
        const now = new Date('2026-12-31T00:00:00Z');
        const equivFixture: Transaction[] = [
          makeTx({ id: '1', account_id: 'a', date: '2026-01-05' }),
          makeTx({ id: '2', account_id: 'b', date: '2026-01-04' }),
          makeTx({ id: '3', account_id: 'c', date: '2026-01-03' }),
          makeTx({ id: '4', account_id: undefined, date: '2026-01-02' }),
        ];

        const viaScope = equivFixture
          .filter((tx) => isInAccountScope(tx, accountsById, scope))
          .map((tx) => tx.id)
          .sort();

        const viaFilterTransactions = filterTransactions(
          equivFixture,
          [],
          accounts,
          { ...DEFAULT_DASHBOARD_FILTERS, account: scope },
          now,
          new Map(),
        )
          .map((tx) => tx.id)
          .sort();

        expect(viaScope).toEqual(viaFilterTransactions);
      },
    );
  });
});

describe('computeScopedBalance', () => {
  const effectiveBalances: Record<string, EffectiveBalance> = {
    a: { amount: 100, source: 'local' },
    b: { amount: 250, source: 'bank' },
    c: { amount: 40, source: 'local' },
  };

  describe('Happy Path', () => {
    it("sollte bei scope 'all' die Summe aller Konten liefern", () => {
      expect(computeScopedBalance(accounts, effectiveBalances, 'all')).toBe(390);
    });

    it("sollte bei scope 'budget-pool' nur Budget-Pool-Konten summieren", () => {
      expect(computeScopedBalance(accounts, effectiveBalances, 'budget-pool')).toBe(350);
    });

    it('sollte bei konkretem Konto-Scope dessen Saldo liefern', () => {
      expect(computeScopedBalance(accounts, effectiveBalances, 'a')).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei unbekannter accountId 0 liefern', () => {
      expect(computeScopedBalance(accounts, effectiveBalances, 'unknown-id')).toBe(0);
    });

    it('sollte fehlende Einträge in effectiveBalances als 0 behandeln', () => {
      expect(computeScopedBalance(accounts, {}, 'all')).toBe(0);
    });
  });
});

describe('computeEndingBalanceAnchor', () => {
  describe('Happy Path', () => {
    it('sollte ohne sichtbare Buchungen den Scoped-Saldo direkt liefern', () => {
      const result = computeEndingBalanceAnchor({
        visible: [],
        all: [makeTx({ id: '1', account_id: 'a', date: '2026-05-01', amount: 999 })],
        accountsById,
        scope: 'a',
        scopedCurrentBalance: 1000,
      });
      expect(result).toBe(1000);
    });

    it('sollte bei Zeitfilter nur In-Scope-Buchungen NACH dem jüngsten sichtbaren Tag abziehen', () => {
      const all: Transaction[] = [
        makeTx({ id: 'after-1', account_id: 'a', date: '2026-03-10', amount: 50 }),
        makeTx({ id: 'after-2', account_id: 'a', date: '2026-03-08', amount: 20 }),
        makeTx({ id: 'visible-newest', account_id: 'a', date: '2026-03-05', amount: 30 }),
        makeTx({ id: 'visible-older', account_id: 'a', date: '2026-03-01', amount: 10 }),
      ];
      const visible = [all[2], all[3]]; // Zeitfilter blendet die beiden "after"-Buchungen aus

      const result = computeEndingBalanceAnchor({
        visible,
        all,
        accountsById,
        scope: 'a',
        scopedCurrentBalance: 1000,
      });

      expect(result).toBe(1000 - (50 + 20));
    });
  });

  describe('Edge Cases', () => {
    it("sollte bei scope 'budget-pool' Buchungen über alle Pool-Konten nach dem Anker abziehen", () => {
      const all: Transaction[] = [
        makeTx({ id: 'after-a', account_id: 'a', date: '2026-03-10', amount: 50 }),
        makeTx({ id: 'after-b', account_id: 'b', date: '2026-03-09', amount: 30 }),
        makeTx({ id: 'after-c', account_id: 'c', date: '2026-03-09', amount: 999 }), // c ist kein Pool-Mitglied
        makeTx({ id: 'visible-newest', account_id: 'a', date: '2026-03-05', amount: 0 }),
      ];
      const visible = [all[3]];

      const result = computeEndingBalanceAnchor({
        visible,
        all,
        accountsById,
        scope: 'budget-pool',
        scopedCurrentBalance: 1000,
      });

      expect(result).toBe(1000 - (50 + 30));
    });

    it("sollte bei scope 'budget-pool' Buchungen ohne account_id nicht abziehen", () => {
      const all: Transaction[] = [
        makeTx({ id: 'after-no-account', account_id: undefined, date: '2026-03-10', amount: 777 }),
        makeTx({ id: 'visible-newest', account_id: 'a', date: '2026-03-05', amount: 0 }),
      ];
      const visible = [all[1]];

      const result = computeEndingBalanceAnchor({
        visible,
        all,
        accountsById,
        scope: 'budget-pool',
        scopedCurrentBalance: 1000,
      });

      expect(result).toBe(1000);
    });

    it('sollte bei Einzelkonto-Scope Buchungen anderer Konten nicht abziehen', () => {
      const all: Transaction[] = [
        makeTx({ id: 'after-other-account', account_id: 'b', date: '2026-03-10', amount: 500 }),
        makeTx({ id: 'visible-newest', account_id: 'a', date: '2026-03-05', amount: 0 }),
      ];
      const visible = [all[1]];

      const result = computeEndingBalanceAnchor({
        visible,
        all,
        accountsById,
        scope: 'a',
        scopedCurrentBalance: 1000,
      });

      expect(result).toBe(1000);
    });

    it('sollte Buchungen am selben Tag wie der jüngste sichtbare Eintrag NICHT abziehen (>-Vergleich)', () => {
      const all: Transaction[] = [
        makeTx({ id: 'same-day', account_id: 'a', date: '2026-03-05', amount: 250 }),
        makeTx({ id: 'visible-newest', account_id: 'a', date: '2026-03-05', amount: 0 }),
      ];
      const visible = [all[1]];

      const result = computeEndingBalanceAnchor({
        visible,
        all,
        accountsById,
        scope: 'a',
        scopedCurrentBalance: 1000,
      });

      expect(result).toBe(1000);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte den ISO-String-Datumsvergleich der Page konservieren (Monats-/Jahreswechsel)', () => {
      const visible = [makeTx({ id: 'visible-newest', account_id: 'a', date: '2026-01-09', amount: 0 })];
      const all: Transaction[] = [
        ...visible,
        makeTx({ id: 'before', account_id: 'a', date: '2025-12-31', amount: 111 }), // davor -> nicht abgezogen
        makeTx({ id: 'same-day', account_id: 'a', date: '2026-01-09', amount: 222 }), // gleicher Tag -> nicht abgezogen
        makeTx({ id: 'next-month', account_id: 'a', date: '2026-02-01', amount: 333 }), // Monatswechsel danach
        makeTx({ id: 'next-year', account_id: 'a', date: '2027-01-01', amount: 444 }), // Jahreswechsel danach
      ];

      const result = computeEndingBalanceAnchor({
        visible,
        all,
        accountsById,
        scope: 'a',
        scopedCurrentBalance: 1000,
      });

      expect(result).toBe(1000 - (333 + 444));
    });
  });
});

describe('hasContentFilter', () => {
  const baseFilters: DashboardFilterState = {
    category: DEFAULT_DASHBOARD_FILTERS.category,
    account: DEFAULT_DASHBOARD_FILTERS.account,
    contract: DEFAULT_DASHBOARD_FILTERS.contract,
    essential: DEFAULT_DASHBOARD_FILTERS.essential,
    ausgabenklasse: DEFAULT_DASHBOARD_FILTERS.ausgabenklasse,
    search: DEFAULT_DASHBOARD_FILTERS.search,
    range: DEFAULT_DASHBOARD_FILTERS.range,
    customDays: DEFAULT_DASHBOARD_FILTERS.customDays,
    customPeriod: DEFAULT_DASHBOARD_FILTERS.customPeriod,
  };

  describe('Happy Path', () => {
    it('sollte bei Default-Filtern false liefern', () => {
      expect(hasContentFilter(baseFilters)).toBe(false);
    });

    it('sollte bei aktivem Kategorie-Filter true liefern', () => {
      expect(hasContentFilter({ ...baseFilters, category: 'food' })).toBe(true);
    });

    it('sollte bei aktivem Vertrags-Filter true liefern', () => {
      expect(hasContentFilter({ ...baseFilters, contract: 'vertrag' })).toBe(true);
    });

    it('sollte bei aktivem Essenziell-Filter true liefern', () => {
      expect(hasContentFilter({ ...baseFilters, essential: 'ess' })).toBe(true);
    });

    it('sollte bei aktivem Ausgabenklasse-Filter true liefern', () => {
      expect(hasContentFilter({ ...baseFilters, ausgabenklasse: 'sparen' })).toBe(true);
    });

    it('sollte bei nicht-leerer Suche true liefern', () => {
      expect(hasContentFilter({ ...baseFilters, search: 'rewe' })).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei Suche aus nur Whitespace false liefern (getrimmt)', () => {
      expect(hasContentFilter({ ...baseFilters, search: '   ' })).toBe(false);
    });

    it('sollte bei reinem Konto- und Zeitraum-Filter false liefern (kein Inhalts-Filter)', () => {
      expect(hasContentFilter({ ...baseFilters, account: 'a', range: '30 Tage' })).toBe(false);
    });
  });
});

describe('countActiveFilters', () => {
  const baseFilters: DashboardFilterState = {
    category: DEFAULT_DASHBOARD_FILTERS.category,
    account: DEFAULT_DASHBOARD_FILTERS.account,
    contract: DEFAULT_DASHBOARD_FILTERS.contract,
    essential: DEFAULT_DASHBOARD_FILTERS.essential,
    ausgabenklasse: DEFAULT_DASHBOARD_FILTERS.ausgabenklasse,
    search: DEFAULT_DASHBOARD_FILTERS.search,
    range: DEFAULT_DASHBOARD_FILTERS.range,
    customDays: DEFAULT_DASHBOARD_FILTERS.customDays,
    customPeriod: DEFAULT_DASHBOARD_FILTERS.customPeriod,
  };

  describe('Happy Path', () => {
    it('sollte bei Default-Filtern 0 liefern', () => {
      expect(countActiveFilters(baseFilters)).toBe(0);
    });

    it('sollte bei allen 7 Dimensionen (inkl. range und search) gesetzt 7 liefern', () => {
      const filters: DashboardFilterState = {
        category: 'food',
        account: 'a',
        contract: 'vertrag',
        essential: 'ess',
        ausgabenklasse: 'sparen',
        search: 'rewe',
        range: '30 Tage',
        customDays: 30,
        customPeriod: '',
      };
      expect(countActiveFilters(filters)).toBe(7);
    });
  });

  describe('Edge Cases', () => {
    it('sollte Suche aus nur Whitespace nicht mitzählen (getrimmt)', () => {
      expect(countActiveFilters({ ...baseFilters, search: '  ' })).toBe(0);
    });

    it('sollte einzelne Dimensionen unabhängig zählen', () => {
      expect(countActiveFilters({ ...baseFilters, range: '30 Tage' })).toBe(1);
      expect(countActiveFilters({ ...baseFilters, account: 'a' })).toBe(1);
    });
  });
});
