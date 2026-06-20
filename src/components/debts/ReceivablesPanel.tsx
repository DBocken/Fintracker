import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, MoreVertical, Sparkles } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
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
import { getTransactions } from "@/services/transaction-service";
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
  RECEIVABLE_TYPE_LABELS,
  RECEIVABLE_TYPE_ICONS,
  type ReceivableTransactionAssignment,
} from "@/services/receivable-service";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ReceivablesPanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Receivable> | null>(null);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>("");

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ["receivables"],
    queryFn: getReceivables,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", "receivable-assignment"],
    queryFn: () => getTransactions(500),
    enabled: receivables.length > 0,
  });

  const { data: assignments = [] } = useQuery<ReceivableTransactionAssignment[]>({
    queryKey: ["receivable-transaction-assignments"],
    queryFn: getReceivableTransactionAssignments,
    enabled: receivables.length > 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["receivables"] });
    queryClient.invalidateQueries({ queryKey: ["receivable-transaction-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    queryClient.invalidateQueries({ queryKey: ["financial-health"] });
    queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
  };

  const createMutation = useMutation({
    mutationFn: createReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess("Forderung hinzugefügt");
      setDialogOpen(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess("Forderung aktualisiert");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => showError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess("Forderung gelöscht");
    },
    onError: (e: Error) => showError(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: assignTransactionToReceivable,
    onSuccess: () => {
      invalidate();
      showSuccess("Rückzahlung zugewiesen");
    },
    onError: (e: Error) => showError(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignReceivableTransaction,
    onSuccess: () => {
      invalidate();
      showSuccess("Zuweisung entfernt");
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
    if (!selectedReceivable) return new Set<string>();
    return new Set(
      suggestReceivableRepayments(selectedReceivable, incomingTransactions)
        .map((t) => t.id)
        .filter((id): id is string => !!id),
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
          Forderung hinzufügen
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : receivables.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="Noch keine Forderungen erfasst"
          description="Erfasse verliehenes Geld, damit du den Überblick behältst und Rückzahlungen verbuchen kannst."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Erste Forderung hinzufügen
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Gesamtforderung</div>
                <div className="mt-1 text-2xl font-bold">{eur.format(totalReceivables)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Offene Forderungen</div>
                <div className="mt-1 text-2xl font-bold">{openCount}</div>
              </CardContent>
            </Card>
          </div>

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
                      {r.is_cash && <Badge variant="secondary" className="shrink-0">Bar</Badge>}
                      {r.is_settled && (
                        <Badge className="shrink-0 bg-positive/20 text-positive">Beglichen</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {RECEIVABLE_TYPE_LABELS[r.type]}
                      {r.debtor ? ` · ${r.debtor}` : ""}
                      {r.due_date ? ` · fällig bis ${new Date(r.due_date).toLocaleDateString("de-DE")}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
                  <div className="font-semibold">{eur.format(r.amount)}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={r.is_settled ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleSettled(r)}
                      title={r.is_settled ? "Als offen markieren" : "Als beglichen markieren"}
                    >
                      <CheckCircle2 className={r.is_settled ? "mr-1.5 h-4 w-4 text-positive" : "mr-1.5 h-4 w-4"} />
                      {r.is_settled ? "Rückgängig" : "Beglichen"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Weitere Aktionen">
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
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Forderung „${r.name}“ löschen?`)) deleteMutation.mutate(r.id);
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

          {/* Rückzahlungen zuordnen */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 text-sm font-semibold">Rückzahlungen dieser Forderung zuordnen</div>
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="space-y-2">
                  <Label>Forderung</Label>
                  <Select value={currentReceivableId} onValueChange={setSelectedReceivableId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Forderung auswählen" />
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
                        <span className="text-muted-foreground">Offener Betrag</span>
                        <span className="font-medium">{eur.format(selectedReceivable.amount)}</span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">Zugewiesene Rückzahlungen</span>
                        <span className="font-medium">{eur.format(totalAssignedToSelected)}</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Wir schlagen passende Geldeingänge automatisch vor – auch kleine Teilrückzahlungen.
                    Mit jeder Zuweisung sinkt der offene Betrag.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Geldeingänge</Label>
                  {incomingTransactions.length === 0 ? (
                    <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                      Keine Geldeingänge gefunden.
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
                                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-positive" aria-label="Vorgeschlagen" />
                                )}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {new Date(transaction.date).toLocaleDateString("de-DE")} ·{" "}
                                {transaction.description || transaction.original_text}
                                {assigned && !assignedHere && assignedReceivable
                                  ? ` · bereits bei ${assignedReceivable.name}`
                                  : ""}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold text-positive">
                              +{eur.format(Math.abs(transaction.amount))}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {assignedToSelected.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {assignedToSelected.length} Rückzahlung{assignedToSelected.length === 1 ? "" : "en"} dieser
                      Forderung zugewiesen.
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
