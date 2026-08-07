import { isWithinInterval, parseISO, subDays, subMonths, subYears } from 'date-fns';
import type { Account, Category, Transaction, TransactionAllocation } from '@/types';
import type {
  AusgabenklasseFilter,
  ContractFilter,
  DashboardFilterState,
  DashboardGranularity,
  DashboardRange,
  EssentialFilter,
} from '@/features/shared/domain/dashboard-filters';
import { resolveAusgabenklasse, resolveEssenziell, isCategoryInFilter } from '@/lib/analysis-data';
import { resolveContractStatus, isContractStatus } from '@/lib/contract-derivation';
import { resolvePeriodRange } from './period-utils';
import type { ContractDecision } from '@/lib/contract-types';

interface DateRange {
  start: Date;
  end: Date;
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

// Hierarchie-Vergleich lebt in der Domain-Schicht (`@/lib/analysis-data`),
// damit auch reine Auswertungen ihn nutzen können, ohne aus `src/components/`
// zu importieren. Re-Export, weil Filter-Aufrufer ihn hier erwarten.
export { isCategoryInFilter } from '@/lib/analysis-data';

/** Kategorie einer Aufteilung (Unterkategorie gewinnt, wie bei der Buchung). */
function allocationCategoryId(allocation: TransactionAllocation): string | null {
  return allocation.subcategory_id ?? allocation.category_id ?? null;
}

/**
 * Kategorie-Filter einer Buchung. Mit `matchSplits` zählt zusätzlich JEDE
 * Aufteilung: eine Aldi-Buchung, die auf „Lebensmittel" und „Kleidung"
 * aufgeteilt ist, erscheint damit auch unter dem Filter „Kleidung" — sonst
 * wäre der aufgeteilte Anteil in der Buchungsliste unauffindbar.
 */
function matchesCategoryFilter(
  transaction: Transaction,
  categoriesById: Map<string, Category>,
  filter: string,
  allocations: readonly TransactionAllocation[] = [],
  matchSplits = false,
): boolean {
  if (filter === 'all') return true;
  if (
    isCategoryInFilter(transaction.subcategory_id, categoriesById, filter) ||
    isCategoryInFilter(transaction.category_id, categoriesById, filter)
  ) {
    return true;
  }
  if (!matchSplits) return false;
  return allocations.some((a) => isCategoryInFilter(allocationCategoryId(a), categoriesById, filter));
}

function matchesEssentialFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: EssentialFilter): boolean {
  if (filter === 'all') return true;
  // Dieselbe zugewiesene Kategorie wie die Charts (subcategory_id ?? category_id)
  // und Hierarchie-Vererbung, damit ein Drilldown-Klick auf ein Segment eine
  // Liste liefert, deren Summe zum Segment passt (F-UX-5).
  const assignedId = transaction.subcategory_id ?? transaction.category_id;
  if (!assignedId) return false;

  const isEssential = resolveEssenziell(categoriesById, assignedId) === true;
  return filter === 'ess' ? isEssential : !isEssential;
}

function matchesAusgabenklasseFilter(transaction: Transaction, categoriesById: Map<string, Category>, filter: AusgabenklasseFilter): boolean {
  if (filter === 'all') return true;
  const assignedId = transaction.subcategory_id ?? transaction.category_id;
  if (!assignedId) return filter === 'unkategorisiert';

  const klasse = resolveAusgabenklasse(categoriesById, assignedId);
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

/** Stabile Leer-Referenz für den Default (keine neue Map pro Aufruf). */
const NO_ALLOCATIONS: ReadonlyMap<string, TransactionAllocation[]> = new Map();

/**
 * Durchsuchbarer Text einer Buchung: Empfänger, Beschreibung, Originaltext —
 * und zusätzlich JEDE vom Nutzer erfasste Notiz. Notizen hängen an zwei
 * Stellen: direkt an der Buchung (`tax_note`) und an einzelnen Split-Zeilen
 * (`TransactionAllocation.label`, im UI schlicht „Notiz"). Wer eine Notiz
 * eingibt, sucht später danach — deshalb gehören beide in den Suchindex.
 */
function searchableText(
  transaction: Transaction,
  splitNotes: readonly TransactionAllocation[],
): string {
  return [
    transaction.payee,
    transaction.description,
    transaction.original_text,
    transaction.tax_note ?? '',
    ...splitNotes.map((allocation) => allocation.label ?? ''),
  ]
    .join(' ')
    .toLowerCase();
}

/** Aufteilungs-Kontext des Filters (Split-Buchungen). */
export interface SplitFilterContext {
  /** transaction_id → Aufteilungen (`getAllocationMap`). */
  byTransaction?: ReadonlyMap<string, TransactionAllocation[]>;
  /**
   * Kategorie-Filter zusätzlich über die Aufteilungen matchen. Bewusst opt-in:
   * die Buchungsseite zeigt den passenden Split als eigene Zeile unter der
   * Buchung, die Dashboard-Charts aggregieren dagegen ohne Aufteilungs-Map und
   * würden den vollen Buchungsbetrag der gefilterten Kategorie zuschlagen.
   */
  matchCategories?: boolean;
}

const NO_SPLITS: SplitFilterContext = {};

/**
 * Sammelt die Aufteilungen, die zum aktiven Kategorie-Filter passen — die
 * Buchungsliste klappt genau diese Zeilen auf („Aldi └ Kleidung"). Ohne
 * aktiven Kategorie-Filter (oder ohne Aufteilungen) leer.
 */
export function collectMatchingAllocationIds(
  allocationsByTransaction: ReadonlyMap<string, TransactionAllocation[]>,
  categories: Category[],
  filter: string,
): Set<string> {
  const matched = new Set<string>();
  if (filter === 'all') return matched;
  const categoriesById = getCategoryById(categories);
  for (const allocations of allocationsByTransaction.values()) {
    for (const allocation of allocations) {
      if (isCategoryInFilter(allocationCategoryId(allocation), categoriesById, filter)) {
        matched.add(allocation.id);
      }
    }
  }
  return matched;
}

export function filterTransactions(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  filters: DashboardFilterState,
  now = new Date(),
  contractDecisions: Map<string, ContractDecision> = new Map(),
  splits: SplitFilterContext = NO_SPLITS,
): Transaction[] {
  const { start, end } = getDashboardDateRange(filters.range, filters.customDays, now, filters.customPeriod ?? '');
  const search = filters.search.trim().toLowerCase();
  const categoriesById = getCategoryById(categories);
  const accountsById = getAccountById(accounts);
  const allocationsByTransaction = splits.byTransaction ?? NO_ALLOCATIONS;

  return transactions.filter((transaction) => {
    const txDate = parseISO(transaction.date);
    if (!isWithinInterval(txDate, { start, end })) return false;

    const allocations = transaction.id ? allocationsByTransaction.get(transaction.id) ?? [] : [];
    if (!matchesCategoryFilter(transaction, categoriesById, filters.category, allocations, splits.matchCategories)) {
      return false;
    }
    if (!matchesAccountFilter(transaction, accountsById, filters.account)) return false;
    if (!matchesContractFilter(transaction, categoriesById, contractDecisions, filters.contract)) return false;
    if (!matchesEssentialFilter(transaction, categoriesById, filters.essential)) return false;
    if (!matchesAusgabenklasseFilter(transaction, categoriesById, filters.ausgabenklasse)) return false;

    if (search && !searchableText(transaction, allocations).includes(search)) return false;

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
