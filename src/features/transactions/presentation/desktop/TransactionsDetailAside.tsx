import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionDetailsPanel } from '@/components/dashboard/TransactionDetailsPanel';
import { useI18n } from '@/i18n/useI18n';
import type { Transaction } from '@/types';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import type { TransactionsViewInteractionProps } from '../transactions-view-props';

interface Props extends Pick<TransactionsViewInteractionProps, 'detailsTransaction' | 'onSaveDetails'> {
  model: TransactionsOverviewViewModel;
  /** Detail schließen (Desktop-Panel-X-Button, Page-`closeDetails`) — nur Desktop hat einen dedizierten Schließen-Button. */
  onCloseDetails: () => void;
  /** Optionaler Zusatzbereich unter dem Detail (z. B. Anlass-Zuordnung) — von der Page komponiert. */
  renderDetailExtra?: (transaction: Transaction) => ReactNode;
}

/**
 * Desktop: sticky angedockte Detail-Spalte, rechts neben der immer
 * gemounteten `TransactionsListPane` (Verhaltensreferenz:
 * `TransactionsPage.tsx` ehem. Z. 292–409, `lg:`-Zweig). Horizontal 1/3 · 2/3
 * statt Overlay. Rendert nur, solange die Page `isWide` meldet — die
 * ehemalige CSS-Weiche `hidden lg:block` entfällt, weil die Page das jetzt
 * per JS steuert (Details: `src/features/transactions/README.md`).
 */
export function TransactionsDetailAside({ model, detailsTransaction, onCloseDetails, onSaveDetails, renderDetailExtra }: Props) {
  const { t } = useI18n();

  return (
    <aside className="lg:min-w-0">
      <div className="lg:sticky lg:top-4">
        {detailsTransaction ? (
          <div>
            <div className="mb-3 flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-semibold">{t('dashboard.transactionDetailsTitle')}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 fokussiert:min-h-11 fokussiert:min-w-11"
                aria-label={t('dashboard.closeDetailsAriaLabel')}
                onClick={onCloseDetails}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="scrollbar-subtle lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
              <TransactionDetailsPanel
                transaction={detailsTransaction}
                categories={model.categories}
                accounts={model.accounts}
                allTransactions={model.transactions.all}
                onSave={onSaveDetails}
                onToggleVisibility={model.hidden.toggle}
                onDelete={model.actions.deleteTransaction}
                isHidden={detailsTransaction.id ? model.hidden.ids.has(detailsTransaction.id) : false}
                isLoading={model.actions.detailsSaving}
                onClose={onCloseDetails}
                closeLabel={t('common.close')}
                layout="split"
              />
              {renderDetailExtra?.(detailsTransaction)}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t('dashboard.selectTransactionHint')}
          </div>
        )}
      </div>
    </aside>
  );
}

export default TransactionsDetailAside;
