import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VirtualizedTransactionTable } from './VirtualizedTransactionTable';
import type { Transaction } from '@/types';
import {
  getTransactionsPaginated,
  getCategories,
  type TransactionFilterOptions 
} from '@/services/transaction-service';

interface OptimizedTransactionTableProps {
  filters?: TransactionFilterOptions;
  selected: Set<string>;
  hiddenTransactions: Set<string>;
  sortConfig: { key: keyof Transaction; direction: 'asc' | 'desc' } | null;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onUpdateCategory: (id: string, categoryId: string) => void;
  onDelete: (id: string) => void;
  onSort: (key: keyof Transaction) => void;
  onBulkAction?: () => void;
}

const VIRTUAL_SCROLL_THRESHOLD = 100; // Use virtual scrolling for 100+ items
const DEFAULT_PAGE_SIZE = 50;

export function OptimizedTransactionTable({
  filters,
  selected,
  hiddenTransactions,
  sortConfig,
  onSelect,
  onToggleVisibility,
  onUpdateCategory,
  onDelete,
  onSort,
  onBulkAction,
}: OptimizedTransactionTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch transactions with pagination
  const { data: paginatedResult, isLoading } = useQuery({
    queryKey: ['transactions', 'paginated', currentPage, DEFAULT_PAGE_SIZE, filters],
    queryFn: () => getTransactionsPaginated(currentPage, DEFAULT_PAGE_SIZE, filters),
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  // Determine if we should use virtual scrolling
  const useVirtualScroll = useMemo(() => {
    return (paginatedResult?.transactions.length || 0) >= VIRTUAL_SCROLL_THRESHOLD;
  }, [paginatedResult?.transactions.length]);

  // Apply client-side sorting and filtering if needed
  const transactions = useMemo(() => {
    let result = paginatedResult?.transactions || [];

    // Apply sorting if configured (client-side for simplicity)
    if (sortConfig && sortConfig.key) {
      result = [...result].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    // Filter out hidden transactions
    if (hiddenTransactions.size > 0) {
      result = result.filter(t => !hiddenTransactions.has(t.id || ''));
    }

    return result;
  }, [paginatedResult?.transactions, sortConfig, hiddenTransactions]);

  // Update page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle bulk actions
  const handleBulkAction = () => {
    if (onBulkAction && selected.size > 0) {
      onBulkAction();
    }
  };

  if (isLoading && !paginatedResult) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Lade Transaktionen...</p>
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Keine Transaktionen gefunden</p>
          <p className="text-sm text-muted-foreground">
            {filters ? 'Versuche andere Filter' : 'Importiere deine Bank-CSV um loszulegen'}
          </p>
        </div>
      </div>
    );
  }

  // Use virtualized table for large datasets
  if (useVirtualScroll) {
    return (
      <VirtualizedTransactionTable
        transactions={transactions}
        categories={categories}
        selected={selected}
        sortConfig={sortConfig}
        hiddenTransactions={hiddenTransactions}
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
        onUpdateCategory={onUpdateCategory}
        onDelete={onDelete}
        onSort={onSort}
        onBulkAction={handleBulkAction}
      />
    );
  }

  // For smaller datasets, use regular table (already exists in TransactionTable.tsx)
  // This maintains backward compatibility while enabling optimization for large datasets
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground px-4 py-2">
        {transactions.length} Transaktionen geladen
        {paginatedResult?.total && paginatedResult.total > transactions.length && (
          <span> (von {paginatedResult.total.toLocaleString('de-DE')} insgesamt)</span>
        )}
      </div>
      
      {/* Regular table for smaller datasets */}
      <VirtualizedTransactionTable
        transactions={transactions}
        categories={categories}
        selected={selected}
        sortConfig={sortConfig}
        hiddenTransactions={hiddenTransactions}
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
        onUpdateCategory={onUpdateCategory}
        onDelete={onDelete}
        onSort={onSort}
        onBulkAction={handleBulkAction}
      />
    </div>
  );
}

export default OptimizedTransactionTable;