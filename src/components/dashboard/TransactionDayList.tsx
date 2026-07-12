import { useMemo, useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Repeat } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import type { Account, Category, Transaction } from '@/types';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import ListRow from '@/components/common/ListRow';
import { cn } from '@/lib/utils';
import {
  buildDayGroups,
  flattenDayGroups,
  formatDayHeading,
  type DayGroup,
} from './transaction-day-groups';

interface TransactionDayListProps {
  /** Bereits gefilterte, absteigend nach Datum sortierte Buchungen. */
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
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

// Ab dieser Item-Zahl (Headings + Zeilen) wird fenster-virtualisiert. Kleine
// Listen rendern klassisch: identisches Markup, kein Mess-Overhead, und die
// semantische ul/li-Struktur bleibt für den häufigsten Fall erhalten.
const VIRTUALIZE_THRESHOLD = 150;

const ROW_ESTIMATE_PX = 52;
const HEADING_ESTIMATE_PX = 44;

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
 *
 * Große Listen (5000-Buchungen-Query der TransactionsPage) werden über
 * `useWindowVirtualizer` gefenstert: die Seite scrollt selbst (kein eigener
 * Overflow-Container), gerendert wird nur der sichtbare Ausschnitt.
 */
export function TransactionDayList({
  transactions,
  categories,
  accounts,
  hiddenTransactions,
  onOpenDetails,
  endingBalance,
  showRunningBalance = true,
  selectedId,
  now,
}: TransactionDayListProps) {
  const { t } = useI18n();
  const { enabled: gentleModeEnabled } = useGentleMode();

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const groups = useMemo(
    () => buildDayGroups(transactions, endingBalance),
    [transactions, endingBalance],
  );
  const flatItems = useMemo(() => flattenDayGroups(groups), [groups]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualize = flatItems.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useWindowVirtualizer({
    count: virtualize ? flatItems.length : 0,
    estimateSize: (index) =>
      flatItems[index]?.type === 'heading' ? HEADING_ESTIMATE_PX : ROW_ESTIMATE_PX,
    overscan: 12,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  // withTopSpacing: nur der virtualisierte Pfad braucht den Tages-Abstand am
  // Heading selbst — im klassischen Pfad übernimmt das space-y-6 des Containers.
  const renderDayHeader = (group: DayGroup, withTopSpacing: boolean) => {
    const heading = formatDayHeading(group.key, now);
    const balanceLabel = gentleModeEnabled ? '***' : currencyFormatter.format(group.runningBalance);
    const deltaLabel = gentleModeEnabled ? '' : deltaFormatter.format(group.delta);

    return (
      <div className={cn('flex items-baseline justify-between gap-3 px-1 pb-1', withTopSpacing && 'pt-6')}>
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
    );
  };

  const renderTransactionRow = (transaction: Transaction) => {
    const rowId = transaction.id || '';
    const hidden = hiddenTransactions.has(rowId);
    const isSelected = !!rowId && rowId === selectedId;
    const amountLabel = gentleModeEnabled ? '***' : currencyFormatter.format(transaction.amount);
    const payee = transaction.payee || transaction.description || '–';

    const leaf = categoriesById.get(transaction.subcategory_id || transaction.category_id || '');
    const avatarEmoji = leaf?.icon || null;
    const account = transaction.account_id ? accountsById.get(transaction.account_id) : undefined;

    return (
      <div
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
              <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t('dashboard.contract')} />
            ) : undefined
          }
          value={amountLabel}
          valueTone={transaction.amount < 0 ? 'warning' : 'positive'}
          chevron={false}
          onClick={rowId ? () => onOpenDetails(transaction) : undefined}
        />
      </div>
    );
  };

  if (virtualize) {
    const virtualItems = virtualizer.getVirtualItems();
    return (
      <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const item = flatItems[virtualItem.index];
          if (!item) return null;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              // Bewusst ohne measureElement: Zeilen/Headings haben fixe Höhen
              // (truncate statt Umbruch); die Schätzgrößen stimmen exakt, und
              // jsdom (Messhöhe 0) geriete sonst in eine Resize-Schleife.
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {item.type === 'heading' ? (
                renderDayHeader(item.group, virtualItem.index !== 0)
              ) : (
                <div className={cn(!item.isFirstRowOfDay && 'border-t border-border/70')}>
                  {renderTransactionRow(item.transaction)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} className="space-y-1">
          {renderDayHeader(group, false)}
          <ul className="divide-y divide-border/70">
            {group.items.map((transaction) => (
              <li key={transaction.id || ''}>{renderTransactionRow(transaction)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
