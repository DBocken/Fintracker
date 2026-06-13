import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Eye, EyeOff, Trash2, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Account, Category } from '../../types';
import { getAccounts } from '../../services/account-service';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { useGentleMode } from '@/components/providers/GentleModeProvider';

interface TransactionListMobileProps {
  transactions: Transaction[];
  categories: Category[];
  selected: Set<string>;
  hiddenTransactions: Set<string>;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onUpdateCategory: (id: string, categoryId: string) => void;
  onDelete: (id: string) => void;
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function TransactionListMobile({
  transactions,
  categories,
  selected,
  hiddenTransactions,
  onSelect,
  onToggleVisibility,
  onUpdateCategory,
  onDelete,
}: TransactionListMobileProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  // Geöffnete Transaktion im Detail-Drawer (oder null)
  const [detailId, setDetailId] = useState<string | null>(null);

  const getAccountById = (accountId: string | null | undefined): Account | undefined => {
    if (!accountId) return undefined;
    return accounts.find((account) => account.id === accountId);
  };

  const detailTx = detailId ? transactions.find((t) => t.id === detailId) : undefined;
  const detailAccount = getAccountById(detailTx?.account_id);
  const detailHidden = detailId ? hiddenTransactions.has(detailId) : false;

  const AccountBadge = ({ account }: { account: Account | undefined }) =>
    account ? (
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
    );

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border">
        {transactions.map((transaction) => {
          const rowId = transaction.id || '';
          const hidden = hiddenTransactions.has(rowId);
          const amountLabel = gentleModeEnabled ? '***' : currencyFormatter.format(transaction.amount);

          return (
            <li key={rowId} className={hidden ? 'opacity-50' : undefined}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Checkbox
                  aria-label={`Transaktion ${transaction.description || transaction.payee || rowId} auswählen`}
                  checked={selected.has(rowId)}
                  disabled={!rowId}
                  onCheckedChange={() => onSelect(rowId)}
                />
                <button
                  type="button"
                  onClick={() => rowId && setDetailId(rowId)}
                  disabled={!rowId}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {transaction.payee || transaction.description || '–'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(transaction.date), 'dd.MM.yyyy', { locale: de })}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-sm tabular-nums ${
                      transaction.amount < 0 ? 'text-warning' : 'text-positive'
                    }`}
                  >
                    {amountLabel}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          {detailTx && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  {detailTx.payee || detailTx.description || 'Transaktion'}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Betrag</span>
                  <span
                    className={`text-lg font-semibold tabular-nums ${
                      detailTx.amount < 0 ? 'text-warning' : 'text-positive'
                    }`}
                  >
                    {gentleModeEnabled ? '***' : currencyFormatter.format(detailTx.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Datum</span>
                  <span className="text-sm">
                    {format(parseISO(detailTx.date), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Konto</span>
                  <AccountBadge account={detailAccount} />
                </div>

                {detailTx.description && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Beschreibung</span>
                    <span className="text-sm">{detailTx.description}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Kategorie</span>
                  <CategoryTwoStepSelect
                    categories={categories}
                    value={detailTx.category_id || ''}
                    disabled={!detailTx.id}
                    onChange={(catId) => {
                      if (detailTx.id) onUpdateCategory(detailTx.id, catId);
                    }}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => detailTx.id && onToggleVisibility(detailTx.id)}
                  >
                    {detailHidden ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> Einblenden
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Ausblenden
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-warning hover:text-warning"
                    onClick={() => {
                      if (detailTx.id) onDelete(detailTx.id);
                      setDetailId(null);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Löschen
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
