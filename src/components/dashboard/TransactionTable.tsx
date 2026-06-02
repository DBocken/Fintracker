"use client";

import { useQuery } from '@tanstack/react-query';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Account, Category } from '../../types';
import { getAccounts } from '../../services/account-service';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';

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
}

function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

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
  onSort 
}: TransactionTableProps) {
  // Load accounts for display
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const getAccountById = (accountId: string | null | undefined): Account | undefined => {
    if (!accountId) return undefined;
    return accounts.find(a => a.id === accountId);
  };

  const getSortIcon = (key: keyof Transaction) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead></TableHead>
          <TableHead className="cursor-pointer" onClick={() => onSort('date')}>
            Datum {getSortIcon('date')}
          </TableHead>
          <TableHead>Konto</TableHead>
          <TableHead className="cursor-pointer" onClick={() => onSort('description')}>
            Beschreibung {getSortIcon('description')}
          </TableHead>
          <TableHead className="cursor-pointer" onClick={() => onSort('payee')}>
            Empfänger {getSortIcon('payee')}
          </TableHead>
          <TableHead className="cursor-pointer" onClick={() => onSort('amount')}>
            € {getSortIcon('amount')}
          </TableHead>
          <TableHead>Kategorie</TableHead>
          <TableHead>Sichtbar</TableHead>
          <TableHead>Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(t => {
          const account = getAccountById(t.account_id);
          const rowId = t.id || '';
          return (
            <TableRow 
              key={rowId}
              className={cn(
                hiddenTransactions.has(rowId) && "opacity-50"
              )}
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(rowId)}
                  onCheckedChange={() => onSelect(rowId)}
                />
              </TableCell>
              <TableCell>{format(parseISO(t.date), 'dd.MM.yyyy', { locale: de })}</TableCell>
              <TableCell>
                {account ? (
                  <Badge 
                    variant="outline" 
                    className="text-xs whitespace-nowrap"
                    style={{ 
                      borderColor: account.color,
                      color: account.color,
                      backgroundColor: account.color + '10'
                    }}
                  >
                    {account.icon} {account.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell className="truncate max-w-xs">{t.description}</TableCell>
              <TableCell className="truncate max-w-xs">{t.payee || '-'}</TableCell>
              <TableCell className={t.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                {Math.abs(t.amount).toFixed(2)}€
              </TableCell>
              <TableCell>
                <CategoryTwoStepSelect
                  categories={categories}
                  value={t.category_id || ''}
                  disabled={!rowId}
                  onChange={(catId) => {
                    if (!rowId) return;
                    onUpdateCategory(rowId, catId);
                  }}
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleVisibility(rowId)}
                  className="p-1 h-8 w-8"
                  title={hiddenTransactions.has(rowId) ? "Einblenden" : "Ausblenden"}
                >
                  {hiddenTransactions.has(rowId) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(rowId)}
                  className="p-1 h-8 w-8 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}