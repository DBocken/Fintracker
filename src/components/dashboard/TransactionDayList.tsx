import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Repeat, SplitSquareHorizontal } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { toMajor } from '@/lib/money';
import type { Account, Category, Transaction, TransactionAllocation } from '@/types';
import { useGentleMode } from '@/components/providers/GentleModeProvider';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import ListRow from '@/components/common/ListRow';
import { cn } from '@/lib/utils';
import { useMotionQuality } from '@/hooks/useMotionQuality';
import { planListReorganization } from '@/lib/list-reorganization';
import { MOTION_EASINGS_BEZIER } from '@/lib/motion-tokens';
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
  /**
   * transaction_id → Aufteilungen (Split-Buchungen). Aktiviert das Akkordeon:
   * aufgeteilte Buchungen lassen sich aufklappen und zeigen ihre Anteile
   * (Kategorie, Notiz, Betrag) als eingerückte Zeilen.
   */
  allocationsByTransaction?: ReadonlyMap<string, TransactionAllocation[]>;
  /**
   * Aufteilungen, die zum aktiven Kategorie-Filter passen. Deren Buchungen
   * starten aufgeklappt und zeigen genau diese Zeilen — so erscheint eine
   * Aldi-Buchung unter dem Filter „Kleidung" als „Aldi └ Kleidung".
   */
  matchedAllocationIds?: ReadonlySet<string>;
  now?: Date;
}

const NO_ALLOCATIONS: ReadonlyMap<string, TransactionAllocation[]> = new Map();
const NO_MATCHES: ReadonlySet<string> = new Set();

// Ab dieser Item-Zahl (Headings + Zeilen) wird fenster-virtualisiert. Kleine
// Listen rendern klassisch: identisches Markup, kein Mess-Overhead, und die
// semantische ul/li-Struktur bleibt für den häufigsten Fall erhalten.
const VIRTUALIZE_THRESHOLD = 150;

