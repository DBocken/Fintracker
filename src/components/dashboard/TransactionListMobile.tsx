import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Repeat } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import type { Account, Category, Transaction } from '../../types';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import ListRow from '@/features/shared/presentation/ListRow';
import { buildDayGroups, formatDayHeading } from './transaction-day-groups';

interface TransactionListMobileProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  selected: Set<string>;
  hiddenTransactions: Set<string>;
  onSelect: (id: string) => void;
  onOpenDetails: (transaction: Transaction) => void;
  /** Nur für Tests: fixiert „heute" für die Tageskopf-Relativierung (Heute/Gestern). */
  now?: Date;
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

/**
 * Mobile Buchungsliste: kompakte Icon-Kachel-Zeilen (geteilte ListRow-Primitive)
 * unter datumsgruppierten Köpfen. Die Gruppierung ist rein darstellend – sie
 * fasst den Tag einmal zusammen, statt das Datum in jeder Zeile zu wiederholen,
 * und macht die Liste damit besser scannbar (Audit P1.2 / Mobile-Politur).
 */
export function TransactionListMobile({
  transactions,
  categories,
  selected,
  hiddenTransactions,
  onSelect,
  onOpenDetails,
  now,
}: TransactionListMobileProps) {
  const { t } = useI18n();
  const money = useMoneyFormat();

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Dieselbe Tagesgruppierung wie die Desktop-Fassung (`TransactionDayList`,
  // WP 5.5/KOMP-3) — vorher hatte diese Liste ein eigenes `reduce` mit
  // vollem Datum ohne „Heute/Gestern"-Relativierung, identische Buchungen
  // sahen also je Einstiegspunkt anders formatiert aus. `endingBalance`
  // bleibt 0: `delta`/`runningBalance` werden hier nicht dargestellt, nur
  // Kopf (`formatDayHeading`) und Zeilen.
  const groups = useMemo(() => buildDayGroups(transactions, 0), [transactions]);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-1">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {formatDayHeading(group.key, now)}
          </h3>
          <ul className="divide-y divide-border/70">
            {group.items.map((transaction) => {
              const rowId = transaction.id || '';
              const hidden = hiddenTransactions.has(rowId);
              const amountLabel = money.mask(currencyFormatter.format(transaction.amount));
              const payee = transaction.payee || transaction.description || '–';

              // Blattkategorie (Unterkategorie bevorzugt) für Icon + Name auflösen.
              const leaf = categoriesById.get(transaction.subcategory_id || transaction.category_id || '');
              const categoryName = leaf?.name ?? t('dashboard.uncategorized');
              const avatarEmoji = leaf?.icon || null;

              return (
                <li key={rowId} className={hidden ? 'py-1 opacity-50' : 'py-1'}>
                  <ListRow
                    leading={
                      <Checkbox
                        aria-label={t('dashboard.selectTransactionLabel').replace('{payee}', payee)}
                        checked={selected.has(rowId)}
                        disabled={!rowId}
                        onCheckedChange={() => onSelect(rowId)}
                      />
                    }
                    icon={
                      avatarEmoji ?? (
                        <span className="text-sm font-semibold text-muted-foreground">{payeeInitial(payee)}</span>
                      )
                    }
                    iconColor={leaf?.color || undefined}
                    title={payee}
                    titleSuffix={
                      transaction.is_contract ? (
                        <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t('dashboard.contract')} />
                      ) : undefined
                    }
                    subtitle={categoryName}
                    value={amountLabel}
                    valueTone={transaction.amount < 0 ? 'warning' : 'positive'}
                    onClick={rowId ? () => onOpenDetails(transaction) : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
