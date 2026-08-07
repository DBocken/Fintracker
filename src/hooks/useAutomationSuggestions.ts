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

  // WP-9.6: Alle vier Abfragen speisen dieselbe Aussage („diese Vorschlaege
  // sind offen"). Faellt eine aus, sind die Vorschlaege nicht bloss weniger,
  // sondern falsch: Ohne `decided` gelten laengst weggeklickte wieder als
  // offen. Der Hook stellt nichts dar (AGENTS.md §3) — er reicht den
  // Unterschied nach oben durch.
  const {
    data: transactions = [],
    isLoading: txLoading,
    isError: txError,
    refetch: refetchTx,
  } = useQuery({
    // Limit im Query-Key (F-PERF-3): sonst kollidiert dieser 1000er-Load mit den
    // 5000er-Loads von Dashboard/Buchungen/Premium unter demselben Key und der
    // zuerst gemountete Aufrufer bestimmt den Cache → still falsche Summen.
    // Invalidierungen via Prefix ["transactions"] matchen weiterhin beide.
    queryKey: ["transactions", 1000],
    queryFn: () => getTransactions(1000),
  });
  const {
    data: categories = [],
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const {
    data: rules = [],
    isError: rulesError,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ["merchant-rules"],
    queryFn: getMerchantRules,
  });
  const {
    data: decided = [],
    isError: decidedError,
    refetch: refetchDecided,
  } = useQuery({
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
    isError: txError || categoriesError || rulesError || decidedError,
    refetch: () => {
      void refetchTx();
      void refetchCategories();
      void refetchRules();
      void refetchDecided();
    },
    categoryNameById,
    accept: (s: AutomationSuggestion) => acceptMutation.mutate(s),
    reject: (s: AutomationSuggestion) => rejectMutation.mutate(s),
    isBusy: acceptMutation.isPending || rejectMutation.isPending,
  };
}
