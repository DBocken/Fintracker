import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, PiggyBank } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/utils/toast";
import type { Budget, BudgetStatus, BudgetSuggestion } from "@/types";
import { getBudgetOverview, saveBudget, deleteBudget } from "@/services/budget-service";
import { getHierarchicalCategories } from "@/services/transaction-service";
import BudgetTile from "@/components/budgets/BudgetTile";
import BudgetDetailDialog from "@/components/budgets/BudgetDetailDialog";
import BudgetFormDialog from "@/components/budgets/BudgetFormDialog";
import SuggestedBudgets from "@/components/budgets/SuggestedBudgets";

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["budget-overview"],
    queryFn: () => getBudgetOverview(),
  });

  // Hauptkategorien (mit Unterkategorien) für die Auswahl im Formular.
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-hierarchical"],
    queryFn: getHierarchicalCategories,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["budget-overview"] });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Budget>) => saveBudget(data),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditing(null);
      showSuccess("Budget gespeichert");
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      invalidate();
      setDetailId(null);
      showSuccess("Budget gelöscht");
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Löschen fehlgeschlagen"),
  });

  const handleAddSuggestion = (s: BudgetSuggestion) => {
    saveMutation.mutate({
      name: s.name,
      category_id: s.category_id,
      limit: s.limit,
      color: s.color,
      icon: s.icon,
      from_suggestion: true,
      period: "monthly",
    });
  };

  const handleDelete = (budget: Budget) => {
    if (typeof window !== "undefined" && !window.confirm(`Budget „${budget.name}" wirklich löschen?`)) return;
    if (budget.id) deleteMutation.mutate(budget.id);
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const statuses: BudgetStatus[] = overview?.statuses ?? [];
  const suggestions = overview?.suggestions ?? [];
  const detail = statuses.find((s) => s.budget.id === detailId) ?? null;

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Behalte deine Ausgaben im Griff – jedes Budget ist ein Tank, der sich mit dem Monat füllt. Tippe einen Tank an für Details."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Budget hinzufügen
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {suggestions.length > 0 && (
            <SuggestedBudgets
              suggestions={suggestions}
              onAdd={handleAddSuggestion}
              isLoading={saveMutation.isPending}
            />
          )}

          {statuses.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {statuses.map((status) => (
                <BudgetTile
                  key={status.budget.id}
                  status={status}
                  onClick={() => setDetailId(status.budget.id ?? null)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <PiggyBank className="h-10 w-10 text-muted-foreground" />
                <div>
                  <div className="font-medium">Noch keine Budgets</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Übernimm einen Vorschlag oben oder lege ein eigenes Budget an.
                  </p>
                </div>
                <Button onClick={openNew} variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" /> Erstes Budget anlegen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <BudgetDetailDialog
        status={detail}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={() => {
          if (detail) {
            setEditing(detail.budget);
            setDetailId(null);
            setFormOpen(true);
          }
        }}
        onDelete={() => detail && handleDelete(detail.budget)}
      />

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editing}
        categories={categories}
        onSave={(data) => saveMutation.mutate(data)}
        isLoading={saveMutation.isPending}
      />
    </div>
  );
}
