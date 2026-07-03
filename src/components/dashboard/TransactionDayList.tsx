import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Repeat } from 'lucide-react';
import type { Account, Category, Transaction } from '@/types';
import { getAccounts } from '../../services/account-service';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import ListRow from '@/components/common/ListRow';
import { cn } from '@/lib/utils';
import { buildDayGroups, formatDayHeading } from './transaction-day-groups';

interface TransactionDayListProps {
  /** Bereits gefilterte, absteigend nach Datum sortierte Buchungen. */
  transactions: Transaction[];
  categories: Category[];
  hiddenTransactions: Set<string>;
  onOpenDetails: (transaction: Transaction) => void;
  /** Aktueller Gesamtsaldo als Anker für den rückwärts abgeleiteten Tagesstand. */
  endingBalance: number;
  /** `false` blendet die Kontostand-Kopfzeile aus (z. B. bei aktivem Kategorie-Filter). */
  showRunningBalance?: boolean;
  /** Aktuell im Detail-Panel geöffnete Buchung – wird in der Liste hervorgehoben. */
  selectedId?: string | null;
  now?: Date;
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const deltaFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'always',
});

/** Erste sinnvolle Initiale des Empfängers für das Fallback-Avatar. */
function payeeInitial(payee: string): string {
  const match = payee.trim().match(/[A-Za-zÄÖÜäöü0-9]/);
  return match ? match[0].toUpperCase() : '•';
}

/**
 * Buchungsliste im Tages-Schema: pro Tag eine Kopfzeile mit Kontostand (fett)
 * und Tagessaldo (getönt), darunter die kompakten Icon-Zeilen. Der Kontostand
 * wird rückwärts aus dem aktuellen Gesamtsaldo abgeleitet (siehe
 * `buildDayGroups`), sodass die Kopfzeile dem echten Verlauf entspricht.
 */
export function TransactionDayList({
  transactions,
  categories,
  hiddenTransactions,
  onOpenDetails,
  endingBalance,
  showRunningBalance = true,
  selectedId,
  now,
}: TransactionDayListProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  // Konten für den Farb-Punkt je Zeile und ein flackerfreies Detail-Modal.
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ['accounts'], queryFn: getAccounts });

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const groups = useMemo(
    () => buildDayGroups(transactions, endingBalance),
    [transactions, endingBalance],
  );

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const heading = formatDayHeading(group.key, now);
        const balanceLabel = gentleModeEnabled ? '***' : currencyFormatter.format(group.runningBalance);
        const deltaLabel = gentleModeEnabled ? '' : deltaFormatter.format(group.delta);

        return (
          <section key={group.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
              <h3 className="text-sm font-medium text-muted-foreground">{heading}</h3>
              {showRunningBalance && (
                <div className="flex items-baseline gap-2 text-right tabular-nums">
                  <span className="text-sm font-semibold text-foreground">{balanceLabel}</span>
                  {deltaLabel && (
                    <span
                      className={cn(
                        'text-xs',
                        group.delta > 0 ? 'text-positive' : 'text-muted-foreground',
                      )}
                    >
                      {deltaLabel}
                    </span>
                  )}
                </div>
              )}
            </div>

            <ul className="divide-y divide-border/70">
              {group.items.map((transaction) => {
                const rowId = transaction.id || '';
                const hidden = hiddenTransactions.has(rowId);
                const isSelected = !!rowId && rowId === selectedId;
                const amountLabel = gentleModeEnabled ? '***' : currencyFormatter.format(transaction.amount);
                const payee = transaction.payee || transaction.description || '–';

                const leaf = categoriesById.get(transaction.subcategory_id || transaction.category_id || '');
                const avatarEmoji = leaf?.icon || null;
                const account = transaction.account_id ? accountsById.get(transaction.account_id) : undefined;

                return (
                  <li
                    key={rowId}
                    className={cn(
                      'rounded-lg px-1 py-1',
                      hidden && 'opacity-50',
                      isSelected && 'bg-muted/60 ring-1 ring-brand/40',
                    )}
                  >
                    <ListRow
                      icon={
                        avatarEmoji ?? (
                          <span className="text-sm font-semibold text-muted-foreground">{payeeInitial(payee)}</span>
                        )
                      }
                      iconColor={leaf?.color || undefined}
                      title={
                        <span className="flex items-center gap-2">
                          {account?.color && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: account.color }}
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{payee}</span>
                        </span>
                      }
                      titleSuffix={
                        transaction.is_contract ? (
                          <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Vertrag" />
                        ) : undefined
                      }
                      value={amountLabel}
                      valueTone={transaction.amount < 0 ? 'warning' : 'positive'}
                      chevron={false}
                      onClick={rowId ? () => onOpenDetails(transaction) : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
