/**
 * Application-Hook (WP-C8): lädt echte Transaktionen/Kategorien über
 * dieselben TanStack-Query-Keys wie das Dashboard (`financeKeys`,
 * `src/features/shared/data/finance-query-keys.ts` — geteilter Cache, kein
 * Query-Duplikat, AGENTS.md §4/§7) und baut daraus über die geteilte
 * Aggregation (`buildSunburstTree`, `buildMerchantFloorsByBuilding`) +
 * `buildCityModelFromData` das `CityModel` für die Finanzstadt.
 *
 * KEIN eigener React-Query-`select`/eigene Aggregation hier über Beträge
 * (AGENTS.md §8) — `buildSunburstTree`/`buildMerchantFloorsByBuilding`
 * bleiben die einzige Quelle der Wahrheit, dieser Hook verdrahtet nur
 * Queries + den reinen Adapter.
 *
 * Etagen kommen seit WP-E2 NICHT mehr aus `computeContracts` (das Händler
 * mit zu wenigen Buchungen überspringt, siehe `city-merchant-floors.ts`),
 * sondern aus `buildMerchantFloorsByBuilding` — dafür braucht dieser Hook
 * keine `contractDecisions`-Query mehr (Etage = Händler, unabhängig von
 * einer Nutzer-Vertragsentscheidung).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { buildSunburstTree } from '@/lib/analysis-data';
import { deriveIncomeStreams } from '@/lib/income-streams';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { buildCityModelFromData } from '../domain/city-data-adapter';
import { buildCityModelFromIncomeStreams } from '../domain/city-income-adapter';
import { buildMerchantFloorsByBuilding } from '../domain/city-merchant-floors';
import type { CityModel } from '../domain/city-model';
import type { Category } from '@/types';

/** WP-D5: Welt der Stadt — Ausgaben (Default) oder Einnahmen. Beide teilen dieselben Queries, nur der Adapter unterscheidet sich. */
export type CityModelTab = 'expenses' | 'income';

export type UseCityModelResult = {
  model: CityModel;
  isLoading: boolean;
  isEmpty: boolean;
};

export function useCityModel(tab: CityModelTab = 'expenses'): UseCityModelResult {
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

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const model = useMemo(() => {
    if (tab === 'income') {
      // Einnahmen-Welt (WP-D5): geteilte Strom-Ableitung (Income-Seite nutzt
      // dieselbe Funktion) -> Einnahmen-Adapter. Keine eigene Aggregation.
      return buildCityModelFromIncomeStreams(deriveIncomeStreams(transactions, categories));
    }
    const sunburst = buildSunburstTree(transactions, categories);
    const floorsByBuilding = buildMerchantFloorsByBuilding(transactions, categoriesById);
    return buildCityModelFromData(sunburst, categoriesById, floorsByBuilding);
  }, [tab, transactions, categories, categoriesById]);

  return {
    model,
    isLoading: transactionsLoading || categoriesLoading,
    isEmpty: model.districts.length === 0,
  };
}
