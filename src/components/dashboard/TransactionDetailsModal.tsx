import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TransactionDetailsPanel } from './TransactionDetailsPanel';
import type { Transaction, Category, Account } from '@/types';

interface TransactionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categories: Category[];
  accounts: Account[];
  allTransactions?: Transaction[];
  onSave: (
    id: string,
    patch: Partial<Transaction>,
    options: { applyToSimilar: boolean; similarIds: string[] },
  ) => void;
  onToggleVisibility?: (id: string) => void;
  onDelete?: (id: string) => void;
  isHidden?: boolean;
  isLoading?: boolean;
}

/**
 * Transaktionsdetails als Overlay: Dialog auf Desktop, Bottom-Sheet auf Mobil.
 * Der Inhalt lebt in `TransactionDetailsPanel`, damit dieselbe Ansicht auf der
 * Buchungsseite auch inline (als Detail-Spalte) verwendet werden kann.
 */
export function TransactionDetailsModal({
  open,
  onOpenChange,
  transaction,
  categories,
  accounts,
  allTransactions = [],
  onSave,
  onToggleVisibility,
  onDelete,
  isHidden = false,
  isLoading = false,
}: TransactionDetailsModalProps) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!transaction) return null;

  const panel = (layout: 'stacked' | 'split') => (
    <TransactionDetailsPanel
      transaction={transaction}
      categories={categories}
      accounts={accounts}
      allTransactions={allTransactions}
      onSave={onSave}
      onToggleVisibility={onToggleVisibility}
      onDelete={onDelete}
      isHidden={isHidden}
      isLoading={isLoading}
      onClose={() => onOpenChange(false)}
      closeLabel="Abbrechen"
      layout={layout}
    />
  );

  if (isDesktop) {
    // Breiter, horizontaler Dialog: Stammdaten links (1/3), Bearbeitung rechts (2/3).
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto scrollbar-subtle sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Transaktionsdetails</DialogTitle>
          </DialogHeader>
          {panel('split')}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto scrollbar-subtle rounded-t-lg">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-left">Transaktionsdetails</SheetTitle>
        </SheetHeader>
        {panel('stacked')}
      </SheetContent>
    </Sheet>
  );
}
