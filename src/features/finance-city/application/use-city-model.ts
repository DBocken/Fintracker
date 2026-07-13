/**
 * Application-Hook (WP-C8): lädt echte Transaktionen/Kategorien/Vertrags-
 * entscheidungen über dieselben TanStack-Query-Keys wie das Dashboard
 * (`financeKeys`, `src/features/shared/data/finance-query-keys.ts` —
 * geteilter Cache, kein Query-Duplikat, AGENTS.md §4/§7) und baut daraus über
 * die geteilte Aggregation (`buildSunburstTree`, `computeContracts`) +
 * `buildCityModelFromData` das `CityModel` für die Finanzstadt.
 *
 * KEIN eigener React-Query-`select`/eigene Aggregation hier über Beträge
 * (AGENTS.md §8) — `buildSunburstTree`/`computeContracts` bleiben die
 * einzige Quelle der Wahrheit, dieser Hook verdrahtet nur Queries + den
 * reinen Adapter.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { getContractDecisionMap, type ContractDecision } from '@/services/contract-decision-service';
import { buildSunburstTree } from '@/lib/analysis-data';
import { computeContracts } from '@/lib/contract-derivation';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { buildCityModelFromData } from '../domain/city-data-adapter';
import type { CityModel } from '../domain/city-model';
import type { Category } from '@/types';

// Stabile Referenz für den Query-Default (Muster aus `use-finance-overview.ts`):
// eine neue `new Map()` bei jedem Render würde die Memo-Kette unnötig invalidieren.
const EMPTY_CONTRACT_DECISIONS = new Map<string, ContractDecision>();

export type UseCityModelResult = {
  model: CityModel;
  isLoading: boolean;
  isEmpty: boolean;
};

export function useCityModel(): UseCityModelResult {
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    // Limit im Query-Key (F-PERF-3-Muster) — identisch zum Dashboard, sonst
    // Cache-Kollision/-Duplikat statt geteiltem Cache.
    queryKey: financeKeys.transactions(FINANCE_TRANSACTION_LIMIT),
    queryFn: () => getTransactions(FINANCE_TRANSACTION_LIMIT),
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: financeKeys.categories,
    queryFn: () => getCategories(),
  });

  const { data: contractDecisions = EMPTY_CONTRACT_DECISIONS } = useQuery({
    queryKey: financeKeys.contractDecisions,
    queryFn: getContractDecisionMap,
  });

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const model = useMemo(() => {
    const sunburst = buildSunburstTree(transactions, categories);
    const expenseContracts = computeContracts(transactions, categoriesById, 'Ausgabe', {
      decisions: contractDecisions,
    });
    return buildCityModelFromData(sunburst, categoriesById, expenseContracts);
  }, [transactions, categories, categoriesById, contractDecisions]);

  return {
    model,
    isLoading: transactionsLoading || categoriesLoading,
    isEmpty: model.districts.length === 0,
  };
}
