import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTransactions,
  getCategories,
  updateTransaction,
} from "@/services/transaction-service";
import { getMerchantRules } from "@/services/merchant-rules-service";
import {
  getAutomationSuggestions,
  upsertAutomationSuggestion,
  type AutomationSuggestion,
} from "@/services/automation-suggestion-service";
import { buildPendingCategorySuggestions } from "@/lib/automation-suggestions";

/**
 * Offene Kategorie-Vorschläge + Annehmen/Ablehnen (Issue: „Automatisch, aber nie
 * bevormundend"). Die Vorschläge werden on-demand aus nicht zugeordneten
 * Buchungen berechnet; nur die Entscheidung wird persistiert. Annehmen setzt die
 * Kategorie der Buchung; Ablehnen merkt den Vorschlag als erledigt vor.
 */
export function useAutomationSuggestions() {
  const qc = useQueryClient();

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => getTransactions(1000),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const { data: rules = [] } = useQuery({
    queryKey: ["merchant-rules"],
    queryFn: getMerchantRules,
  });
  const { data: decided = [] } = useQuery({
    queryKey: ["automation-suggestions"],
    queryFn: getAutomationSuggestions,
  });

  const suggestions = useMemo(
    () => buildPendingCategorySuggestions(transactions, categories, rules, decided),
    [transactions, categories, rules, decided],
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const acceptMutation = useMutation({
    mutationFn: async (s: AutomationSuggestion) => {
      const categoryId = (s.proposedChange as { category_id?: string }).category_id;
      if (s.entityId && categoryId) {
        await updateTransaction([{ id: s.entityId, category_id: categoryId }]);
      }
      await upsertAutomationSuggestion({
        ...s,
        status: "accepted",
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["automation-suggestions"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["coach-overview"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (s: AutomationSuggestion) =>
      upsertAutomationSuggestion({
        ...s,
        status: "rejected",
        updated_at: new Date().toISOString(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-suggestions"] }),
  });

  return {
    suggestions,
    isLoading: txLoading,
    categoryNameById,
    accept: (s: AutomationSuggestion) => acceptMutation.mutate(s),
    reject: (s: AutomationSuggestion) => rejectMutation.mutate(s),
    isBusy: acceptMutation.isPending || rejectMutation.isPending,
  };
}
