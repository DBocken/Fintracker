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
  /** Persistiert das Minimal-Diff der bearbeiteten Felder. */
  onSave: (id: string, patch: Partial<Transaction>) => void;
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

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Bearbeitbarer Entwurf; wird bei jedem Öffnen aus der Transaktion neu gesetzt.
  const [draft, setDraft] = useState<TransactionDetailDraft | null>(null);

  useEffect(() => {
    if (transaction && open) {
      setDraft(draftFromTransaction(transaction));
    }
  }, [transaction, open]);

  if (!transaction || !draft) return null;

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
      onSave(transaction.id, patch);
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
