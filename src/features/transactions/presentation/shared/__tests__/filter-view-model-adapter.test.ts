import { describe, it, expect, vi } from 'vitest';
import type { TransactionsOverviewViewModel } from '@/features/transactions/application/transactions-overview-view-model';
import { toFilterViewModel } from '../filter-view-model-adapter';

/**
 * `toFilterViewModel` übersetzt den patch-basierten Setter von
 * `useTransactionsOverview` (`filters.set.patch(Partial<DashboardFilterState>)`)
 * in die Feld-Setter, die `FilterViewModel`/`TransactionFilters` erwarten
 * (WP 5.4, KOMP-2). Jedes Feld wird EINZELN geprüft: Ein vertauschtes Feld
 * (`set.essential` ruft `patch({ contract: v })`) ist genau der Bug, den die
 * frühere 21-Prop-Verdrahtung nicht verhindern konnte, weil sie zweimal von
 * Hand abgeschrieben wurde.
 */

function buildFakeFilters(
  overrides: Partial<TransactionsOverviewViewModel['filters']['values']> = {},
): { filters: TransactionsOverviewViewModel['filters']; patch: ReturnType<typeof vi.fn> } {
  const patch = vi.fn();
  const filters: TransactionsOverviewViewModel['filters'] = {
    values: {
      category: 'all',
      account: 'all',
      contract: 'all',
      essential: 'all',
      ausgabenklasse: 'all',
      search: '',
      range: 'Gesamt',
      customDays: 30,
      customPeriod: undefined,
      ...overrides,
    },
    customGranularity: 'daily',
    set: {
      patch,
      range: vi.fn(),
      customGranularity: vi.fn(),
    },
    activeCount: 0,
    periodOptions: [],
    reset: vi.fn(),
  };
  return { filters, patch };
}

describe('toFilterViewModel', () => {
  it('sollte customGranularity aus dem Sibling-Feld in values mergen', () => {
    const { filters } = buildFakeFilters();
    const vm = toFilterViewModel(filters, [], []);
    expect(vm.values.customGranularity).toBe('daily');
  });

  it('sollte ein fehlendes customPeriod als leeren String zeigen (nie undefined)', () => {
    const { filters } = buildFakeFilters({ customPeriod: undefined });
    const vm = toFilterViewModel(filters, [], []);
    expect(vm.values.customPeriod).toBe('');
  });

  it.each([
    ['category', 'food'],
    ['account', 'acc-1'],
    ['contract', 'vertrag'],
    ['essential', 'ess'],
    ['ausgabenklasse', 'sparen'],
    ['search', 'edeka'],
    ['customDays', 90],
    ['customPeriod', '2026-Q2'],
  ] as const)('sollte set.%s NUR das Feld %s patchen, kein anderes', (field, value) => {
    const { filters, patch } = buildFakeFilters();
    const vm = toFilterViewModel(filters, [], []);
    (vm.set[field] as (v: typeof value) => void)(value);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({ [field]: value });
  });

  it('sollte set.range direkt an filters.set.range durchreichen (kein patch)', () => {
    const { filters, patch } = buildFakeFilters();
    const vm = toFilterViewModel(filters, [], []);
    vm.set.range('Jahr');
    expect(filters.set.range).toHaveBeenCalledWith('Jahr');
    expect(patch).not.toHaveBeenCalled();
  });

  it('sollte set.customGranularity direkt an filters.set.customGranularity durchreichen (kein patch)', () => {
    const { filters, patch } = buildFakeFilters();
    const vm = toFilterViewModel(filters, [], []);
    vm.set.customGranularity('weekly');
    expect(filters.set.customGranularity).toHaveBeenCalledWith('weekly');
    expect(patch).not.toHaveBeenCalled();
  });

  it('sollte categories/accounts unverändert durchreichen', () => {
    const { filters } = buildFakeFilters();
    const categories = [{ id: 'c1' }] as never;
    const accounts = [{ id: 'a1' }] as never;
    const vm = toFilterViewModel(filters, categories, accounts);
    expect(vm.categories).toBe(categories);
    expect(vm.accounts).toBe(accounts);
  });
});
