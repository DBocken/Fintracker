import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Repeat } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Category, Transaction } from '../../types';
import { getAccounts } from '../../services/account-service';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import ListRow from '@/components/common/ListRow';

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
}: TransactionListMobileProps) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  // Konten werden vorgeladen, damit das Detail-Modal sie ohne Flackern anzeigt.
  useQuery({ queryKey: ['accounts'], queryFn: getAccounts });

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Nach Tag gruppieren, Reihenfolge der (bereits sortierten) Liste beibehalten.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Transaction[] }[] = [];
    const byKey = new Map<string, { key: string; label: string; items: Transaction[] }>();
    for (const tx of transactions) {
      const key = tx.date;
      let group = byKey.get(key);
      if (!group) {
        let label = key;
        try {
          label = format(parseISO(key), 'EEEE, d. MMMM yyyy', { locale: de });
        } catch {
          // Ungültiges Datum: Roh-Key als Label nutzen.
        }
        group = { key, label, items: [] };
        byKey.set(key, group);
        out.push(group);
      }
      group.items.push(tx);
    }
    return out;
  }, [transactions]);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-1">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <ul className="divide-y divide-border/70">
            {group.items.map((transaction) => {
              const rowId = transaction.id || '';
              const hidden = hiddenTransactions.has(rowId);
              const amountLabel = gentleModeEnabled ? '***' : currencyFormatter.format(transaction.amount);
              const payee = transaction.payee || transaction.description || '–';

              // Blattkategorie (Unterkategorie bevorzugt) für Icon + Name auflösen.
              const leaf = categoriesById.get(transaction.subcategory_id || transaction.category_id || '');
              const categoryName = leaf?.name ?? 'Unkategorisiert';
              const avatarEmoji = leaf?.icon || null;

              return (
                <li key={rowId} className={hidden ? 'py-1 opacity-50' : 'py-1'}>
                  <ListRow
                    leading={
                      <Checkbox
                        aria-label={`Transaktion ${payee} auswählen`}
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
                        <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Vertrag" />
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
