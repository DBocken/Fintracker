import { isWithinInterval, parseISO, subDays, subMonths, subYears } from 'date-fns';
import type { Account, Category, Transaction } from '@/types';
import type { ContractFilter, DashboardGranularity, DashboardRange, EssentialFilter, UncategorizedFilter } from './filter-constants';

interface DateRange {
  start: Date;
  end: Date;
}

export interface DashboardFilterState {
  category: string;
  account: string;
  contract: ContractFilter;
  essential: EssentialFilter;
  uncategorized: UncategorizedFilter;
  search: string;
  range: DashboardRange;
  customDays: number;
}

export function getDashboardDateRange(range: DashboardRange, customDays: number, now = new Date()): DateRange {
  switch (range) {
    case '7 Tage':
      return { start: subDays(now, 7), end: now };
    case '30 Tage':
      return { start: subDays(now, 30), end: now };
    case '90 Tage':
      return { start: subDays(now, 90), end: now };
    case '6 Monate':
      return { start: subMonths(now, 6), end: now };
    case '1 Jahr':
      return { start: subYears(now, 1), end: now };
    case 'Benutzerdefiniert':
      return { start: subDays(now, customDays), end: now };
    case 'Gesamt':
    default:
      return { start: new Date(0), end: now };
  }
}

export function getDashboardGranularity(
  range: DashboardRange,
  customDays: number,
  customGranularity: DashboardGranularity,
): DashboardGranularity {
  const daysByRange: Partial<Record<DashboardRange, number>> = {
    '7 Tage': 7,
    '30 Tage': 30,
    '90 Tage': 90,
    '6 Monate': 183,
    '1 Jahr': 365,
    Benutzerdefiniert: customDays,
  };

  const days = daysByRange[range];
  if (!days) return 'monthly';
  if (days <= 7) return customGranularity;
  if (days <= 30) return customGranularity === 'daily' ? 'daily' : 'weekly';
  return customGranularity === 'daily' ? 'weekly' : customGranularity;
}

function getCategoryById(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}

function getAccountById(accounts: Account[]): Map<string, Account> {
  return new Map(accounts.map((account) => [account.id, account]));
}

function matchesContractFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: ContractFilter): boolean {
  if (filter === 'all') return true;
  if (!transaction.category_id) return false;

  const category = categoriesById.get(transaction.category_id);
  if (!category) return false;

  const isContract = category.attributes?.ist_vertrag === true;
  return filter === 'vertrag' ? isContract : !isContract;
}

function matchesEssentialFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: EssentialFilter): boolean {
  if (filter === 'all') return true;
  if (!transaction.category_id) return false;

  const category = categoriesById.get(transaction.category_id);
  if (!category) return false;

  const isEssential = category.attributes?.essenziell === true;
  return filter === 'ess' ? isEssential : !isEssential;
}

function matchesUncategorizedFilter(transaction: Transaction, filter: UncategorizedFilter): boolean {
  if (filter === 'all') return true;
  const isUncategorized = !transaction.category_id;
  return filter === 'unkategorisiert' ? isUncategorized : !isUncategorized;
}

function matchesAccountFilter(transaction: Transaction, accountsById: Map<string, Account>, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'budget-pool') {
    return !!transaction.account_id && accountsById.get(transaction.account_id)?.is_budget_pool_member === true;
  }
  return transaction.account_id === filter;
}

export function filterTransactions(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  filters: DashboardFilterState,
  now = new Date(),
): Transaction[] {
  const { start, end } = getDashboardDateRange(filters.range, filters.customDays, now);
  const search = filters.search.trim().toLowerCase();
  const categoriesById = getCategoryById(categories);
  const accountsById = getAccountById(accounts);

  return transactions.filter((transaction) => {
    const txDate = parseISO(transaction.date);
    if (!isWithinInterval(txDate, { start, end })) return false;

    if (filters.category !== 'all' && transaction.category_id !== filters.category) return false;
    if (!matchesAccountFilter(transaction, accountsById, filters.account)) return false;
    if (!matchesContractFilter(transaction, categoriesById, filters.contract)) return false;
    if (!matchesEssentialFilter(transaction, categoriesById, filters.essential)) return false;
    if (!matchesUncategorizedFilter(transaction, filters.uncategorized)) return false;

    if (search) {
      const searchableText = `${transaction.payee} ${transaction.description} ${transaction.original_text}`.toLowerCase();
      if (!searchableText.includes(search)) return false;
    }

    return true;
  });
}
