import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, SplitSquareHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { showError, showSuccess } from '@/utils/toast';
import { toMinor, toMajor, sumMinor } from '@/lib/money';
import {
  getAllocationsForTransaction,
  setAllocations,
  clearAllocations,
  validateAllocations,
  type AllocationInput,
} from '@/services/transaction-allocation-service';
import type { Transaction, Category } from '@/types';

interface TransactionSplitPanelProps {
  transaction: Transaction;
  categories: Category[];
}

interface SplitRow {
  key: string;
  amountEur: string;
  categoryId: string | null;
  subcategoryId: string | null;
  label: string;
}

function newRow(): SplitRow {
  return { key: crypto.randomUUID(), amountEur: '', categoryId: null, subcategoryId: null, label: '' };
}

export function TransactionSplitPanel({ transaction, categories }: TransactionSplitPanelProps) {
  const queryClient = useQueryClient();
  const totalMinor = toMinor(transaction.amount);

  const txId = transaction.id ?? '';

  const { data: savedAllocations = [] } = useQuery({
    queryKey: ['allocations', txId],
    queryFn: () => getAllocationsForTransaction(txId),
    enabled: !!txId,
  });

  const [rows, setRows] = useState<SplitRow[]>([newRow(), newRow()]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (savedAllocations.length > 0) {
      setRows(
        savedAllocations.map((a) => ({
          key: a.id,
          amountEur: toMajor(a.amount_minor).toFixed(2),
          categoryId: a.category_id,
          subcategoryId: a.subcategory_id ?? null,
          label: a.label ?? '',
        })),
      );
      setInitialized(true);
    }
  }, [savedAllocations, initialized]);

  const allocatedMinor = sumMinor(
    rows.map((r) => {
      const v = parseFloat(r.amountEur.replace(',', '.'));
      return isNaN(v) ? 0 : toMinor(v);
    }),
  );
  const remainingMinor = totalMinor - allocatedMinor;
  const isBalanced = remainingMinor === 0;

  const validation = validateAllocations(
    { id: txId, amount: transaction.amount },
    rows
      .filter((r) => r.amountEur !== '' && !isNaN(parseFloat(r.amountEur.replace(',', '.'))))
      .map((r) => ({
        id: r.key,
        transaction_id: txId,
        amount_minor: toMinor(parseFloat(r.amountEur.replace(',', '.'))),
        category_id: r.categoryId,
        source: 'manual' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const inputs: AllocationInput[] = rows
        .filter((r) => r.amountEur !== '' && !isNaN(parseFloat(r.amountEur.replace(',', '.'))))
        .map((r) => ({
          amount_minor: toMinor(parseFloat(r.amountEur.replace(',', '.'))),
          category_id: r.categoryId,
          subcategory_id: r.subcategoryId,
          label: r.label || null,
          source: 'manual' as const,
        }));
      await setAllocations({ id: txId, amount: transaction.amount }, inputs);
    },
    onSuccess: () => {
      showSuccess('Aufteilung gespeichert');
      queryClient.invalidateQueries({ queryKey: ['allocations', txId] });
    },
    onError: (err) => {
      showError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearAllocations(txId),
    onSuccess: () => {
      showSuccess('Aufteilung entfernt');
      setRows([newRow(), newRow()]);
      setInitialized(false);
      queryClient.invalidateQueries({ queryKey: ['allocations', txId] });
    },
  });

  const updateRow = (key: string, patch: Partial<SplitRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (key: string) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const distributeRemaining = (key: string) => {
    const sign = totalMinor < 0 ? -1 : 1;
    const absRemaining = Math.abs(remainingMinor);
    const euros = (sign * absRemaining) / 100;
    updateRow(key, { amountEur: euros.toFixed(2) });
  };

  const isSaved = savedAllocations.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SplitSquareHorizontal className="h-4 w-4" />
          Buchung aufteilen
          {isSaved && <Badge variant="secondary" className="text-xs">gespeichert</Badge>}
        </div>
        {isSaved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            Aufteilung entfernen
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Gesamtbetrag: <span className="font-mono font-semibold">{toMajor(Math.abs(totalMinor)).toFixed(2)} €</span>
        {!isBalanced && (
          <span className={`ml-2 ${remainingMinor !== 0 ? 'text-warning' : ''}`}>
            · noch {toMajor(Math.abs(remainingMinor)).toFixed(2)} € {remainingMinor > 0 ? 'offen' : 'zu viel'}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.key} className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="flex items-center gap-2">
              <Label className="w-4 shrink-0 text-xs text-muted-foreground">{idx + 1}.</Label>
              <div className="relative w-28 shrink-0">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={row.amountEur}
                  onChange={(e) => updateRow(row.key, { amountEur: e.target.value })}
                  className="h-8 pr-5 text-sm font-mono"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
              </div>
              {remainingMinor !== 0 && (
                <button
                  type="button"
                  onClick={() => distributeRemaining(row.key)}
                  className="text-xs text-brand hover:underline"
                  title="Rest hier eintragen"
                >
                  ={toMajor(Math.abs(remainingMinor)).toFixed(2)}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 2}
                className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-30"
                aria-label="Zeile entfernen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <CategoryTwoStepSelect
              categories={categories}
              value={row.subcategoryId ?? row.categoryId ?? ''}
              onChange={(val) => {
                const cat = categories.find((c) => c.id === val);
                const isTop = !cat?.parent_id;
                updateRow(row.key, {
                  categoryId: isTop ? val : (cat?.parent_id ?? null),
                  subcategoryId: isTop ? null : val,
                });
              }}
              placeholder="Kategorie wählen…"
              className="h-8 text-sm"
            />
            <Input
              type="text"
              placeholder="Notiz (optional)"
              value={row.label}
              onChange={(e) => updateRow(row.key, { label: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full border border-dashed border-border text-xs"
        onClick={addRow}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Zeile hinzufügen
      </Button>

      {!isBalanced && allocatedMinor !== 0 && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertDescription>
            {remainingMinor > 0
              ? `Noch ${toMajor(remainingMinor).toFixed(2)} € nicht zugewiesen.`
              : `${toMajor(Math.abs(remainingMinor)).toFixed(2)} € zu viel zugewiesen.`}
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={!isBalanced || saveMutation.isPending || !validation.valid}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? 'Speichern…' : 'Aufteilung speichern'}
      </Button>
    </div>
  );
}
