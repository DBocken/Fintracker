import { useQuery } from "@tanstack/react-query";
import { getCoachOverview } from "@/services/coach-service";
import { getFinancialHealth } from "@/services/financial-health-service";
import { evaluateMilestones } from "@/services/milestones-service";
import { getTransactions } from "@/services/transaction-service";
import { getDebts } from "@/services/debt-service";
import { getReceivables } from "@/services/receivable-service";
import { queryKeys } from "@/lib/query-keys";

/**
 * Datenzugriffs-Hook für den Coach-Screen — kapselt alle IO an EINER Stelle, so
 * dass die Präsentationsvarianten (Desktop/Mobile) datenidentisch bleiben und
 * keine Services direkt importieren. Vorbild: `useAutomationSuggestions`.
 *
 * Alle Keys stammen aus der zentralen Factory (`@/lib/query-keys`), damit
 * Invalidierungen aus anderen Features (z. B. Kategorie-Annahme im
 * Automations-Hook invalidiert `coach.overview`) den Coach weiterhin treffen.
 */
export function useCoachOverview() {
  const coachQuery = useQuery({
    queryKey: queryKeys.coach.overview,
    queryFn: getCoachOverview,
  });
  const healthQuery = useQuery({
    queryKey: queryKeys.financialHealth,
    queryFn: getFinancialHealth,
  });
  const milestonesQuery = useQuery({
    queryKey: queryKeys.milestones,
    queryFn: evaluateMilestones,
  });

  // Eigener, schlanker Probe-Query: „gibt es überhaupt Finanzdaten?". Bewusst
  // NICHT über die großen Transactions-Loads (Limit 5000) — der eigene Key
  // (`coach.hasData`) verhindert, dass dieser 1er-Load den Dashboard-Cache
  // verfälscht (F-PERF-3).
  const hasDataQuery = useQuery({
    queryKey: queryKeys.coach.hasData,
    queryFn: async () => {
      const [txs, debts, receivables] = await Promise.all([
        getTransactions(1),
        getDebts(),
        getReceivables(),
      ]);
      return txs.length > 0 || debts.length > 0 || receivables.length > 0;
    },
  });

  return {
    coach: coachQuery.data,
    health: healthQuery.data,
    milestones: milestonesQuery.data,
    hasData: hasDataQuery.data,
    coachLoading: coachQuery.isLoading,
    milestonesLoading: milestonesQuery.isLoading,
    isLoading: coachQuery.isLoading,
  };
}
