import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Repeat } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Category, Transaction } from '../../types';
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

/** Erste sinnvolle Initiale des Empfängers für das Fallback-Avatar. */
function payeeInitial(payee: string): string {
  const match = payee.trim().match(/[A-Za-zÄÖÜäöü0-9]/);
  return match ? match[0].toUpperCase() : '•';
}

export function TransactionListMobile({
  transactions,
  categories,
  selected,
  hiddenTransactions,
  onSelect,
  onOpenDetails,
}: TransactionListMobileProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  // Konten werden vorgeladen, damit das Detail-Modal sie ohne Flackern anzeigt.
  useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <ul className="divide-y divide-border">
      {transactions.map((transaction) => {
        const rowId = transaction.id || '';
        const hidden = hiddenTransactions.has(rowId);
        const amountLabel = gentleModeEnabled ? '***' : currencyFormatter.format(transaction.amount);
        const payee = transaction.payee || transaction.description || '–';

        // Blattkategorie (Unterkategorie bevorzugt) für Icon + Name auflösen.
        const leaf = categoriesById.get(transaction.subcategory_id || transaction.category_id || '');
        const categoryName = leaf?.name ?? 'Unkategorisiert';
        const avatarEmoji = leaf?.icon || null;

        return (
          <li key={rowId} className={hidden ? 'opacity-50' : undefined}>
            <div className="flex items-center gap-3 px-1 py-2">
              <Checkbox
                aria-label={`Transaktion ${payee} auswählen`}
                checked={selected.has(rowId)}
                disabled={!rowId}
                onCheckedChange={() => onSelect(rowId)}
              />
              <button
                type="button"
                onClick={() => onOpenDetails(transaction)}
                disabled={!rowId}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {/* Avatar: Kategorie-Emoji oder Initiale des Empfängers */}
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg"
                  style={leaf?.color ? { backgroundColor: `${leaf.color}22` } : undefined}
                >
                  {avatarEmoji ?? (
                    <span className="text-sm font-semibold text-muted-foreground">{payeeInitial(payee)}</span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {transaction.is_contract && (
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Vertrag" />
                    )}
                    <span className="truncate">{payee}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0">
                      {format(parseISO(transaction.date), 'dd.MM.yyyy', { locale: de })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{categoryName}</span>
                  </div>
                </div>

                <div
                  className={`shrink-0 text-sm font-medium tabular-nums ${
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