const ROW_ESTIMATE_PX = 52;
const HEADING_ESTIMATE_PX = 44;
const SPLIT_ROW_ESTIMATE_PX = 36;

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
  allocationsByTransaction = NO_ALLOCATIONS,
  matchedAllocationIds = NO_MATCHES,
  now,
}: TransactionDayListProps) {
  const { t } = useI18n();
  const { enabled: gentleModeEnabled } = useGentleMode();
  const money = useMoneyFormat();

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Explizite Nutzer-Entscheidung je Buchung (true = aufgeklappt). Ohne Eintrag
  // entscheidet der Kategorie-Filter: passt eine Aufteilung, ist die Buchung
  // offen und zeigt genau die passenden Zeilen.
  const [splitToggles, setSplitToggles] = useState<ReadonlyMap<string, boolean>>(new Map());

  const toggleSplit = useCallback((transactionId: string, isOpen: boolean) => {
    setSplitToggles((prev) => {
      const next = new Map(prev);
      next.set(transactionId, !isOpen);
      return next;
    });
  }, []);

  const visibleSplits = useMemo(() => {
    const visible = new Map<string, TransactionAllocation[]>();
    if (allocationsByTransaction.size === 0) return visible;

    for (const transaction of transactions) {
      const id = transaction.id || '';
      const allocations = allocationsByTransaction.get(id) ?? [];
      if (allocations.length === 0) continue;

      const matched = allocations.filter((a) => matchedAllocationIds.has(a.id));
      const toggle = splitToggles.get(id);
      const open = toggle ?? matched.length > 0;
      if (!open) continue;
      // Manuell aufgeklappt zeigt IMMER die vollständige Aufteilung; die vom
      // Filter erzwungene Ansicht zeigt nur die passenden Anteile.
      visible.set(id, toggle === true || matched.length === 0 ? allocations : matched);
    }
    return visible;
  }, [transactions, allocationsByTransaction, matchedAllocationIds, splitToggles]);

  const groups = useMemo(
    () => buildDayGroups(transactions, endingBalance),
    [transactions, endingBalance],
  );
  const flatItems = useMemo(() => flattenDayGroups(groups, visibleSplits), [groups, visibleSplits]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualize = flatItems.length > VIRTUALIZE_THRESHOLD;

  // WP-6.6: Entscheidet, ob sich die Liste bei einem Filterwechsel sichtbar
  // umsortieren darf. Die Begruendung (`reason`) ist bewusst Teil des
  // Ergebnisses — sie macht in Tests und beim Nachlesen unterscheidbar, ob
  // gerade die Nutzereinstellung, die Virtualisierung oder die Menge greift.
  const motionQuality = useMotionQuality();
  const reorganization = planListReorganization({
    itemCount: flatItems.length,
    virtualized: virtualize,
    settings: motionQuality,
  });

  const virtualizer = useWindowVirtualizer({
    count: virtualize ? flatItems.length : 0,
    estimateSize: (index) => {
      const type = flatItems[index]?.type;
      if (type === 'heading') return HEADING_ESTIMATE_PX;
      return type === 'split' ? SPLIT_ROW_ESTIMATE_PX : ROW_ESTIMATE_PX;
    },
    overscan: 12,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  // withTopSpacing: nur der virtualisierte Pfad braucht den Tages-Abstand am
  // Heading selbst — im klassischen Pfad übernimmt das space-y-6 des Containers.
  const renderDayHeader = (group: DayGroup, withTopSpacing: boolean) => {
    const heading = formatDayHeading(group.key, now);
    const balanceLabel = money.mask(currencyFormatter.format(group.runningBalance));
    const deltaLabel = gentleModeEnabled ? '' : deltaFormatter.format(group.delta);
    // Tutorial-Anker nur am ERSTEN Tag: Die Fuehrung braucht ein eindeutiges
    // Ziel, und `document.querySelector` naehme ohnehin das erste.
    const isFirstDay = group.key === groups[0]?.key;

    return (
      <div
        data-tour-id={isFirstDay ? 'transactions-day-header' : undefined}
        className={cn('flex items-baseline justify-between gap-3 px-1 pb-1', withTopSpacing && 'pt-6')}
      >
        <h3 className="text-sm font-medium text-muted-foreground">{heading}</h3>
        {showRunningBalance && (
          <div
            data-tour-id={isFirstDay ? 'transactions-running-balance' : undefined}
            className="flex items-baseline gap-2 text-right tabular-nums"
          >
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
    const amountLabel = money.mask(currencyFormatter.format(transaction.amount));
    const payee = transaction.payee || transaction.description || '–';

    const leaf = categoriesById.get(transaction.subcategory_id || transaction.category_id || '');
    const avatarEmoji = leaf?.icon || null;
    const account = transaction.account_id ? accountsById.get(transaction.account_id) : undefined;

    const splitCount = (allocationsByTransaction.get(rowId) ?? []).length;
    const splitsOpen = visibleSplits.has(rowId);
    const isFirstRow = rowId !== '' && rowId === transactions[0]?.id;

    return (
      <div
        data-tour-id={isFirstRow ? 'transactions-first-row' : undefined}
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
            transaction.is_contract || splitCount > 0 ? (
              <>
                {transaction.is_contract && (
                  <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t('dashboard.contract')} />
                )}
                {splitCount > 0 && (
                  <SplitSquareHorizontal
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-label={t('transactions.splitBadge')}
                  />
                )}
              </>
            ) : undefined
          }
          value={amountLabel}
          valueTone={transaction.amount < 0 ? 'warning' : 'positive'}
          chevron={false}
          onClick={rowId ? () => onOpenDetails(transaction) : undefined}
          trailing={
            splitCount > 0 ? (
              <button
                type="button"
                aria-expanded={splitsOpen}
                aria-label={splitsOpen ? t('transactions.splitCollapse') : t('transactions.splitExpand')}
                onClick={() => toggleSplit(rowId, splitsOpen)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
                    splitsOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : undefined
          }
        />
      </div>
    );
  };

  /**
   * Anteil einer aufgeteilten Buchung: eingerückt, mit Baum-Marke, Kategorie
   * (plus Notiz, falls vorhanden) und dem Teilbetrag. Klick öffnet dieselbe
   * Buchung wie die Hauptzeile — die Aufteilung wird dort bearbeitet.
   */
  const renderSplitRow = (transaction: Transaction, allocation: TransactionAllocation, isLastSplit: boolean) => {
    const category = categoriesById.get(allocation.subcategory_id || allocation.category_id || '');
    const name = category?.name || t('transactions.splitUncategorized');
    const amountLabel = money.mask(currencyFormatter.format(toMajor(allocation.amount_minor)));

    return (
      <button
        type="button"
        onClick={transaction.id ? () => onOpenDetails(transaction) : undefined}
        className="flex min-h-[36px] w-full items-center gap-2 rounded-lg py-1 pl-6 pr-2 text-left hover:bg-muted/50"
      >
        <span aria-hidden="true" className="w-3 shrink-0 text-xs text-muted-foreground">
          {isLastSplit ? '└' : '├'}
        </span>
        {category?.icon && <span aria-hidden="true" className="shrink-0 text-sm">{category.icon}</span>}
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {name}
          {allocation.label && <span className="text-xs"> · {allocation.label}</span>}
        </span>
        <span
          className={cn(
            'shrink-0 text-sm tabular-nums',
            allocation.amount_minor < 0 ? 'text-warning' : 'text-positive',
          )}
        >
          {amountLabel}
        </span>
      </button>
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
              {item.type === 'heading' && renderDayHeader(item.group, virtualItem.index !== 0)}
              {item.type === 'row' && (
                <div className={cn(!item.isFirstRowOfDay && 'border-t border-border/70')}>
                  {renderTransactionRow(item.transaction)}
                </div>
              )}
              {item.type === 'split' && renderSplitRow(item.transaction, item.allocation, item.isLastSplit)}
            </div>
          );
        })}
      </div>
    );
  }

  // WP-6.6: Greift ein Filter, sortiert sich die Liste sichtbar um, statt neu
  // aufzupoppen — der Nutzer sieht, dass „die Aldi-Buchung noch da ist, nur
  // weiter oben". Das `layout`-Prop von Framer Motion misst Vorher/Nachher und
  // interpoliert dazwischen (FLIP); die Zuordnung laeuft ueber den React-Key,
  // also ueber die stabile Transaktions-ID und nicht ueber die Position.
  //
  // Ob ueberhaupt animiert wird, entscheidet `planListReorganization` — es gibt
  // drei Lagen, in denen es falsch waere (reduzierte Bewegung, Virtualisierung,
  // zu viele Elemente fuer die Bewegungsstufe des Geraets).
  const rowTransition = {
    duration: reorganization.durationMs / 1000,
    ease: MOTION_EASINGS_BEZIER.precision,
  };

  return (
    <div className="space-y-6">
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <motion.section
            key={group.key}
            layout={reorganization.animate}
            // `exit` nur, wenn ueberhaupt animiert wird: sonst haenge ein
            // weggefilterter Tag sichtbar nach, ohne dass etwas passiert.
            exit={reorganization.animate ? { opacity: 0 } : undefined}
            transition={rowTransition}
            className="space-y-1"
          >
            {renderDayHeader(group, false)}
            <ul className="divide-y divide-border/70">
              <AnimatePresence initial={false}>
                {group.items.map((transaction) => {
                  const splits = transaction.id ? visibleSplits.get(transaction.id) ?? [] : [];
                  return (
                    <motion.li
                      key={transaction.id || ''}
                      layout={reorganization.animate}
                      exit={reorganization.animate ? { opacity: 0 } : undefined}
                      transition={rowTransition}
                    >
                      {renderTransactionRow(transaction)}
                      {splits.map((allocation, index) => (
                        <div key={allocation.id}>
                          {renderSplitRow(transaction, allocation, index === splits.length - 1)}
                        </div>
                      ))}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}
