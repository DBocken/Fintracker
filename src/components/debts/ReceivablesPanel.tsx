import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, MoreVertical, Sparkles } from "lucide-react";
import EmptyState from "@/features/shared/presentation/EmptyState";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { InfoStatStrip } from "@/features/shared/presentation/InfoGroup";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from "@/utils/toast";
import { ReceivableFormDialog } from "@/components/debts/ReceivableFormDialog";
import type { Receivable, Transaction } from "@/types";
import type { TransactionId } from "@/lib/ids";
import { getAllTransactions } from "@/services/transaction-service";
import {
  getReceivables,
  createReceivable,
  updateReceivable,
  deleteReceivable,
  getTotalReceivables,
  getReceivableTransactionAssignments,
  assignTransactionToReceivable,
  unassignReceivableTransaction,
  suggestReceivableRepayments,
  getReceivableTypeLabels,
  RECEIVABLE_TYPE_ICONS,
  type ReceivableTransactionAssignment,
} from "@/services/receivable-service";
import { useI18n } from "@/i18n/useI18n";
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { financeKeys } from '@/features/shared/data/finance-query-keys';

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ReceivablesPanel() {
  const money = useMoneyFormat();
  const { t, locale } = useI18n();
  const receivableTypeLabels = getReceivableTypeLabels();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Receivable> | null>(null);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>("");

  const {
    data: receivables = [],
    isLoading,
    isError: receivablesError,
    refetch: refetchReceivables,
  } = useQuery({
    queryKey: ["receivables"],
    queryFn: getReceivables,
  });

  const {
    data: transactions = [],
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery<Transaction[]>({
    queryKey: ["transactions", "receivable-assignment"],
    // `suggestReceivableRepayments` sucht die passende Rückzahlung im ganzen
    // Bestand; auf 500 Buchungen beschnitten schlägt sie ältere nie vor.
    queryFn: getAllTransactions,
    enabled: receivables.length > 0,
  });

  const {
    data: assignments = [],
    isError: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery<ReceivableTransactionAssignment[]>({
    queryKey: ["receivable-transaction-assignments"],
    queryFn: getReceivableTransactionAssignments,
    enabled: receivables.length > 0,
  });

  const hasLoadError = receivablesError || transactionsError || assignmentsError;
  const retryAll = () => {
    void refetchReceivables();
    void refetchTransactions();
    void refetchAssignments();
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["receivables"] });
    queryClient.invalidateQueries({ queryKey: ["receivable-transaction-assignments"] });
    queryClient.invalidateQueries({ queryKey: financeKeys.netWorth });
    queryClient.invalidateQueries({ queryKey: ["financial-health"] });
    queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
  };

  const createMutation = useMutation({
    mutationFn: createReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debtService.receivableAdded"));
      setDialogOpen(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debtService.receivableUpdated"));
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => showError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debtService.receivableDeleted"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: assignTransactionToReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debtService.repaymentAssigned"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignReceivableTransaction,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debtService.assignmentRemoved"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const totalReceivables = getTotalReceivables(receivables);
  const openCount = receivables.filter((r) => !r.is_settled).length;

  const currentReceivableId =
    selectedReceivableId || receivables.find((r) => !r.is_settled)?.id || receivables[0]?.id || "";
  const selectedReceivable = receivables.find((r) => r.id === currentReceivableId) || null;

  const assignmentByTransactionId = useMemo(() => {
    const map = new Map<string, ReceivableTransactionAssignment>();
    for (const assignment of assignments) map.set(assignment.transaction_id, assignment);
    return map;
  }, [assignments]);

  const assignedToSelected = useMemo(
    () => assignments.filter((a) => a.receivable_id === currentReceivableId),
    [assignments, currentReceivableId],
  );
  const totalAssignedToSelected = assignedToSelected.reduce((sum, a) => sum + Number(a.amount), 0);

  const incomingTransactions = useMemo(
    () => transactions.filter((t) => t.id && t.amount > 0),
    [transactions],
  );

  // Vorgeschlagene (auch kleine) Rückzahlungen für die ausgewählte Forderung.
  const suggestedIds = useMemo(() => {
    if (!selectedReceivable) return new Set<TransactionId>();
    return new Set(
      suggestReceivableRepayments(selectedReceivable, incomingTransactions)
        .map((t) => t.id)
        .filter((id): id is TransactionId => !!id),
    );
  }, [selectedReceivable, incomingTransactions]);

  // Treffer zuerst anzeigen.
  const sortedIncoming = useMemo(() => {
    return [...incomingTransactions].sort((a, b) => {
      const aHit = a.id && suggestedIds.has(a.id) ? 0 : 1;
      const bHit = b.id && suggestedIds.has(b.id) ? 0 : 1;
      return aHit - bHit;
    });
  }, [incomingTransactions, suggestedIds]);

  const handleSave = (data: Partial<Receivable>) => {
    if (editing?.id) updateMutation.mutate({ ...data, id: editing.id });
    else createMutation.mutate(data);
  };

  const toggleSettled = (r: Receivable) => {
    updateMutation.mutate({
      id: r.id,
      is_settled: !r.is_settled,
      amount: !r.is_settled ? 0 : r.amount,
    });
  };

  const handleToggleAssignment = (transaction: Transaction, checked: boolean) => {
    if (!transaction.id || !currentReceivableId) return;
    const existing = assignmentByTransactionId.get(transaction.id);
    if (checked) {
      if (existing) return;
      assignMutation.mutate({ receivableId: currentReceivableId, transactionId: transaction.id });
      return;
    }
    if (existing?.receivable_id === currentReceivableId) unassignMutation.mutate(existing.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('debts.receivablesPanel.addReceivable')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton variant="shimmer" className="h-20 w-full" />
          <Skeleton variant="shimmer" className="h-20 w-full" />
        </div>
      ) : hasLoadError ? (
        <FinanceErrorState variant="data" onRetry={retryAll} />
      ) : receivables.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title={t('debts.receivablesPanel.emptyTitle')}
          description={t('debts.receivablesPanel.emptyDescription')}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('debts.receivablesPanel.firstButton')}
            </Button>
          }
        />
      ) : (
        <>
          {/* Reine Kennzahlen ohne Follow-up -> gebündeltes Readout statt Karten
              (Usability-Audit „Karten sind Aktionen"). */}
          <InfoStatStrip
            items={[
              { label: t('debts.receivablesPanel.totalLabel'), value: money.mask(eur.format(totalReceivables)) },
              { label: t('debts.receivablesPanel.openLabel'), value: openCount },
            ]}
          />

          <div className="space-y-2">
            {receivables.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-xl">{RECEIVABLE_TYPE_ICONS[r.type]}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="truncate">{r.name}</span>
                      {r.is_cash && <Badge variant="secondary" className="shrink-0">{t('debts.receivablesPanel.cash')}</Badge>}
                      {r.is_settled && (
                        <Badge className="shrink-0 bg-positive/20 text-positive">{t('debts.receivablesPanel.settled')}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {receivableTypeLabels[r.type]}
                      {r.debtor ? ` · ${r.debtor}` : ""}
                      {r.due_date
                        ? t('debts.receivablesPanel.dueUntil').replace(
                            '{date}',
                            new Date(r.due_date).toLocaleDateString(locale),
                          )
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
                  <div className="font-semibold">{money.mask(eur.format(r.amount))}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={r.is_settled ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleSettled(r)}
                      title={r.is_settled ? t('debts.receivablesPanel.markUnsettled') : t('debts.receivablesPanel.markSettled')}
                    >
                      <CheckCircle2 className={r.is_settled ? "mr-1.5 h-4 w-4 text-positive" : "mr-1.5 h-4 w-4"} />
                      {r.is_settled ? t('debts.receivablesPanel.unsettled') : t('debts.receivablesPanel.settled')}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t("debtService.moreActions")}>
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(r);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> {t('debts.receivablesPanel.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(t('debts.receivablesPanel.deleteConfirm').replace('{name}', r.name)))
                              deleteMutation.mutate(r.id);
                          }}
                          className="text-warning focus:text-warning"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t('debts.receivablesPanel.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Rückzahlungen zuordnen */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 text-sm font-semibold">{t('debts.receivablesPanel.assignPaymentsTitle')}</div>
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="space-y-2">
                  <Label>{t('debts.receivablesPanel.receivableLabel')}</Label>
                  <Select value={currentReceivableId} onValueChange={setSelectedReceivableId}>
                    <SelectTrigger aria-label={t('debts.receivablesPanel.receivableLabel')}>
                      <SelectValue placeholder={t('debts.receivablesPanel.selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {receivables.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedReceivable && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('debts.receivablesPanel.openAmountLabel')}</span>
                        <span className="font-medium">{money.mask(eur.format(selectedReceivable.amount))}</span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">{t('debts.receivablesPanel.assignedLabel')}</span>
                        <span className="font-medium">{money.mask(eur.format(totalAssignedToSelected))}</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('debts.receivablesPanel.suggestionsHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('debts.receivablesPanel.incomingLabel')}</Label>
                  {incomingTransactions.length === 0 ? (
                    <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                      {t('debts.receivablesPanel.noIncoming')}
                    </div>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-auto rounded-lg border p-2">
                      {sortedIncoming.map((transaction) => {
                        const assigned = transaction.id ? assignmentByTransactionId.get(transaction.id) : undefined;
                        const assignedHere = assigned?.receivable_id === currentReceivableId;
                        const assignedReceivable = assigned
                          ? receivables.find((r) => r.id === assigned.receivable_id)
                          : null;
                        const isSuggested = transaction.id ? suggestedIds.has(transaction.id) : false;

                        return (
                          <label
                            key={transaction.id}
                            className={`flex items-start gap-3 rounded-md p-2 text-sm ${
                              assigned && !assignedHere ? "opacity-60" : "hover:bg-muted/50"
                            } ${isSuggested && !assigned ? "bg-positive/5 ring-1 ring-positive/30" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4"
                              checked={assignedHere}
                              disabled={
                                (!!assigned && !assignedHere) ||
                                assignMutation.isPending ||
                                unassignMutation.isPending
                              }
                              onChange={(e) => handleToggleAssignment(transaction, e.target.checked)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 truncate font-medium">
                                {transaction.payee || transaction.description || transaction.original_text}
                                {isSuggested && !assigned && (
                                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-positive" aria-label={t('receivables.suggestedAriaLabel')} />
                                )}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {new Date(transaction.date).toLocaleDateString("de-DE")} ·{" "}
                                {transaction.description || transaction.original_text}
                                {assigned && !assignedHere && assignedReceivable
                                  ? ` · ${t('debts.receivablesPanel.alreadyAssigned').replace('{name}', assignedReceivable.name)}`
                                  : ""}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold text-positive">
                              +{money.mask(eur.format(Math.abs(transaction.amount)))}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {assignedToSelected.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {t('debts.receivablesPanel.repaymentsSummary')
                        .replace('{count}', String(assignedToSelected.length))
                        .replace('{plural}', assignedToSelected.length === 1 ? '' : 'en')}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ReceivableFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        receivable={editing}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
