import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, PiggyBank } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccess, showError } from "@/utils/toast";
import type { Budget, BudgetSuggestion } from "@/types";
import { getBudgetOverview, saveBudget, deleteBudget } from "@/services/budget-service";
import { getHierarchicalCategories } from "@/services/transaction-service";
import BudgetCard from "@/components/budgets/BudgetCard";
import BudgetFormDialog from "@/components/budgets/BudgetFormDialog";
import SuggestedBudgets from "@/components/budgets/SuggestedBudgets";

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

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
      setDialogOpen(false);
      setEditing(null);
      showSuccess("Budget gespeichert");
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      invalidate();
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
    setDialogOpen(true);
  };

  const statuses = overview?.statuses ?? [];
  const suggestions = overview?.suggestions ?? [];

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Behalte deine Ausgaben im Griff – jedes Budget ist ein Tank, der sich mit dem Monat füllt."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Budget hinzufügen
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {statuses.map((status) => (
                <BudgetCard
                  key={status.budget.id}
                  status={status}
                  onEdit={() => {
                    setEditing(status.budget);
                    setDialogOpen(true);
                  }}
                  onDelete={() => handleDelete(status.budget)}
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

      <BudgetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editing}
        categories={categories}
        onSave={(data) => saveMutation.mutate(data)}
        isLoading={saveMutation.isPending}
      />
    </div>
  );
}
