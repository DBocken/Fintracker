import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, SplitSquareHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import { CategoryTwoStepSelect } from '@/components/categories/CategoryTwoStepSelect';
import { showError, showSuccess } from '@/utils/toast';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import { toMinor, sumMinor, type Cents } from '@/lib/money';
import {
  parseSplitAmount,
  openSplitMinor,
  formatSplitAmountInput,
} from '@/lib/split-amounts';
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const totalMinor = toMinor(transaction.amount);

  const txId = transaction.id ?? '';

  const {
    data: savedAllocations = [],
    isError: allocationsError,
    refetch: refetchAllocations,
  } = useQuery({
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
          amountEur: formatSplitAmountInput(a.amount_minor),
          categoryId: a.category_id,
          subcategoryId: a.subcategory_id ?? null,
          label: a.label ?? '',
        })),
      );
      setInitialized(true);
    }
  }, [savedAllocations, initialized]);

  // Der Nutzer tippt nur Beträge — das Vorzeichen kommt aus der Buchung
  // (`parseSplitAmount`). `openMinor` ist richtungsnormiert: > 0 offen,
  // < 0 zu viel zugewiesen (siehe `@/lib/split-amounts`).
  const rowMinor = (row: SplitRow) => parseSplitAmount(row.amountEur, totalMinor);
  // `parseSplitAmount`/`AllocationInput.amount_minor` bleiben bewusst `number`
  // (kein Cents-Brand, WP 5.1/DOM-1 — siehe Kommentar an
  // `TransactionAllocation.amount_minor` in @/types); hier ist der Wert
  // nachweislich bereits cent-genau.
  const allocatedMinor = sumMinor(rows.map((r) => rowMinor(r) as Cents));
  const openMinor = openSplitMinor(totalMinor, allocatedMinor);
  const isBalanced = openMinor === 0;

  const validation = validateAllocations(
    { id: txId, amount: transaction.amount },
    rows
      .filter((r) => rowMinor(r) !== 0)
      .map((r) => ({
        id: r.key,
        transaction_id: txId,
        amount_minor: rowMinor(r),
        category_id: r.categoryId,
        source: 'manual' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const inputs: AllocationInput[] = rows
        .filter((r) => rowMinor(r) !== 0)
        .map((r) => ({
          amount_minor: rowMinor(r),
          category_id: r.categoryId,
          subcategory_id: r.subcategoryId,
          label: r.label || null,
          source: 'manual' as const,
        }));
      await setAllocations({ id: txId, amount: transaction.amount }, inputs);
    },
    onSuccess: () => {
      showSuccess(t("transactionSplit.saveSplitSuccess"));
      // Wurzel-Key statt ['allocations', txId]: die Buchungssuche cached die
      // Aufteilungen aller Buchungen als Map (Split-Notizen sind durchsuchbar)
      // und muss nach dem Speichern ebenfalls neu laden.
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
    },
    onError: (err) => {
      showError(err instanceof Error ? err.message : t("transactionSplit.saveSplitError"));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearAllocations(txId),
    onSuccess: () => {
      showSuccess(t("transactionSplit.saveSplitSuccess"));
      setRows([newRow(), newRow()]);
      setInitialized(false);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
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

  /**
   * „Rest hier eintragen": setzt die Zeile auf ihren eigenen Betrag PLUS den
   * offenen Rest — die Zeile schließt die Aufteilung damit exakt ab, statt
   * ihren bisherigen Wert zu verlieren. Immer als vorzeichenlose Magnitude.
   */
  const distributeRemaining = (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    // Bei Überzuweisung (openMinor < 0) nimmt die Zeile den Überhang zurück —
    // höchstens bis auf 0, sonst kippte sie ins Negative.
    const filledMinor = Math.max(0, Math.abs(rowMinor(row)) + openMinor);
    updateRow(key, { amountEur: formatSplitAmountInput(filledMinor) });
  };

  const isSaved = savedAllocations.length > 0;

  if (allocationsError) return <FinanceErrorState variant="data" onRetry={() => void refetchAllocations()} />;

  return (
    <div data-tour-id="split-panel" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SplitSquareHorizontal className="h-4 w-4" />
          {t("transactionSplit.title")}
          {isSaved && <Badge variant="secondary" className="text-xs">{t("transactionSplit.saved")}</Badge>}
        </div>
        {isSaved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            {t("transactionSplit.removeButton")}
          </Button>
        )}
      </div>

      <div data-tour-id="split-remaining" className="text-xs text-muted-foreground">
        {t("transactionSplit.totalLabel")} <span className="font-mono font-semibold">{formatSplitAmountInput(totalMinor)} €</span>
        {!isBalanced && (
          <span className="ml-2 text-warning">
            · {t("transactionSplit.remaining").replace('{amount}', formatSplitAmountInput(openMinor)).replace('{status}', openMinor > 0 ? t("transactionSplit.remainingOpen") : t("transactionSplit.remainingOverpaid"))}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            data-tour-id={idx === 0 ? 'split-row' : undefined}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5"
          >
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
              {openMinor !== 0 && (
                <button
                  type="button"
                  data-tour-id={idx === 0 ? 'split-fill-remaining' : undefined}
                  onClick={() => distributeRemaining(row.key)}
                  className="text-xs text-brand hover:underline"
                  title={t("transactionSplit.fillRemainingTitle")}
                >
                  ={formatSplitAmountInput(openMinor)}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 2}
                className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-30"
                aria-label={t("transactionSplit.removeRowLabel")}
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
              placeholder={t("transactionSplit.categoryPlaceholder")}
              className="h-8 text-sm"
            />
            <Input
              type="text"
              placeholder={t("transactionSplit.notesPlaceholder")}
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
        data-tour-id="split-add-row"
        onClick={addRow}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {t("transactionSplit.addRowButton")}
      </Button>

      {!isBalanced && allocatedMinor !== 0 && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertDescription>
            {openMinor > 0
              ? t("transactionSplit.remainingNotAssigned").replace('{amount}', formatSplitAmountInput(openMinor))
              : t("transactionSplit.remainingOverassigned").replace('{amount}', formatSplitAmountInput(openMinor))}
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="sm"
        className="w-full"
        data-tour-id="split-save"
        disabled={!isBalanced || saveMutation.isPending || !validation.valid}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? t("transactionSplit.saveButtonPending") : t("transactionSplit.saveButton")}
      </Button>
    </div>
  );
}
