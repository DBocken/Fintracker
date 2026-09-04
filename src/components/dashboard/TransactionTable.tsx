import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2, ArrowUpDown, ArrowDown, ArrowUp, MoreVertical, Pencil, Repeat } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';
import { useI18n } from '@/i18n/useI18n';
import { useDateFnsLocale } from '@/i18n/useDateFnsLocale';
import type { Transaction, Account, Category } from '../../types';
import { CategoryCellEditor } from '@/components/categories/CategoryCellEditor';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
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
  accounts,
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
  const { t } = useI18n();
  const dateFnsLocale = useDateFnsLocale();
  const money = useMoneyFormat();

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
        className="fokussiert:min-h-11 -ml-3 h-8 gap-1 px-2 font-medium"
        aria-label={`${label} ${t("dashboard.sort")}${sortConfig?.key === columnKey ? `, aktuell ${sortConfig.direction === 'asc' ? t("dashboard.ascending") : t("dashboard.descending")}` : ''}`}
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
          <SortHeader columnKey="date" label={t("dashboard.date")} />
          <TableHead>{t("dashboard.account", "Konto")}</TableHead>
          <SortHeader columnKey="description" label={t("dashboard.description")} />
          <SortHeader columnKey="payee" label={t("dashboard.payee")} />
          <SortHeader columnKey="amount" label={t("dashboard.amount")} />
          <TableHead>{t("dashboard.category", "Kategorie")}</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const account = getAccountById(transaction.account_id);
          const rowId = transaction.id || '';
          const hidden = hiddenTransactions.has(rowId);
          const amountLabel = money.mask(currencyFormatter.format(transaction.amount));

          return (
            <TableRow
              key={rowId}
              className={cn(hidden && 'opacity-50', onOpenDetails && rowId && 'cursor-pointer')}
              onClick={onOpenDetails && rowId ? () => onOpenDetails(transaction) : undefined}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={`${t("dashboard.selectTransaction")} ${transaction.description || transaction.payee || rowId}`}
                  checked={selected.has(rowId)}
                  disabled={!rowId}
                  onCheckedChange={() => onSelect(rowId)}
                />
              </TableCell>
              <TableCell>{format(parseISO(transaction.date), 'dd.MM.yyyy', { locale: dateFnsLocale })}</TableCell>
              <TableCell>
                {account ? (
                  // Die Kontofarbe traegt der Rahmen und der Punkt, NICHT die
                  // Schrift: Sie kommt aus den Nutzerdaten, also kann kein
                  // Token ihre Lesbarkeit garantieren — gemessen 3.92:1 auf der
                  // eigenen 6-%-Tönung. Als Rahmen bleibt die Zuordnung auf
                  // einen Blick erhalten, die Beschriftung wird lesbar.
                  <Badge
                    variant="outline"
                    className="whitespace-nowrap gap-1.5 text-xs text-foreground"
                    style={{
                      borderColor: account.color,
                      backgroundColor: account.color + '10',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: account.color }}
                    />
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
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("dashboard.contract")} />
                    )}
                    <span className="truncate">{transaction.description || '–'}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {transaction.is_contract && (
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("dashboard.contract")} />
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
                      className="p-1 h-8 w-8 fokussiert:min-h-11 fokussiert:min-w-11"
                      aria-label={t("dashboard.actions")}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onOpenDetails && (
                      <DropdownMenuItem onClick={() => onOpenDetails(transaction)}>
                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> {t("dashboard.editDetails")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onToggleVisibility(rowId)}>
                      {hidden ? (
                        <><Eye className="mr-2 h-4 w-4" aria-hidden="true" /> {t("dashboard.show")}</>
                      ) : (
                        <><EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> {t("dashboard.hide")}</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(rowId)} className="text-warning focus:text-warning">
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t("dashboard.delete")}
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
