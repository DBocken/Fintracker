import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Repeat } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Category } from '../../types';
import { getAccounts } from '../../services/account-service';
import { useGentleMode } from '@/components/providers/GentleModeProvider';

interface TransactionListMobileProps {
  transactions: Transaction[];
  categories: Category[];
  selected: Set<string>;
  hiddenTransactions: Set<string>;
  onSelect: (id: string) => void;
  onOpenDetails: (transaction: Transaction) => void;
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function TransactionListMobile({
  transactions,
  selected,
  hiddenTransactions,
  onSelect,
  onOpenDetails,
}: TransactionListMobileProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  // Konten werden vorgeladen, damit das Detail-Modal sie ohne Flackern anzeigt.
  useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  return (
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
                onClick={() => onOpenDetails(transaction)}
                disabled={!rowId}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {transaction.is_contract && (
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Vertrag" />
                    )}
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
  );
}
