import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, TrendingDown, MoreVertical, ScanLine } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useI18n } from "@/i18n/useI18n";
import { DebtFormDialog } from "@/components/debts/DebtFormDialog";
import { DebtSuggestionsBanner } from "@/components/debts/DebtSuggestionsBanner";
import ClaimImportDialog from "@/components/debts/ClaimImportDialog";
import { ReceivablesPanel } from "@/components/debts/ReceivablesPanel";
import { DebtCard } from "@/components/debts/DebtCard";
import { SignatureMoment } from "@/components/common/SignatureMoment";
import { useDebtFreedom } from "@/hooks/useDebtFreedom";
import { DebtDetailSheet } from "@/components/debts/DebtDetailSheet";
import { CounselingBridgeCard } from "@/components/debts/CounselingBridgeCard";
import { SchufaSelfCheckCard } from "@/components/debts/SchufaSelfCheckCard";
import { InfoStatStrip } from "@/components/common/InfoGroup";
import type { Debt, Transaction } from "@/types";
import { getTransactions } from "@/services/transaction-service";
import { getFinancialHealth } from "@/services/financial-health-service";
import { assessDebtCounseling } from "@/lib/debt-counseling";

import {
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  getTotalDebt,
  getTotalMinPayment,
  calculatePayoffPlan,
  getDebtTransactionAssignments,
  assignTransactionToDebt,
  unassignDebtTransaction,
  type DebtTransactionAssignment,
  type PayoffStrategy,
  getDebtTypeLabels,
  DEBT_TYPE_ICONS,
  getExistentialPriorityExplanation,
} from "@/services/debt-service";
import { getDebtStrategy, setDebtStrategy } from "@/lib/debt-strategy";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function DebtsPage() {
  const { t, locale } = useI18n();
  const debtTypeLabels = getDebtTypeLabels();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Debt> | null>(null);
  // Portfolio-Strategie: global, persistiert, gilt für alle Schulden (#54)
  const [strategy, setStrategyState] = useState<PayoffStrategy>(getDebtStrategy);
  const setStrategy = (s: PayoffStrategy) => {
    setStrategyState(s);
    setDebtStrategy(s);
  };
  const [extraBudget, setExtraBudget] = useState("");
  const [selectedDebtId, setSelectedDebtId] = useState<string>("");
  // Mobile-Detailansicht (Audit C-P1/F): Zuordnung/Aktionen pro Schuld im Sheet.
  const [detailDebtId, setDetailDebtId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ["debts"],
    queryFn: getDebts,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", "debt-assignment"],
    queryFn: () => getTransactions(500),
    enabled: debts.length > 0,
  });

  const { data: assignments = [] } = useQuery<DebtTransactionAssignment[]>({
    queryKey: ["debt-transaction-assignments"],
    queryFn: getDebtTransactionAssignments,
    enabled: debts.length > 0,
  });

  // Einkommens-/Ausgabenmittel speisen die Überschuldungs-Heuristik (Issue #50).
  const { data: health } = useQuery({
    queryKey: ["financial-health", locale],
    queryFn: getFinancialHealth,
    enabled: debts.length > 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["debts"] });
    queryClient.invalidateQueries({ queryKey: ["debt-transaction-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["coach-insights"] });
    queryClient.invalidateQueries({ queryKey: ["milestones"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    queryClient.invalidateQueries({ queryKey: ["financial-health"] });
    queryClient.invalidateQueries({ queryKey: ["coach-overview"] });
    queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
  };

  const createMutation = useMutation({
    mutationFn: createDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.addSuccess"));
      setDialogOpen(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.updateSuccess"));
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => showError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.deleteSuccess"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: assignTransactionToDebt,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.assignSuccess"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignDebtTransaction,
    onSuccess: () => {
      invalidate();
      showSuccess(t("debts.unassignSuccess"));
    },
    onError: (e: Error) => showError(e.message),
  });

  const totalDebt = getTotalDebt(debts);

  // WP-7.4: Der Erfolgsmoment erscheint genau einmal je Schuldenfreiheit — und
  // NICHT bei jemandem, der nie Schulden erfasst hat (dort waere er albern bis
  // verletzend). `isLoading` sperrt den Fehlalarm ab, waehrend die Summe noch
  // 0 ist, weil die Daten fehlen.
  const celebrateDebtFreedom = useDebtFreedom(totalDebt, isLoading);

  const totalMin = getTotalMinPayment(debts);

  const payoffPlan = useMemo(() => {
    const extra = parseFloat(extraBudget) || 0;
    return calculatePayoffPlan(debts, totalMin + extra, strategy);
  }, [debts, totalMin, extraBudget, strategy]);

  // Schuldnerberatungs-Empfehlung: schlägt nur an, wenn der Plan auf eine
  // Überschuldung hindeutet (nie aufgehend, > 6 Jahre, Raten > Spielraum).
  const counseling = useMemo(() => {
    const extra = parseFloat(extraBudget) || 0;
    return assessDebtCounseling({
      plan: payoffPlan,
      monthlyRate: totalMin + extra,
      minPayments: totalMin,
      monthlyIncome: health?.monthlyIncome ?? 0,
      monthlyExpenses: health?.monthlyExpenses ?? 0,
    });
  }, [payoffPlan, totalMin, extraBudget, health]);

  const currentDebtId = selectedDebtId || debts.find((d) => !d.is_paid_off)?.id || debts[0]?.id || "";
  const selectedDebt = debts.find((d) => d.id === currentDebtId) || null;

  const assignmentByTransactionId = useMemo(() => {
    const map = new Map<string, DebtTransactionAssignment>();
    for (const assignment of assignments) {
      map.set(assignment.transaction_id, assignment);
    }
    return map;
  }, [assignments]);

  const assignedToSelectedDebt = useMemo(

    () => assignments.filter((assignment) => assignment.debt_id === currentDebtId),
    [assignments, currentDebtId]
  );

  const debitTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.id && transaction.amount < 0),
    [transactions]
  );

  const totalAssignedToSelectedDebt = assignedToSelectedDebt.reduce((sum, assignment) => sum + Number(assignment.amount), 0);

  // Debt cause breakdown by type / provider

  const causes = useMemo(() => {
    const active = debts.filter((d) => !d.is_paid_off && d.balance > 0);
    const sum = active.reduce((s, d) => s + d.balance, 0);
    if (sum <= 0) return [];
    const byKey: Record<string, number> = {};
    for (const d of active) {
      const key = d.is_bnpl ? d.provider || debtTypeLabels.installment : debtTypeLabels[d.type];
      byKey[key] = (byKey[key] || 0) + d.balance;
    }
    return Object.entries(byKey)
      .map(([label, amount]) => ({ label, amount, pct: Math.round((amount / sum) * 100) }))
      .sort((a, b) => b.amount - a.amount);
  }, [debts, debtTypeLabels]);

  const handleSave = (data: Partial<Debt>) => {
    if (editing?.id) updateMutation.mutate({ ...data, id: editing.id });
    else createMutation.mutate(data);
  };

  const handleEdit = (d: Debt) => {
    setEditing(d);
    setDialogOpen(true);
  };

  const togglePaidOff = (d: Debt) => {
    updateMutation.mutate({ id: d.id, is_paid_off: !d.is_paid_off, balance: !d.is_paid_off ? 0 : d.balance });
  };

  const handleToggleAssignmentFor = (debtId: string, transaction: Transaction, checked: boolean) => {
    if (!transaction.id || !debtId) return;

    const existing = assignmentByTransactionId.get(transaction.id);
    if (checked) {
      if (existing) return;
      assignMutation.mutate({ debtId, transactionId: transaction.id });
      return;
    }

    if (existing?.debt_id === debtId) {
      unassignMutation.mutate(existing.id);
    }
  };

  const handleToggleTransactionAssignment = (transaction: Transaction, checked: boolean) =>
    handleToggleAssignmentFor(currentDebtId, transaction, checked);

  const openDetail = (d: Debt) => {
    setDetailDebtId(d.id);
    setDetailOpen(true);
  };

  const detailDebt = debts.find((d) => d.id === detailDebtId) || null;

  return (

    <div>
      <PageHeader
        title={t("debts.title")}
        description={t("debts.description")}
      />

      <Tabs defaultValue="debts" className="mt-2">
        <TabsList>
          <TabsTrigger value="debts">{t("debts.tabDebts")}</TabsTrigger>
          <TabsTrigger value="receivables">{t("debts.tabReceivables")}</TabsTrigger>
        </TabsList>

        <TabsContent value="debts" className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <ScanLine className="mr-1.5 h-4 w-4" />
              {t('debts.debtsPage.scanLetters')}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t("debts.addDebt")}
            </Button>
          </div>

          <DebtSuggestionsBanner
            onAdopt={(prefill) => {
              setEditing(prefill);
              setDialogOpen(true);
            }}
          />

          {isLoading ? (
        <div className="space-y-3">
          <Skeleton variant="shimmer" className="h-20 w-full" />
          <Skeleton variant="shimmer" className="h-20 w-full" />
        </div>
      ) : debts.length === 0 ? (
        <EmptyState
          emoji="💸"
          title={t('debts.debtsPage.emptyTitle')}
          description={t('debts.debtsPage.emptyDescription')}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('debts.debtsPage.addFirstDebt')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {celebrateDebtFreedom && (
            <SignatureMoment
              title={t('debts.debtsPage.debtFreeTitle')}
              icon="🕊️"
              subtitle={t('debts.debtsPage.debtFreeSubtitle')}
              variant="large"
            />
          )}

          {/* Reine Kennzahlen ohne Follow-up → gebündeltes Readout statt Karten
              (Usability-Audit „Karten sind Aktionen"). */}
          <InfoStatStrip
            items={[
              { label: t('debts.debtsPage.totalDebtStat'), value: eur.format(totalDebt) },
              { label: t('debts.debtsPage.minPaymentsStat'), value: eur.format(totalMin) },
              { label: t('debts.debtsPage.openDebtsStat'), value: debts.filter((d) => !d.is_paid_off).length },
            ]}
          />

          {/* Mobile: kompakte Karten mit Detail-Sheet (Audit C-P1/F) */}
          <div className="space-y-3 lg:hidden">
            {debts.map((d) => (
              <DebtCard key={d.id} debt={d} onTogglePaid={togglePaidOff} onOpenDetails={openDetail} />
            ))}
          </div>

          {/* Desktop: ausführliche Zeilenliste */}
          <div className="hidden space-y-2 lg:block">
            {debts.map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-xl">{DEBT_TYPE_ICONS[d.type]}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="truncate">{d.name}</span>
                      {d.priority === "existenzsichernd" && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 bg-brand/15 text-brand"
                          title={getExistentialPriorityExplanation()}
                        >
                          🏠 {t('debtService.priorityExistential')}
                        </Badge>
                      )}
                      {d.is_bnpl && <Badge variant="secondary" className="shrink-0">{debtTypeLabels.installment}</Badge>}
                      {d.is_paid_off && (
                        <Badge className="shrink-0 bg-positive/20 text-positive">{t('debts.debtCard.paid')}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {debtTypeLabels[d.type]} · {d.interest_rate}% · {t('debts.debtCard.rateLabel')} {eur.format(d.min_payment)}
                      {d.due_day ? ` · ${t('debts.debtCard.dueLabel').replace('{day}', String(d.due_day))}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
                  <div className="font-semibold">{eur.format(d.balance)}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={d.is_paid_off ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => togglePaidOff(d)}
                      title={d.is_paid_off ? t('debts.debtsPage.markOpen') : t('debts.debtsPage.markPaidTitle')}
                    >
                      <CheckCircle2 className={d.is_paid_off ? "mr-1.5 h-4 w-4 text-positive" : "mr-1.5 h-4 w-4"} />
                      {d.is_paid_off ? t('debts.debtCard.markUndone') : t('debts.debtCard.markPaid')}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('debts.debtsPage.moreActions')}>
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(d)}>
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> {t('debts.debtsPage.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(t('debts.debtsPage.deleteConfirm').replace('{name}', d.name))) deleteMutation.mutate(d.id);
                          }}
                          className="text-warning focus:text-warning"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t('debts.debtsPage.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Debt cause analysis */}
          {causes.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-semibold">{t('debts.debtsPage.causesTitle')}</div>
                <div className="space-y-2">
                  {causes.map((c) => (
                    <div key={c.label}>
                      <div className="flex justify-between text-sm">
                        <span>{c.label}</span>
                        <span className="text-muted-foreground">
                          {c.pct}% · {eur.format(c.amount)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Automatic debt payments — Desktop inline; mobil im Detail-Sheet */}
          {debts.length > 0 && (
            <Card className="hidden lg:block">
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-semibold">{t('debts.debtsPage.assignPaymentsTitle')}</div>
                <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                  <div className="space-y-2">
                    <Label>{t('debts.debtsPage.debtLabel')}</Label>
                    <Select value={currentDebtId} onValueChange={setSelectedDebtId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('debts.debtsPage.selectDebtPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {debts.map((debt) => (
                          <SelectItem key={debt.id} value={debt.id}>
                            {debt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDebt && (
                      <div className="rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('debts.debtsPage.currentBalance')}</span>
                          <span className="font-medium">{eur.format(selectedDebt.balance)}</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-muted-foreground">{t('debts.debtsPage.assignedPayments')}</span>
                          <span className="font-medium">{eur.format(totalAssignedToSelectedDebt)}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('debts.debtsPage.assignHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('debts.debtsPage.paymentsLabel')}</Label>
                    {debitTransactions.length === 0 ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                        {t('debts.debtsPage.noPaymentsFound')}
                      </div>
                    ) : (
                      <div className="max-h-80 space-y-2 overflow-auto rounded-lg border p-2">
                        {debitTransactions.map((transaction) => {
                          const assigned = transaction.id ? assignmentByTransactionId.get(transaction.id) : undefined;
                          const assignedHere = assigned?.debt_id === currentDebtId;
                          const assignedDebt = assigned ? debts.find((debt) => debt.id === assigned.debt_id) : null;

                          return (
                            <label
                              key={transaction.id}
                              className={`flex items-start gap-3 rounded-md p-2 text-sm ${assigned && !assignedHere ? "opacity-60" : "hover:bg-muted/50"}`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4"
                                checked={assignedHere}
                                disabled={!!assigned && !assignedHere || assignMutation.isPending || unassignMutation.isPending}
                                onChange={(e) => handleToggleTransactionAssignment(transaction, e.target.checked)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {transaction.payee || transaction.description || transaction.original_text}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {new Date(transaction.date).toLocaleDateString("de-DE")} · {transaction.description || transaction.original_text}
                                  {assigned && !assignedHere && assignedDebt ? t('debts.debtsPage.alreadyAssignedTo').replace('{name}', assignedDebt.name) : ""}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold">{eur.format(Math.abs(transaction.amount))}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {assignedToSelectedDebt.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {t(assignedToSelectedDebt.length === 1 ? 'debts.debtsPage.assignedCountSingular' : 'debts.debtsPage.assignedCountPlural').replace('{count}', String(assignedToSelectedDebt.length))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payoff plan */}
          {totalDebt > 0 && (

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <TrendingDown className="h-4 w-4" />
                  {t('debts.debtsPage.payoffPlanTitle')}
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t('debts.debtsPage.strategyLabel')}</Label>
                    <Tabs value={strategy} onValueChange={(v) => setStrategy(v as PayoffStrategy)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="avalanche">{t('debts.debtsPage.strategyAvalanche')}</TabsTrigger>
                        <TabsTrigger value="snowball">{t('debts.debtsPage.strategySnowball')}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="avalanche" className="mt-2 text-xs text-muted-foreground">
                        {t('debts.debtsPage.strategyAvalancheDesc')}
                      </TabsContent>
                      <TabsContent value="snowball" className="mt-2 text-xs text-muted-foreground">
                        {t('debts.debtsPage.strategySnowballDesc')}
                      </TabsContent>
                    </Tabs>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="extra">{t('debts.debtsPage.extraBudgetLabel')}</Label>
                    <Input
                      id="extra"
                      type="number"
                      inputMode="decimal"
                      value={extraBudget}
                      onChange={(e) => setExtraBudget(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('debts.debtsPage.extraBudgetHint').replace('{amount}', eur.format(totalMin))}
                    </p>
                  </div>
                </div>

                {payoffPlan.insufficientBudget ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                    {t('debts.debtsPage.insufficientBudget')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('debts.debtsPage.debtFreeIn')}</span>
                        <span className="font-semibold">{payoffPlan.totalMonths} {t('debts.debtsPage.months')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('debts.debtsPage.totalInterest')}</span>
                        <span className="font-semibold">{eur.format(payoffPlan.totalInterestPaid)}</span>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('debts.debtsPage.priorityOrder').replace('{strategy}', strategy === "avalanche" ? t('debts.debtsPage.strategyAvalanche') : t('debts.debtsPage.strategySnowball'))}
                        </div>
                        <ol className="space-y-1.5">
                          {payoffPlan.steps.map((s) => (
                            <li key={s.debtId} className="flex items-center gap-3 text-sm">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                                {s.priorityOrder}
                              </span>
                              <span className="flex-1 truncate">
                                {s.priority === "existenzsichernd" ? "🏠 " : ""}
                                {s.name}
                              </span>
                              <span className="text-muted-foreground">
                                {strategy === "avalanche" ? `${s.interestRate}%` : eur.format(s.balance)}
                              </span>
                            </li>
                          ))}
                        </ol>
                        {payoffPlan.steps.some((s) => s.priority === "existenzsichernd") && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            🏠 {getExistentialPriorityExplanation()}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('debts.debtsPage.expectedPayoff')}
                        </div>
                        <ol className="space-y-1.5">
                          {[...payoffPlan.steps]
                            .sort((a, b) => a.monthsToPayoff - b.monthsToPayoff || a.priorityOrder - b.priorityOrder)
                            .map((s) => (
                              <li key={s.debtId} className="flex items-center gap-3 text-sm">
                                <span className="flex-1 truncate">{s.name}</span>
                                <span className="text-muted-foreground">{t('debts.debtsPage.month').replace('{n}', String(s.monthsToPayoff))}</span>
                              </li>
                            ))}
                        </ol>
                      </div>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Überschuldungs-Sicherheitsnetz: aktive Vermittlung zu kostenloser
              Schuldnerberatung, sobald der Plan kritisch wird (Issue #50). */}
          <CounselingBridgeCard recommendation={counseling} />

          {/* SCHUFA-Selbstauskunft anstoßen (Issue #49). */}
          <SchufaSelfCheckCard />
            </div>
          )}
        </TabsContent>

        <TabsContent value="receivables">
          <ReceivablesPanel />
        </TabsContent>
      </Tabs>

      <DebtFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        debt={editing}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ClaimImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <DebtDetailSheet
        debt={detailDebt}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        debitTransactions={debitTransactions}
        assignmentByTransactionId={assignmentByTransactionId}
        onEdit={(d) => {
          setDetailOpen(false);
          handleEdit(d);
        }}
        onDelete={(d) => {
          if (confirm(`Schuld „${d.name}“ löschen?`)) {
            deleteMutation.mutate(d.id);
            setDetailOpen(false);
          }
        }}
        onToggleAssignment={handleToggleAssignmentFor}
        assignBusy={assignMutation.isPending || unassignMutation.isPending}
      />
    </div>
  );
}
