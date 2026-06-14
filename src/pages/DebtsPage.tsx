import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, TrendingDown, MoreVertical } from "lucide-react";
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
import { DebtFormDialog } from "@/components/debts/DebtFormDialog";
import { DebtSuggestionsBanner } from "@/components/debts/DebtSuggestionsBanner";
import type { Debt, Transaction } from "@/types";
import { getTransactions } from "@/services/transaction-service";

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
  DEBT_TYPE_LABELS,
  DEBT_TYPE_ICONS,
  EXISTENTIAL_PRIORITY_EXPLANATION,
} from "@/services/debt-service";
import { getDebtStrategy, setDebtStrategy } from "@/lib/debt-strategy";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function DebtsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Debt> | null>(null);
  // Portfolio-Strategie: global, persistiert, gilt für alle Schulden (#54)
  const [strategy, setStrategyState] = useState<PayoffStrategy>(getDebtStrategy);
  const setStrategy = (s: PayoffStrategy) => {
    setStrategyState(s);
    setDebtStrategy(s);
  };
  const [extraBudget, setExtraBudget] = useState("");
  const [selectedDebtId, setSelectedDebtId] = useState<string>("");

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["debts"] });
    queryClient.invalidateQueries({ queryKey: ["debt-transaction-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["coach-insights"] });
    queryClient.invalidateQueries({ queryKey: ["milestones"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth"] });
  };

  const createMutation = useMutation({
    mutationFn: createDebt,
    onSuccess: () => {
      invalidate();
      showSuccess("Schuld hinzugefügt");
      setDialogOpen(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateDebt,
    onSuccess: () => {
      invalidate();
      showSuccess("Schuld aktualisiert");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => showError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDebt,
    onSuccess: () => {
      invalidate();
      showSuccess("Schuld gelöscht");
    },
    onError: (e: Error) => showError(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: assignTransactionToDebt,
    onSuccess: () => {
      invalidate();
      showSuccess("Zahlung als Tilgung zugewiesen");
    },
    onError: (e: Error) => showError(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignDebtTransaction,
    onSuccess: () => {
      invalidate();
      showSuccess("Zuweisung entfernt");
    },
    onError: (e: Error) => showError(e.message),
  });

  const totalDebt = getTotalDebt(debts);

  const totalMin = getTotalMinPayment(debts);

  const payoffPlan = useMemo(() => {
    const extra = parseFloat(extraBudget) || 0;
    return calculatePayoffPlan(debts, totalMin + extra, strategy);
  }, [debts, totalMin, extraBudget, strategy]);

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
      const key = d.is_bnpl ? d.provider || "Ratenkauf" : DEBT_TYPE_LABELS[d.type];
      byKey[key] = (byKey[key] || 0) + d.balance;
    }
    return Object.entries(byKey)
      .map(([label, amount]) => ({ label, amount, pct: Math.round((amount / sum) * 100) }))
      .sort((a, b) => b.amount - a.amount);
  }, [debts]);

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

  const handleToggleTransactionAssignment = (transaction: Transaction, checked: boolean) => {
    if (!transaction.id || !currentDebtId) return;

    const existing = assignmentByTransactionId.get(transaction.id);
    if (checked) {
      if (existing) return;
      assignMutation.mutate({ debtId: currentDebtId, transactionId: transaction.id });
      return;
    }

    if (existing?.debt_id === currentDebtId) {
      unassignMutation.mutate(existing.id);
    }
  };

  return (

    <div>
      <PageHeader
        title="Schulden"
        description="Behalte alle Verbindlichkeiten im Blick und plane deinen Schuldenabbau."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Schuld hinzufügen
          </Button>
        }
      />

      <DebtSuggestionsBanner
        onAdopt={(prefill) => {
          setEditing(prefill);
          setDialogOpen(true);
        }}
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : debts.length === 0 ? (
        <EmptyState
          emoji="💸"
          title="Noch keine Schulden erfasst"
          description="Erfasse Kreditkarten, Klarna, Ratenkäufe & Co., damit dein Coach dir beim Abbau helfen kann."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Erste Schuld hinzufügen
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Gesamtschuld</div>
                <div className="mt-1 text-2xl font-bold">{eur.format(totalDebt)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Mindestraten / Monat</div>
                <div className="mt-1 text-2xl font-bold">{eur.format(totalMin)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Offene Schulden</div>
                <div className="mt-1 text-2xl font-bold">
                  {debts.filter((d) => !d.is_paid_off).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Debt list */}
          <div className="space-y-2">
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
                          title={EXISTENTIAL_PRIORITY_EXPLANATION}
                        >
                          🏠 Existenzsichernd
                        </Badge>
                      )}
                      {d.is_bnpl && <Badge variant="secondary" className="shrink-0">Ratenkauf</Badge>}
                      {d.is_paid_off && (
                        <Badge className="shrink-0 bg-positive/20 text-positive">Bezahlt</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {DEBT_TYPE_LABELS[d.type]} · {d.interest_rate}% · Rate {eur.format(d.min_payment)}
                      {d.due_day ? ` · fällig am ${d.due_day}.` : ""}
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
                      title={d.is_paid_off ? "Als offen markieren" : "Als bezahlt markieren"}
                    >
                      <CheckCircle2 className={d.is_paid_off ? "mr-1.5 h-4 w-4 text-positive" : "mr-1.5 h-4 w-4"} />
                      {d.is_paid_off ? "Rückgängig" : "Bezahlt markieren"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Weitere Aktionen">
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(d)}>
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Schuld „${d.name}“ löschen?`)) deleteMutation.mutate(d.id);
                          }}
                          className="text-warning focus:text-warning"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Löschen
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
                <div className="mb-3 text-sm font-semibold">Woher kommen deine Schulden?</div>
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

          {/* Automatic debt payments */}
          {debts.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-semibold">Zahlungen dieser Schuld zuordnen</div>
                <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                  <div className="space-y-2">
                    <Label>Schuld</Label>
                    <Select value={currentDebtId} onValueChange={setSelectedDebtId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Schuld auswählen" />
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
                          <span className="text-muted-foreground">Aktuelle Restschuld</span>
                          <span className="font-medium">{eur.format(selectedDebt.balance)}</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-muted-foreground">Zugewiesene Tilgungen</span>
                          <span className="font-medium">{eur.format(totalAssignedToSelectedDebt)}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Ordne wiederkehrende Lastschriften (z.B. Kreditkartenrate) einer Schuld zu — wir verfolgen damit automatisch deinen Tilgungsfortschritt.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Zahlungen</Label>
                    {debitTransactions.length === 0 ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                        Keine Zahlungen gefunden.
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
                                  {assigned && !assignedHere && assignedDebt ? ` · bereits bei ${assignedDebt.name}` : ""}
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
                        {assignedToSelectedDebt.length} Zahlung{assignedToSelectedDebt.length === 1 ? "" : "en"} dieser Schuld zugewiesen.
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
                  Schuldenabbauplan
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Strategie (gilt für alle Schulden)</Label>
                    <Tabs value={strategy} onValueChange={(v) => setStrategy(v as PayoffStrategy)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="avalanche">Zinsen sparen</TabsTrigger>
                        <TabsTrigger value="snowball">Schnelle Erfolge</TabsTrigger>
                      </TabsList>
                      <TabsContent value="avalanche" className="mt-2 text-xs text-muted-foreground">
                        Höchster Zins zuerst – spart am meisten Zinsen.
                      </TabsContent>
                      <TabsContent value="snowball" className="mt-2 text-xs text-muted-foreground">
                        Kleinste Schuld zuerst – schnelle Erfolgserlebnisse.
                      </TabsContent>
                    </Tabs>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="extra">Extra-Budget / Monat (€)</Label>
                    <Input
                      id="extra"
                      type="number"
                      inputMode="decimal"
                      value={extraBudget}
                      onChange={(e) => setExtraBudget(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Zusätzlich zu den Mindestraten ({eur.format(totalMin)}).
                    </p>
                  </div>
                </div>

                {payoffPlan.insufficientBudget ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                    Das Budget reicht nicht für die Mindestraten. Erhöhe das Extra-Budget oder prüfe deine Ausgaben.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Schuldenfrei in </span>
                        <span className="font-semibold">{payoffPlan.totalMonths} Monaten</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Zinsen gesamt </span>
                        <span className="font-semibold">{eur.format(payoffPlan.totalInterestPaid)}</span>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Prioritätsreihenfolge ({strategy === "avalanche" ? "Zinsen sparen" : "Schnelle Erfolge"})
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
                            🏠 {EXISTENTIAL_PRIORITY_EXPLANATION}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Voraussichtliche Tilgung
                        </div>
                        <ol className="space-y-1.5">
                          {[...payoffPlan.steps]
                            .sort((a, b) => a.monthsToPayoff - b.monthsToPayoff || a.priorityOrder - b.priorityOrder)
                            .map((s) => (
                              <li key={s.debtId} className="flex items-center gap-3 text-sm">
                                <span className="flex-1 truncate">{s.name}</span>
                                <span className="text-muted-foreground">Monat {s.monthsToPayoff}</span>
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
        </div>
      )}

      <DebtFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        debt={editing}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
