import { useMemo, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Transaction, Category, Account, Rhythmus } from '@/types';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { resolveAusgabenklasse } from '@/lib/analysis-data';

interface TransactionDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categories: Category[];
  accounts: Account[];
  onUpdate: (updates: Partial<Transaction>) => void;
  isLoading?: boolean;
}

const RHYTHM_OPTIONS: { value: Rhythmus; label: string }[] = [
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'quarterly', label: 'Vierteljährlich' },
  { value: 'yearly', label: 'Jährlich' },
];

export function TransactionDetailsModal({
  open,
  onOpenChange,
  transaction,
  categories,
  accounts,
  onUpdate,
  isLoading = false,
}: TransactionDetailsModalProps) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const account = transaction?.account_id ? accountsById.get(transaction.account_id) : null;
  const ausgabenklasse = transaction ? resolveAusgabenklasse(categoriesById, transaction.category_id) : null;

  const ausgabenklasseLabel = ausgabenklasse ? {
    essenziell: 'Essenziell',
    diskretionaer: 'Nicht-Essenziell',
    sparen: 'Sparen',
    einkommen: 'Einkommen',
  }[ausgabenklasse] : 'Unkategorisiert';

  if (!transaction) return null;

  const content = (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Transaktionsdetails</h3>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Datum</Label>
            <p className="font-medium">
              {format(parseISO(transaction.date), 'dd. MMMM yyyy', { locale: de })}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Betrag</Label>
            <p className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {transaction.amount > 0 ? '+' : ''}{transaction.amount.toFixed(2)} EUR
            </p>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Empfänger/Zahler</Label>
            <p className="font-medium">{transaction.payee || 'Unbekannt'}</p>
          </div>
          {account && (
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Konto</Label>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: account.color }}
                  aria-hidden="true"
                />
                <span aria-hidden="true">{account.icon}</span>
                <span className="font-medium">{account.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Kategorisierung</h3>

        <div>
          <Label htmlFor="category-select" className="text-xs text-muted-foreground">Kategorie</Label>
          <CategoryTwoStepSelect
            categories={categories}
            value={transaction.subcategory_id || transaction.category_id || ''}
            onChange={(selectedId) => {
              const selectedCat = categoriesById.get(selectedId);
              if (!selectedCat) {
                onUpdate({ category_id: undefined, subcategory_id: undefined });
                return;
              }
              if (selectedCat.parent_id) {
                onUpdate({ category_id: selectedCat.parent_id, subcategory_id: selectedId });
              } else {
                onUpdate({ category_id: selectedId, subcategory_id: undefined });
              }
            }}
            disabled={isLoading}
          />
        </div>

        <div className="pt-2">
          <Label className="text-xs text-muted-foreground">Ausgabenklasse</Label>
          <Badge variant={ausgabenklasse ? 'default' : 'secondary'} className="mt-1">
            {ausgabenklasseLabel}
          </Badge>
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Vertragsinformationen</h3>

        <div className="flex items-center gap-2">
          <Checkbox
            id="is-contract"
            checked={transaction.is_contract || false}
            onCheckedChange={(checked) => {
              onUpdate({ is_contract: checked === true });
            }}
            disabled={isLoading}
          />
          <Label htmlFor="is-contract" className="text-sm cursor-pointer font-normal">
            Dies ist ein Vertrag/Abonnement
          </Label>
        </div>

        {transaction.is_contract && (
          <div>
            <Label htmlFor="cycle-select" className="text-xs text-muted-foreground">
              Zahlungszyklus
            </Label>
            <Select
              value={transaction.contract_cycle || ''}
              onValueChange={(value) => {
                onUpdate({ contract_cycle: (value as Rhythmus) || null });
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="cycle-select" className="mt-1">
                <SelectValue placeholder="Zyklus wählen..." />
              </SelectTrigger>
              <SelectContent>
                {RHYTHM_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaktionsdetails</DialogTitle>
          </DialogHeader>
          {content}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-lg">
        <SheetHeader className="mb-4">
          <SheetTitle>Transaktionsdetails</SheetTitle>
        </SheetHeader>
        {content}
        <SheetFooter className="gap-2 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Speichern
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
