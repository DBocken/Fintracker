import { isWithinInterval, parseISO, subDays, subMonths, subYears } from 'date-fns';
import type { Account, Category, Transaction } from '@/types';
import type { ContractFilter, DashboardGranularity, DashboardRange, EssentialFilter, AusgabenklasseFilter } from './filter-constants';
import { resolveAusgabenklasse } from '@/lib/analysis-data';
import { resolveContractStatus, isContractStatus } from '@/lib/contract-derivation';
import { resolvePeriodRange } from './period-utils';
import type { ContractDecision } from '@/services/contract-decision-service';

interface DateRange {
  start: Date;
  end: Date;
}

export interface DashboardFilterState {
  category: string;
  account: string;
  contract: ContractFilter;
  essential: EssentialFilter;
  ausgabenklasse: AusgabenklasseFilter;
  search: string;
  range: DashboardRange;
  customDays: number;
  /** Konkrete Periode für Jahr/Quartal/Monat (z.B. `2026-Q2`); sonst leer. */
  customPeriod?: string;
}

export function getDashboardDateRange(
  range: DashboardRange,
  customDays: number,
  now = new Date(),
  customPeriod = '',
): DateRange {
  if (range === 'Jahr' || range === 'Quartal' || range === 'Monat') {
    // Konkrete Periode auflösen; ohne gültige Periode auf „Gesamt" zurückfallen.
    const resolved = resolvePeriodRange(range, customPeriod);
    return resolved ?? { start: new Date(0), end: now };
  }
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
    Monat: 30,
    Quartal: 90,
    Jahr: 365,
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

function matchesContractFilter(
  transaction: Transaction,
  categoriesById: Map<string, Category>,
  decisions: Map<string, ContractDecision>,
  filter: ContractFilter,
): boolean {
  if (filter === 'all') return true;

  const category = transaction.category_id ? categoriesById.get(transaction.category_id) : undefined;
  const isContract = isContractStatus(resolveContractStatus(transaction, decisions, category));
  return filter === 'vertrag' ? isContract : !isContract;
}

/**
 * Kategorie-Filter ist hierarchie-bewusst: eine Buchung passt, wenn ihre
 * zugewiesene Kategorie (oder eine ihrer Vorfahren) der gewählten Kategorie
 * entspricht. So liefert die Auswahl einer Hauptkategorie auch deren
 * Unterkategorien (nötig für die Chart-Navigation per Sunburst-Außenring).
 */
function matchesCategoryFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: string): boolean {
  if (filter === 'all') return true;
  const startIds = [transaction.subcategory_id, transaction.category_id].filter(Boolean) as string[];
  for (const startId of startIds) {
    let current: Category | undefined = categoriesById.get(startId);
    const visited = new Set<string>();
    // Direkt zugewiesene ID prüfen (auch wenn die Kategorie nicht (mehr) existiert).
    if (startId === filter) return true;
    while (current && !visited.has(current.id)) {
      if (current.id === filter) return true;
      visited.add(current.id);
      current = current.parent_id ? categoriesById.get(current.parent_id) : undefined;
    }
  }
  return false;
}

function matchesEssentialFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: EssentialFilter): boolean {
  if (filter === 'all') return true;
  if (!transaction.category_id) return false;

  const category = categoriesById.get(transaction.category_id);
  if (!category) return false;

  const isEssential = category.attributes?.essenziell === true;
  return filter === 'ess' ? isEssential : !isEssential;
}

function matchesAusgabenklasseFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: AusgabenklasseFilter): boolean {
  if (filter === 'all') return true;
  if (!transaction.category_id) return filter === 'unkategorisiert';

  const klasse = resolveAusgabenklasse(categoriesById, transaction.category_id);
  const effectiveKlasse = klasse || 'unkategorisiert';
  return effectiveKlasse === filter;
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
  contractDecisions: Map<string, ContractDecision> = new Map(),
): Transaction[] {
  const { start, end } = getDashboardDateRange(filters.range, filters.customDays, now, filters.customPeriod ?? '');
  const search = filters.search.trim().toLowerCase();
  const categoriesById = getCategoryById(categories);
  const accountsById = getAccountById(accounts);

  return transactions.filter((transaction) => {
    const txDate = parseISO(transaction.date);
    if (!isWithinInterval(txDate, { start, end })) return false;

    if (!matchesCategoryFilter(transaction, categoriesById, filters.category)) return false;
    if (!matchesAccountFilter(transaction, accountsById, filters.account)) return false;
    if (!matchesContractFilter(transaction, categoriesById, contractDecisions, filters.contract)) return false;
    if (!matchesEssentialFilter(transaction, categoriesById, filters.essential)) return false;
    if (!matchesAusgabenklasseFilter(transaction, categoriesById, filters.ausgabenklasse)) return false;

    if (search) {
      const searchableText = `${transaction.payee} ${transaction.description} ${transaction.original_text}`.toLowerCase();
      if (!searchableText.includes(search)) return false;
    }

    return true;
  });
}

