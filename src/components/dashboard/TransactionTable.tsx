import { useQuery } from '@tanstack/react-query';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2, ArrowUpDown, ArrowDown, ArrowUp, MoreVertical, Pencil, Repeat } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Account, Category } from '../../types';
import { getAccounts } from '../../services/account-service';
import { CategoryCellEditor } from '@/components/categories/CategoryCellEditor';
import { useGentleMode } from '@/components/providers/GentleModeProvider';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  selected: Set<string>;
  hiddenTransactions: Set<string>;
  sortConfig: { key: keyof Transaction; direction: 'asc' | 'desc' } | null;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onUpdateCategory: (id: string, categoryId: string) => void;
  onDelete: (id: string) => void;
  onSort: (key: keyof Transaction) => void;
  onOpenDetails?: (transaction: Transaction) => void;
}

function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function TransactionTable({
  transactions,
  categories,
  selected,
  hiddenTransactions,
  sortConfig,
  onSelect,
  onToggleVisibility,
  onUpdateCategory,
  onDelete,
  onSort,
  onOpenDetails,
}: TransactionTableProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const getAccountById = (accountId: string | null | undefined): Account | undefined => {
    if (!accountId) return undefined;
    return accounts.find((account) => account.id === accountId);
  };

  const getSortIcon = (key: keyof Transaction) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 opacity-40" aria-hidden="true" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-4 w-4" aria-hidden="true" />
      : <ArrowDown className="h-4 w-4" aria-hidden="true" />;
  };

  const getAriaSort = (key: keyof Transaction): 'ascending' | 'descending' | 'none' => {
    if (!sortConfig || sortConfig.key !== key) return 'none';
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  const SortHeader = ({ columnKey, label }: { columnKey: keyof Transaction; label: string }) => (
    <TableHead aria-sort={getAriaSort(columnKey)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(columnKey)}
        className="-ml-3 h-8 gap-1 px-2 font-medium"
        aria-label={`${label} sortieren${sortConfig?.key === columnKey ? `, aktuell ${sortConfig.direction === 'asc' ? 'aufsteigend' : 'absteigend'}` : ''}`}
      >
        <span>{label}</span>
        {getSortIcon(columnKey)}
      </Button>
    </TableHead>
  );

  return (
    <div className="hidden md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead></TableHead>
          <SortHeader columnKey="date" label="Datum" />
          <TableHead>Konto</TableHead>
          <SortHeader columnKey="description" label="Beschreibung" />
          <SortHeader columnKey="payee" label="Empfänger" />
          <SortHeader columnKey="amount" label="Betrag" />
          <TableHead>Kategorie</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const account = getAccountById(transaction.account_id);
          const rowId = transaction.id || '';
          const hidden = hiddenTransactions.has(rowId);
          const amountLabel = gentleModeEnabled ? '***' : currencyFormatter.format(transaction.amount);

          return (
            <TableRow
              key={rowId}
              className={cn(hidden && 'opacity-50', onOpenDetails && rowId && 'cursor-pointer')}
              onClick={onOpenDetails && rowId ? () => onOpenDetails(transaction) : undefined}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={`Transaktion ${transaction.description || transaction.payee || rowId} auswählen`}
                  checked={selected.has(rowId)}
                  disabled={!rowId}
                  onCheckedChange={() => onSelect(rowId)}
                />
              </TableCell>
              <TableCell>{format(parseISO(transaction.date), 'dd.MM.yyyy', { locale: de })}</TableCell>
              <TableCell>
                {account ? (
                  <Badge
                    variant="outline"
                    className="text-xs whitespace-nowrap"
                    style={{
                      borderColor: account.color,
                      color: account.color,
                      backgroundColor: account.color + '10',
                    }}
                  >
                    <span aria-hidden="true">{account.icon}</span> {account.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell className="truncate max-w-xs">
                {onOpenDetails ? (
                  <button
                    type="button"
                    onClick={() => onOpenDetails(transaction)}
                    disabled={!rowId}
                    className="flex items-center gap-1.5 text-left hover:underline"
                  >
                    {transaction.is_contract && (
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Vertrag" />
                    )}
                    <span className="truncate">{transaction.description || '–'}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {transaction.is_contract && (
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Vertrag" />
                    )}
                    {transaction.description}
                  </span>
                )}
              </TableCell>
              <TableCell className="truncate max-w-xs">{transaction.payee || '-'}</TableCell>
              <TableCell className={transaction.amount < 0 ? 'text-warning' : 'text-positive'}>
                <span className="sr-only">{transaction.amount < 0 ? 'Ausgabe' : 'Einnahme'}: </span>
                {amountLabel}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <CategoryCellEditor
                  categories={categories}
                  value={transaction.category_id || ''}
                  disabled={!rowId}
                  className="w-40"
                  onChange={(catId) => {
                    if (!rowId) return;
                    onUpdateCategory(rowId, catId);
                  }}
                />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!rowId}
                      className="p-1 h-8 w-8"
                      aria-label="Aktionen"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onOpenDetails && (
                      <DropdownMenuItem onClick={() => onOpenDetails(transaction)}>
                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Details bearbeiten
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onToggleVisibility(rowId)}>
                      {hidden ? (
                        <><Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Einblenden</>
                      ) : (
                        <><EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> Ausblenden</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(rowId)} className="text-warning focus:text-warning">
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}
