import type { useTransactionDetailEditing } from '@/hooks/useTransactionDetailEditing';
import type { Account, Category, Transaction } from '@/types';
import type { SankeyData } from '@/lib/analysis-data';
import type {
  ContractFilter,
  DashboardGranularity,
  DashboardRange,
  EssentialFilter,
  AusgabenklasseFilter,
} from '@/components/dashboard/filter-constants';
import type { PeriodOption } from '@/components/dashboard/period-utils';
import type { EffectiveBalance, FinanceOverviewStats } from '../domain/overview-types';

/** Aktuelle Werte aller Dashboard-Filter (1:1 zu `DEFAULT_DASHBOARD_FILTERS`). */
export type DashboardFilterValues = {
  category: string;
  account: string;
  contract: ContractFilter;
  essential: EssentialFilter;
  ausgabenklasse: AusgabenklasseFilter;
  search: string;
  range: DashboardRange;
  customDays: number;
  customGranularity: DashboardGranularity;
  customPeriod: string;
};

export type SortConfig = { key: keyof Transaction; direction: 'asc' | 'desc' };

/**
 * UI-neutrales ViewModel der Finanzübersicht. Enthält keine Darstellungs-
 * entscheidungen (keine Farben/Spalten/JSX) — Desktop- und Mobile-Präsentation
 * konsumieren dasselbe Objekt aus `useFinanceOverview()`.
 */
export type FinanceOverviewViewModel = {
  loading: boolean;
  /**
   * Ohne Buchungen NACH Ladeende — **und nur, wenn das Laden gelungen ist**
   * (WP-9.2). Schliesst `hasError` aus: „keine Buchungen" und „Buchungen
   * nicht ladbar" sind verschiedene Aussagen und brauchen verschiedene
   * Darstellungen.
   */
  isEmpty: boolean;
  /** Die Transaktions-Query ist gescheitert (WP-9.2). */
  hasError: boolean;
  /** Konten-Query lädt/scheitert unabhängig von der Transaktions-Query — eigene Flags statt `loading` mitzubenutzen. */
  accountsLoading: boolean;
  accountsError: boolean;
  transactions: {
    all: Transaction[];
    visible: Transaction[];
    sorted: Transaction[];
    preview: Transaction[];
  };
  categories: Category[];
  accounts: Account[];
  balances: { byAccount: Record<string, EffectiveBalance>; total: number };
  stats: FinanceOverviewStats;
  sankeyData: SankeyData;
  filters: {
    values: DashboardFilterValues;
    set: {
      category(v: string): void;
      account(v: string): void;
      contract(v: ContractFilter): void;
      essential(v: EssentialFilter): void;
      ausgabenklasse(v: AusgabenklasseFilter): void;
      search(v: string): void;
      /** Setzt den Range UND belegt die Periode vor (siehe `handleSetRange`, ehem. Dashboard.tsx 239–247). */
      range(v: DashboardRange): void;
      customDays(v: number): void;
      customGranularity(v: DashboardGranularity): void;
      customPeriod(v: string): void;
    };
    /** Zählung wie ehem. Dashboard.tsx 216–224 — nur category/account/contract/essential/range. */
    activeCount: number;
    periodOptions: PeriodOption[];
    /** Deep-Link auf `/transactions` mit kodierten aktiven Filtern (ehem. Dashboard.tsx 286–300). */
    transactionsLink: string;
    reset(): void;
  };
  sort: { config: SortConfig | null; toggle(key: keyof Transaction): void };
  hidden: { ids: Set<string>; toggle(id: string): void };
  actions: {
    updateCategory(transactionId: string, categoryId: string): void;
    deleteTransaction(id: string): void;
    saveDetails: ReturnType<typeof useTransactionDetailEditing>['save'];
    detailsSaving: boolean;
    reload(): void;
  };
};
