import type { Transaction } from '@/types';

/**
 * Interaktions-Props, die die Page besitzt (Dialog-/Auswahlzustand) und 1:1 an
 * Desktop- und Mobile-View durchreicht. Fachzustand kommt vollständig aus
 * `model` (`TransactionsOverviewViewModel`) — hier nur das, was
 * `TransactionsPage` als eigenen State hält (Verhaltensreferenz:
 * `src/pages/TransactionsPage.tsx`, `openDetails`/`closeDetails`).
 */
export interface TransactionsViewInteractionProps {
  /** Aktuell im Detail geöffnete Buchung (Page-State) — `null` = nichts ausgewählt. */
  detailsTransaction: Transaction | null;
  /** Buchung öffnen: Desktop inline im Panel, Mobile als Bottom-Sheet/Dialog (Page-`openDetails`, `setDetailsOpen(!isWide)`). */
  onOpenDetails: (transaction: Transaction) => void;
  /**
   * Persistiert das Minimal-Diff der Detailbearbeitung — 1:1 Signatur von
   * `TransactionDetailsPanelProps['onSave']` bzw. `TransactionDetailsModal`s
   * `onSave`. Die Page bindet dabei intern `detailsTransaction` als erstes
   * Argument von `useTransactionDetailEditing().save` an.
   */
  onSaveDetails: (
    id: string,
    patch: Partial<Transaction>,
    options: { applyToSimilar: boolean; similarIds: string[] },
  ) => void;
}
