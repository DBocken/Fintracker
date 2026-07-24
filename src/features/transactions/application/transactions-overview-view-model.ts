import type { useTransactionDetailEditing } from '@/hooks/useTransactionDetailEditing';
import type { Account, Category, Transaction, TransactionAllocation } from '@/types';
import type { DashboardFilterState } from '@/components/dashboard/filter-utils';
import type { DashboardGranularity, DashboardRange } from '@/components/dashboard/filter-constants';
import type { PeriodOption } from '@/components/dashboard/period-utils';

/**
 * UI-neutrales ViewModel der Buchungsseite (Verhaltensreferenz:
 * `src/pages/TransactionsPage.tsx`). Enthält keine Darstellungsentscheidungen
 * (keine Farben/Spalten/JSX) und kein Router-/URL-Zeug — Desktop- und
 * Mobile-Präsentation konsumieren dasselbe Objekt aus
 * `useTransactionsOverview()`, das URL-Write-back bleibt Sache der Page.
 */
export type TransactionsOverviewViewModel = {
  /** Ladezustand der Transaktions-Query. */
  loading: boolean;
  /** Nur ohne Buchungen NACH Ladeende true (kein Flackern während des Ladens). */
  isEmpty: boolean;
  transactions: {
    all: Transaction[];
    /** `all`, gefiltert und um ausgeblendete Buchungen (`hidden`) bereinigt. */
    visible: Transaction[];
  };
  categories: Category[];
  accounts: Account[];
  /**
   * Aufteilungen (Split-Buchungen) für die Liste: `byTransaction` speist die
   * aufklappbaren Split-Zeilen, `matchedIds` sind die Aufteilungen, die zum
   * aktiven Kategorie-Filter passen (leer, solange kein Kategorie-Filter
   * gesetzt ist) — deren Buchungen zeigen die passende Zeile direkt an.
   */
  splits: {
    byTransaction: ReadonlyMap<string, TransactionAllocation[]>;
    matchedIds: ReadonlySet<string>;
  };
  balances: {
    /** Aktueller Saldo im gewählten Konto-Scope (TransactionsPage Z. 135–145). */
    scopedCurrent: number;
    /** Rückwärts abgeleiteter Anker-Saldo für die Tagesliste (TransactionsPage Z. 169–183). */
    ending: number;
    /** `!hasContentFilter(values)` — nur bei reinem Konto-/Zeitfilter true (TransactionsPage Z. 157–165). */
    showRunningBalance: boolean;
  };
  stats: { income: number; expenses: number; balance: number; count: number };
  filters: {
    /**
     * Referenzstabil, solange sich kein Filterfeld ändert (URL-Write-back der
     * Page hängt an dieser Referenz — ein neues Objekt bei jedem Render würde
     * eine Sync-Schleife mit `useSearchParams` auslösen).
     */
    values: DashboardFilterState;
    /**
     * Bewusst NICHT Teil von `values` und nicht URL-synct (Ist-Verhalten der
     * Page: `customGran` lebt in einem eigenen `useState`, unabhängig vom
     * Filter-State/der URL-Kodierung via `encodeDashboardFilters`).
     */
    customGranularity: DashboardGranularity;
    set: {
      /** Wie Page-`patchFilters` (Z. 89): merged Teiländerungen in `values`. */
      patch(p: Partial<DashboardFilterState>): void;
      /** `handleSetRange`-Semantik (Page Z. 209–216): belegt bei Perioden-Ranges die neueste Periode vor. */
      range(v: DashboardRange): void;
      customGranularity(v: DashboardGranularity): void;
    };
    /** Zählung wie `countActiveFilters` (Domain, 7 Dimensionen inkl. range/search). */
    activeCount: number;
    /** Nur bei Perioden-Ranges (Jahr/Quartal/Monat) befüllt, sonst leer (PERIOD_RANGES-Guard wie Page). */
    periodOptions: PeriodOption[];
    /**
     * Bildet `resetFilters` (Page Z. 218–231) EXAKT nach: setzt ALLE
     * Filterfelder inkl. `ausgabenklasse` UND `customGranularity` zurück —
     * anders als der Dashboard-Hook, dessen `reset()` `ausgabenklasse`
     * bewusst NICHT anfasst.
     */
    reset(): void;
  };
  /**
   * `usePersistedSet('transactions_hidden')` — bewusst ein eigener
   * localStorage-Key, getrennt vom Dashboard-Key
   * (`dashboard_hidden_transactions`): Ausblenden auf der Buchungsseite soll
   * nicht die Dashboard-Vorschau beeinflussen und umgekehrt.
   */
  hidden: { ids: Set<string>; toggle(id: string): void };
  actions: {
    /**
     * Page-`deleteMut` (Z. 109–115): invalidiert `transactionsKeys.transactionsRoot`
     * und zeigt `toast.success(t('dashboard.transactionDeleted'))`. BEWUSST
     * ohne `onError` (Ist-Verhalten der Page, anders als der Dashboard-Hook).
     */
    deleteTransaction(id: string): void;
    saveDetails: ReturnType<typeof useTransactionDetailEditing>['save'];
    detailsSaving: boolean;
  };
};
