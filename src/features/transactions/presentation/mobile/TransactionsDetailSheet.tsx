import type { ReactNode } from 'react';
import { TransactionDetailsModal } from '@/components/dashboard/TransactionDetailsModal';
import type { Transaction } from '@/types';
import type { TransactionsOverviewViewModel } from '../../application/transactions-overview-view-model';
import type { TransactionsViewInteractionProps } from '../transactions-view-props';

interface Props extends Pick<TransactionsViewInteractionProps, 'detailsTransaction' | 'onSaveDetails'> {
  model: TransactionsOverviewViewModel;
  /** Overlay-Sichtbarkeit (Page-State `detailsOpen`). */
  detailsOpen: boolean;
  /** 1:1 an `TransactionDetailsModal.onOpenChange` (Page-`(open) => (open ? setDetailsOpen(true) : closeDetails())`). */
  onDetailsOpenChange: (open: boolean) => void;
  /** Optionaler Zusatzbereich unter dem Detail (z. B. Anlass-Zuordnung) — von der Page komponiert. */
  renderDetailExtra?: (transaction: Transaction) => ReactNode;
}

/**
 * Mobile: Detail als Overlay statt angedockte Spalte (Verhaltensreferenz:
 * `TransactionsPage.tsx`, ehem. gemeinsamer Zweig + `TransactionDetailsModal`
 * am Seitenende). Reiner Wrapper um `TransactionDetailsModal` — die Liste
 * (`TransactionsListPane`) mountet unabhängig davon immer. Die interne
 * 768px-Dialog/Sheet-Weiche steckt bereits in `TransactionDetailsModal` und
 * bleibt unangetastet.
 */
export function TransactionsDetailSheet({
  model,
  detailsTransaction,
  onSaveDetails,
  detailsOpen,
  onDetailsOpenChange,
  renderDetailExtra,
}: Props) {
  return (
    <TransactionDetailsModal
      open={detailsOpen}
      onOpenChange={onDetailsOpenChange}
      transaction={detailsTransaction}
      categories={model.categories}
      accounts={model.accounts}
      allTransactions={model.transactions.all}
      onSave={onSaveDetails}
      onToggleVisibility={model.hidden.toggle}
      onDelete={model.actions.deleteTransaction}
      isHidden={detailsTransaction?.id ? model.hidden.ids.has(detailsTransaction.id) : false}
      isLoading={model.actions.detailsSaving}
      extra={detailsTransaction ? renderDetailExtra?.(detailsTransaction) : undefined}
    />
  );
}

export default TransactionsDetailSheet;