/**
 * URL-Übergabe der Dashboard-Filter an die Buchungsseite (Audit P1.3): das
 * Dashboard zeigt nur eine Vorschau und verlinkt mit den aktiven Filtern auf
 * `/transactions`. Encode/Decode sind symmetrisch und kodieren nur Werte, die
 * vom Default abweichen, damit die URL kurz und der Zurück-Button sinnvoll bleibt.
 */
const RANGE_TO_TOKEN: Record<DashboardRange, string> = {
  Gesamt: 'all',
  Jahr: 'year',
  Quartal: 'quarter',
  Monat: 'month',
  '7 Tage': '7d',
  '30 Tage': '30d',
  '90 Tage': '90d',
  '6 Monate': '6m',
  '1 Jahr': '1y',
  Benutzerdefiniert: 'custom',
};
const TOKEN_TO_RANGE: Record<string, DashboardRange> = Object.fromEntries(
  Object.entries(RANGE_TO_TOKEN).map(([range, token]) => [token, range as DashboardRange]),
) as Record<string, DashboardRange>;

/** Erkennt eine konkrete Perioden-Kennung im range-Token (z.B. `2026-Q2`). */
function rangeFromPeriodToken(token: string): DashboardRange | null {
  if (/^\d{4}$/.test(token)) return 'Jahr';
  if (/^\d{4}-Q[1-4]$/.test(token)) return 'Quartal';
  if (/^\d{4}-\d{2}$/.test(token)) return 'Monat';
  return null;
}

export function encodeDashboardFilters(filters: DashboardFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category !== 'all') params.set('cat', filters.category);
  if (filters.account !== 'all') params.set('acc', filters.account);
  if (filters.contract !== 'all') params.set('contract', filters.contract);
  if (filters.essential !== 'all') params.set('essential', filters.essential);
  if (filters.ausgabenklasse !== 'all') params.set('klasse', filters.ausgabenklasse);
  if (filters.search.trim()) params.set('q', filters.search.trim());
  // Jahr/Quartal/Monat: konkrete Periode direkt als range-Token (z.B. range=2026-Q2).
  if ((filters.range === 'Jahr' || filters.range === 'Quartal' || filters.range === 'Monat') && filters.customPeriod) {
    params.set('range', filters.customPeriod);
  } else if (filters.range !== 'Gesamt') {
    params.set('range', RANGE_TO_TOKEN[filters.range]);
  }
  if (filters.range === 'Benutzerdefiniert' && filters.customDays) params.set('days', String(filters.customDays));
  return params;
}

/**
 * Baut einen Deep-Link auf die gefilterte Buchungsseite. Wird von den Diagrammen
 * (Sunburst/Sankey) für die Klick-Navigation genutzt. Nur gesetzte Werte werden
 * kodiert; das Ergebnis ist mit `decodeDashboardFilters` kompatibel.
 */
export function buildTransactionsHref(partial: Partial<DashboardFilterState>): string {
  const filters: DashboardFilterState = {
    category: 'all',
    account: 'all',
    contract: 'all',
    essential: 'all',
    ausgabenklasse: 'all',
    search: '',
    range: 'Gesamt',
    customDays: 30,
    customPeriod: '',
    ...partial,
  };
  const qs = encodeDashboardFilters(filters).toString();
  return qs ? `/transactions?${qs}` : '/transactions';
}

export function decodeDashboardFilters(params: URLSearchParams): DashboardFilterState {
  const rangeToken = params.get('range') ?? '';
  const periodRange = rangeFromPeriodToken(rangeToken);
  const range = periodRange ?? TOKEN_TO_RANGE[rangeToken] ?? 'Gesamt';
  const days = Number(params.get('days'));
  return {
    category: params.get('cat') ?? 'all',
    account: params.get('acc') ?? 'all',
    contract: (params.get('contract') as ContractFilter) ?? 'all',
    essential: (params.get('essential') as EssentialFilter) ?? 'all',
    ausgabenklasse: (params.get('klasse') as AusgabenklasseFilter) ?? 'all',
    search: params.get('q') ?? '',
    range,
    customDays: Number.isFinite(days) && days > 0 ? days : 30,
    customPeriod: periodRange ? rangeToken : '',
  };
}
