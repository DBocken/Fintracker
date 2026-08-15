import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useI18n } from '@/i18n/useI18n';
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
  /** Optionaler Zusatzbereich unter dem Detail (z. B. Anlass-Zuordnung). */
  extra?: ReactNode;
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
  extra,
}: TransactionDetailsModalProps) {
  const { t } = useI18n();
  const [isDesktop, setIsDesktop] = useState(true);

  // Bewusst 768px (md) statt useIsWideDesktop (1024px/lg): Diese Weiche wählt Dialog vs.
  // Bottom-Sheet INNERHALB des Overlays; der Master-Detail-Split der Seite liegt bei lg.
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!transaction) return null;

  // Ein von der Tutorial-Führung selbst geöffneter Dialog/Sheet
  // (`transactionDetails.panel`/`transactionSplit.why`, `openAnchor`) sitzt
  // NEBEN dem eigenen, freischwebenden Steuerungs-Popover der Führung
  // (`TutorialOverlay`) — ein zweites, separates Radix-Portal. Ohne diese
  // Ausnahme hält Radix jeden Klick dort für „außerhalb" und schließt zuerst
  // NUR den Dialog, statt den Klick durchzulassen: „Weiter" bräuchte dann
  // immer zwei Klicks, der erste zum Schließen, erst der zweite träfe den
  // Knopf. `data-tutorial-controls` markiert genau diesen Popover
  // (`TutorialOverlay`); alle anderen Außenklicks schließen wie gewohnt.
  const allowTutorialInteraction = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    if ((event.target as HTMLElement | null)?.closest('[data-tutorial-controls]')) {
      event.preventDefault();
    }
  };

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
      closeLabel={t('common.cancel')}
      layout={layout}
    />
  );

  if (isDesktop) {
    // Breiter, horizontaler Dialog: Stammdaten links (1/3), Bearbeitung rechts (2/3).
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto scrollbar-subtle sm:max-w-5xl"
          aria-describedby={undefined}
          onInteractOutside={allowTutorialInteraction}
        >
          <DialogHeader>
            <DialogTitle>{t('dashboard.transactionDetailsTitle')}</DialogTitle>
          </DialogHeader>
          {panel('split')}
          {extra}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto scrollbar-subtle rounded-t-lg"
        // Bewusst ohne Beschreibung — und zwar dieselbe Entscheidung wie im
        // Desktop-Zweig zwölf Zeilen darüber: Beide zeigen exakt denselben
        // Inhalt (`TransactionDetailsPanel`). Eine Beschreibung nur auf einer
        // der beiden Breiten wäre ein Paritätsbruch (AGENTS.md §4) — dieselben
        // Daten, aber eine andere Auskunft je nach Bildschirm.
        aria-describedby={undefined}
        onInteractOutside={allowTutorialInteraction}
      >
        <SheetHeader className="mb-2">
          <SheetTitle className="text-left">{t('dashboard.transactionDetailsTitle')}</SheetTitle>
        </SheetHeader>
        {panel('stacked')}
        {extra}
      </SheetContent>
    </Sheet>
  );
}
