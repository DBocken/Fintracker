import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Category, Account, Rhythmus } from '@/types';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { resolveAusgabenklasse } from '@/lib/analysis-data';
import { TransactionSplitPanel } from '@/components/transactions/TransactionSplitPanel';
import { Users } from 'lucide-react';
import { findSimilarTransactions, fingerprintReasonLabel } from '@/lib/merchant-fingerprint';
import {
  RHYTHMUS_OPTIONS,
  ausgabenklasseLabel,
  currentCategoryValue,
  diffTransactionDraft,
  draftFromTransaction,
  resolveCategorySelection,
  type TransactionDetailDraft,
} from './transaction-details';

interface TransactionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categories: Category[];
  accounts: Account[];
  /** Gesamtbestand, um gleichartige Buchungen (Familie) zu finden. */
  allTransactions?: Transaction[];
  /**
   * Persistiert das Minimal-Diff der bearbeiteten Felder. `options.applyToSimilar`
   * gibt an, ob die Änderung auf die übrigen Buchungen der Familie übertragen wird.
   */
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

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

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
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Bearbeitbarer Entwurf; wird bei jedem Öffnen aus der Transaktion neu gesetzt.
  const [draft, setDraft] = useState<TransactionDetailDraft | null>(null);

  useEffect(() => {
    if (transaction && open) {
      setDraft(draftFromTransaction(transaction));
      setApplyToSimilar(true);
    }
  }, [transaction, open]);

  // Gleichartige Buchungen (Familie) für die Sammeländerung bestimmen.
  const similar = useMemo(() => {
    if (!transaction) return { exact: [], probable: [], reason: 'merchant' as const };
    return findSimilarTransactions(transaction, allTransactions);
  }, [transaction, allTransactions]);

  if (!transaction || !draft) return null;

  const similarIds = similar.exact.map((t) => t.id!).filter(Boolean);
  const similarCount = similarIds.length;

  const account = transaction.account_id ? accountsById.get(transaction.account_id) : null;
  // Ausgabenklasse aus dem Entwurf ableiten, damit sie live auf Kategorie-Wechsel reagiert.
  const ausgabenklasse = resolveAusgabenklasse(
    categoriesById,
    draft.subcategory_id || draft.category_id
  );

  const handleCategoryChange = (selectedId: string) => {
    const { category_id, subcategory_id } = resolveCategorySelection(categoriesById, selectedId);
    setDraft((d) => (d ? { ...d, category_id, subcategory_id } : d));
  };

  const handleSave = () => {
    const patch = diffTransactionDraft(transaction, draft);
    if (Object.keys(patch).length > 0 && transaction.id) {
      onSave(transaction.id, patch, {
        applyToSimilar: applyToSimilar && similarCount > 0,
        similarIds,
      });
    } else {
      onOpenChange(false);
    }
  };

  const content = (
    <div className="space-y-4 py-2">
      {/* Stammdaten (read-only) */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-xs text-muted-foreground">Datum</Label>
          <p className="font-medium">{format(parseISO(transaction.date), 'dd. MMMM yyyy', { locale: de })}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Betrag</Label>
          <p className={`font-medium tabular-nums ${transaction.amount < 0 ? 'text-warning' : 'text-positive'}`}>
            {currencyFormatter.format(transaction.amount)}
          </p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Empfänger/Zahler</Label>
          <p className="font-medium">{transaction.payee || 'Unbekannt'}</p>
        </div>
        {transaction.description && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm">{transaction.description}</p>
          </div>
        )}
        {transaction.counterparty_iban && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Empfänger-IBAN</Label>
            <p className="font-medium tabular-nums break-all">{transaction.counterparty_iban}</p>
          </div>
        )}
        {account && (
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Konto</Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color }} aria-hidden="true" />
              <span aria-hidden="true">{account.icon}</span>
              <span className="font-medium">{account.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Kategorisierung */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Kategorisierung</h3>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Kategorie</Label>
          <CategoryTwoStepSelect
            categories={categories}
            value={currentCategoryValue(draft)}
            disabled={isLoading}
            onChange={handleCategoryChange}
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground">Ausgabenklasse</span>
          <Badge variant={ausgabenklasse ? 'default' : 'secondary'}>{ausgabenklasseLabel(ausgabenklasse)}</Badge>
        </div>
      </div>

      {/* Sammeländerung: auf gleichartige Buchungen anwenden */}
      {similarCount > 0 && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="apply-similar"
              checked={applyToSimilar}
              disabled={isLoading}
              onCheckedChange={(checked) => setApplyToSimilar(checked === true)}
            />
            <div className="flex-1">
              <Label htmlFor="apply-similar" className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4" aria-hidden="true" />
                Auf ähnliche Transaktionen anwenden
              </Label>
              <p className="text-xs text-muted-foreground">
                {similarCount} passende Buchung{similarCount === 1 ? '' : 'en'} werden mitgeändert.
                {similar.probable.length > 0 && ` (${similar.probable.length} wahrscheinliche ausgenommen)`}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Warum gruppiert? {fingerprintReasonLabel(similar.reason)}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aufteilung auf mehrere Kategorien */}
      <div className="border-t pt-4">
        <TransactionSplitPanel transaction={transaction} categories={categories} />
      </div>

      {/* Vertragsinformationen */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Vertrag</h3>
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-contract"
            checked={draft.is_contract}
            disabled={isLoading}
            onCheckedChange={(checked) =>
              setDraft((d) => (d ? { ...d, is_contract: checked === true } : d))
            }
          />
          <Label htmlFor="is-contract" className="cursor-pointer text-sm font-normal">
            Dies ist ein Vertrag/Abonnement
          </Label>
        </div>

        {draft.is_contract && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-select" className="text-xs text-muted-foreground">
              Zahlungszyklus
            </Label>
            <Select
              value={draft.contract_cycle ?? ''}
              disabled={isLoading}
              onValueChange={(value) =>
                setDraft((d) => (d ? { ...d, contract_cycle: (value as Rhythmus) || null } : d))
              }
            >
              <SelectTrigger id="cycle-select">
                <SelectValue placeholder="Zyklus wählen…" />
              </SelectTrigger>
              <SelectContent>
                {RHYTHMUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Aktionen: Sichtbarkeit & Löschen */}
      {(onToggleVisibility || onDelete) && (
        <div className="flex gap-2 border-t pt-4">
          {onToggleVisibility && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isLoading || !transaction.id}
              onClick={() => transaction.id && onToggleVisibility(transaction.id)}
            >
              {isHidden ? (
                <><Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Einblenden</>
              ) : (
                <><EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> Ausblenden</>
              )}
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-warning hover:text-warning"
              disabled={isLoading || !transaction.id}
              onClick={() => {
                if (transaction.id) onDelete(transaction.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Löschen
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
        Abbrechen
      </Button>
      <Button onClick={handleSave} disabled={isLoading}>
        Speichern
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaktionsdetails</DialogTitle>
          </DialogHeader>
          {content}
          <DialogFooter className="gap-2">{footerButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-lg">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-left">Transaktionsdetails</SheetTitle>
        </SheetHeader>
        {content}
        <SheetFooter className="mt-4 gap-2 border-t pt-4">{footerButtons}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
