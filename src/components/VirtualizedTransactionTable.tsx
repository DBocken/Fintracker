/**
 * @deprecated Performance-Iteration, aktuell NICHT in Verwendung (Audit D).
 * Das Dashboard nutzt `TransactionTable` (Desktop) + `TransactionListMobile`.
 * Diese virtualisierte Variante bleibt als Basis für sehr große Datensätze
 * erhalten; vor erneutem Einsatz Strategie mit den anderen Tabellen klären.
 */
import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, EyeOff, MoreVertical, Trash2 } from 'lucide-react';
import type { Transaction, Category } from '@/types';
import { VIRTUAL_SCROLL_ITEM_HEIGHT, VIRTUAL_SCROLL_OVERSCAN } from '@/lib/performance';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CategoryCellEditor } from '@/components/categories/CategoryCellEditor';

interface VirtualizedTransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  selected: Set<string>;
  sortConfig: { key: keyof Transaction; direction: 'asc' | 'desc' } | null;
  hiddenTransactions: Set<string>;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onUpdateCategory: (id: string, categoryId: string) => void;
  onDelete: (id: string) => void;
  onSort: (key: keyof Transaction) => void;
  onBulkAction?: () => void;
}

export function VirtualizedTransactionTable({
  transactions,
  categories,
  selected,
  sortConfig,
  hiddenTransactions,
  onSelect,
  onToggleVisibility,
  onUpdateCategory,
  onDelete,
  onSort,
  onBulkAction,
}: VirtualizedTransactionTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  const { paginatedTransactions, totalPages } = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return {
      paginatedTransactions: transactions.slice(start, end),
      totalPages: Math.ceil(transactions.length / pageSize),
    };
  }, [transactions, currentPage, pageSize]);
  
  const virtualizer = useVirtualizer({
    count: paginatedTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_SCROLL_ITEM_HEIGHT,
    overscan: VIRTUAL_SCROLL_OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border font-semibold text-sm">
        <div className="w-6 flex-shrink-0"></div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSort('date')}
          className="w-28 justify-start px-0"
        >
          Datum
          {sortConfig?.key === 'date' && (
            <ArrowUpDown className={`ml-1 h-3 w-3 ${
              sortConfig.direction === 'asc' ? 'rotate-180' : ''
            }`} />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSort('payee')}
          className="flex-1 justify-start px-0"
        >
          Empfänger / Beschreibung
          {sortConfig?.key === 'payee' && (
            <ArrowUpDown className={`ml-1 h-3 w-3 ${
              sortConfig.direction === 'asc' ? 'rotate-180' : ''
            }`} />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSort('amount')}
          className="w-24 justify-end px-0"
        >
          Betrag
          {sortConfig?.key === 'amount' && (
            <ArrowUpDown className={`ml-1 h-3 w-3 ${
              sortConfig.direction === 'asc' ? 'rotate-180' : ''
            }`} />
          )}
        </Button>

        <div className="w-40 flex-shrink-0">Kategorie</div>
        <div className="w-10 flex-shrink-0"></div>
      </div>

      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: `${pageSize * VIRTUAL_SCROLL_ITEM_HEIGHT}px` }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const transaction = paginatedTransactions[virtualItem.index];
            const id = transaction.id || '';
            const isSelected = selected.has(id);
            const isHidden = hiddenTransactions.has(id);
            
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className={`flex items-center gap-3 px-4 border-b border-border hover:bg-accent transition-colors ${
                  isHidden ? 'opacity-50' : ''
                }`}
                style={{
                  height: `${VIRTUAL_SCROLL_ITEM_HEIGHT}px`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect(id)}
                  className="flex-shrink-0"
                />
                
                <div className="w-28 flex-shrink-0 text-sm">
                  {format(new Date(transaction.date), 'dd.MM.yyyy', { locale: de })}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{transaction.payee}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {transaction.description || transaction.original_text}
                  </p>
                </div>
                
                <div className={`w-24 flex-shrink-0 text-right font-medium ${
                  transaction.amount > 0 ? 'text-positive' : 'text-warning'
                }`}>
                  {transaction.amount.toFixed(2)}€
                </div>
                
                <div className="w-40 flex-shrink-0">
                  <CategoryCellEditor
                    categories={categories}
                    value={transaction.category_id || ''}
                    disabled={!id}
                    onChange={(value) => {
                      if (!id) return;
                      onUpdateCategory(id, value);
                    }}
                  />
                </div>

                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Aktionen">
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onToggleVisibility(id)}>
                        {isHidden ? (
                          <><Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Einblenden</>
                        ) : (
                          <><EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> Ausblenden</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(id)} className="text-warning focus:text-warning">
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Zeige {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, transactions.length)} von {transactions.length}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 pro Seite</SelectItem>
              <SelectItem value="50">50 pro Seite</SelectItem>
              <SelectItem value="100">100 pro Seite</SelectItem>
              <SelectItem value="200">200 pro Seite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium px-2">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>

          {onBulkAction && selected.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={onBulkAction}
              className="ml-2"
            >
              Aktionen ({selected.size})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}