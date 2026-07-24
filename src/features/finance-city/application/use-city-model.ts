/**
 * Application-Hook (WP-C8): lädt echte Transaktionen/Kategorien/Aufteilungen über
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
import { evaluateMilestones } from '@/services/milestones-service';
import { buildSunburstTree } from '@/lib/analysis-data';
import { deriveIncomeStreams } from '@/lib/income-streams';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { useAllocationMap } from '@/hooks/useAllocationMap';
import { useI18n } from '@/i18n/useI18n';
import { buildCityModelFromData } from '../domain/city-data-adapter';
import { buildCityModelFromIncomeStreams } from '../domain/city-income-adapter';
import { buildCityModelFromMilestones } from '../domain/city-goals-adapter';
import { buildCityOverviewModel, type CityOverviewInfo } from '../domain/city-overview-adapter';
import { buildMerchantFloorsByBuilding } from '../domain/city-merchant-floors';
import type { CityModel } from '../domain/city-model';
import type { Category } from '@/types';

/** Welt der Stadt — Ausgaben (Default), Einnahmen (WP-D5), Ziele (WP-D7) oder Übersicht (WP-D8, kombiniert beide Geld-Welten). Ausgaben/Einnahmen/Übersicht teilen dieselben Queries, Ziele nutzen die Meilenstein-Auswertung der Milestones-Seite (gleicher Query-Key, geteilter Cache). */
export type CityModelTab = 'expenses' | 'income' | 'goals' | 'overview';

export type UseCityModelResult = {
  model: CityModel;
  isLoading: boolean;
  isEmpty: boolean;
  /** Nur im Übersicht-Tab gesetzt: Welt-Zuordnung der Distrikte + Summen/Saldo für Chip und Welt-Sprung. */
  overview?: CityOverviewInfo;
};

export function useCityModel(tab: CityModelTab = 'expenses'): UseCityModelResult {
  // WP-D7: Meilenstein-Titel sind zur Laufzeit lokalisiert (serviceT) —
  // derselbe locale-abhängige Query-Key wie `MilestonesPage` (geteilter
  // Cache, kein Duplikat). `enabled` nur im Ziele-Tab: `evaluateMilestones`
  // wertet Financial-Health/Schulden aus und persistiert neu erreichte
  // Meilensteine — das soll nicht bei jedem Ausgaben-Besuch mitlaufen.
  const { locale } = useI18n();
  const { data: milestones = [], isPending: milestonesPending } = useQuery({
    queryKey: ['milestones', locale],
    queryFn: evaluateMilestones,
    enabled: tab === 'goals',
  });

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

  // Aufteilungen (Split-Buchungen): Gebäude UND Etagen rechnen damit
  // anteilsgenau — der Kleidungs-Anteil einer Aldi-Buchung baut am
  // Kleidungs-Gebäude mit, nicht am Lebensmittel-Gebäude.
  const allocations = useAllocationMap();

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const { model, overview } = useMemo(() => {
    if (tab === 'goals') {
      // Ziele-Welt (WP-D7): Bauprojekte aus der Meilenstein-Auswertung.
      return { model: buildCityModelFromMilestones(milestones), overview: undefined };
    }
    if (tab === 'income') {
      // Einnahmen-Welt (WP-D5): geteilte Strom-Ableitung (Income-Seite nutzt
      // dieselbe Funktion) -> Einnahmen-Adapter. Keine eigene Aggregation.
      return {
        model: buildCityModelFromIncomeStreams(deriveIncomeStreams(transactions, categories)),
        overview: undefined,
      };
    }

    const sunburst = buildSunburstTree(transactions, categories, allocations);
    const floorsByBuilding = buildMerchantFloorsByBuilding(transactions, categoriesById, allocations);
    const expensesModel = buildCityModelFromData(sunburst, categoriesById, floorsByBuilding);
    if (tab !== 'overview') return { model: expensesModel, overview: undefined };

    // Übersicht (WP-D8): beide Geld-Welten auf einer Platte + Spar-Turm.
    // WICHTIG: die Einnahmen-Seite nutzt hier ein praktisch unbegrenztes
    // Fenster (statt der 12 Monate des Einnahmen-Tabs), damit BEIDE Seiten
    // dieselbe Datenbasis (alle geladenen Buchungen) bilanzieren — sonst
    // wäre der Spar-Turm eine Differenz über zwei verschiedene Zeiträume.
    const incomeModel = buildCityModelFromIncomeStreams(
      deriveIncomeStreams(transactions, categories, { windowMonths: 1200 }),
    );
    const result = buildCityOverviewModel(expensesModel, incomeModel);
    return { model: result.model, overview: result.info };
  }, [tab, transactions, categories, categoriesById, milestones, allocations]);

  return {
    model,
    overview,
    isLoading:
      tab === 'goals' ? milestonesPending : transactionsLoading || categoriesLoading,
    isEmpty: model.districts.length === 0,
  };
}
