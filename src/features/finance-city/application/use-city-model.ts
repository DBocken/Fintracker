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
import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { evaluateMilestones } from '@/services/milestones-service';
import { buildSunburstTree } from '@/lib/chart-data/sunburst';
import { deriveIncomeStreams } from '@/lib/income-streams';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { useAllocationMap } from '@/hooks/useAllocationMap';
import { useI18n } from '@/i18n/useI18n';
import { buildCityModelFromData } from '../domain/city-data-adapter';
import { buildCityModelFromIncomeStreams } from '../domain/city-income-adapter';
import { buildCityModelFromMilestones } from '../domain/city-goals-adapter';
import { buildCityOverviewModel, type CityOverviewInfo } from '../domain/city-overview-adapter';
import { buildMerchantFloorsByBuilding } from '../domain/city-merchant-floors';
import { districtColorMap } from '../domain/city-data-adapter';
import { buildCityModelFromProjection } from '../domain/city-projection-adapter';
import { buildCityTimeline, monthKind, type CityMonth } from '../domain/city-timeline';
import { buildForecastInput } from '@/services/forecast-data';
import { projectCategorySpend } from '@/lib/forecast-category-projection';
import type { CityModel } from '../domain/city-model';
import { deriveCityRequestState, type CityRequestState } from '../domain/city-request-state';
import type { GoalProgressStage } from '../domain/city-goal-progress';
import type { Category } from '@/types';

/** Welt der Stadt — Ausgaben (Default), Einnahmen (WP-D5), Ziele (WP-D7) oder Übersicht (WP-D8, kombiniert beide Geld-Welten). Ausgaben/Einnahmen/Übersicht teilen dieselben Queries, Ziele nutzen die Meilenstein-Auswertung der Milestones-Seite (gleicher Query-Key, geteilter Cache). */
export type CityModelTab = 'expenses' | 'income' | 'goals' | 'overview';

export type UseCityModelResult = {
  model: CityModel;
  /**
   * EIN Zustand statt dreier unabhaengiger Booleans (WP 7.6, Befund DOM-5).
   *
   * Bis dahin gab dieser Hook `isLoading`/`isError`/`isEmpty` einzeln heraus —
   * und ein Lesefehler setzt IMMER beide, `isError` und `isEmpty` (ohne Daten
   * hat die Stadt keine Distrikte). Welcher davon gewinnt, konnte der Hook
   * damit gar nicht sagen; die Rangfolge lag bei der Aufrufstelle und war
   * seit WP 6.4 nur deshalb richtig, weil `useCityPageModel` sie sofort wieder
   * ueber `deriveCityRequestState` herstellte. Jetzt ist die unmoegliche
   * Kombination nicht mehr darstellbar: WP-9.6 („error schlaegt empty") steht
   * einmal in der Domaene und gilt fuer jeden Leser.
   */
  requestState: CityRequestState;
  refetch: () => void;
  /** Nur im Übersicht-Tab gesetzt: Welt-Zuordnung der Distrikte + Summen/Saldo für Chip und Welt-Sprung. */
  overview?: CityOverviewInfo;
  /** WP-5.2: Wählbare Monate (Vergangenheit mit Daten, laufender Monat, Prognose). Leer außerhalb des Ausgaben-Tabs. */
  timeline: CityMonth[];
};

/**
 * WP-5.2: Der angezeigte Monat (`yyyy-MM`). Ohne Angabe unverändert das
 * bisherige Verhalten — ALLE geladenen Buchungen auf einmal, kein Zeitfilter.
 * Die Zeitachse gibt es nur im Ausgaben-Tab: nur dort liefert der Forecast eine
 * Prognose je Kategorie, und ein Monatsregler, der in drei von vier Tabs nichts
 * tut, wäre schlimmer als keiner.
 */
export function useCityModel(tab: CityModelTab = 'expenses', monthKey?: string): UseCityModelResult {
  // WP-D7: Meilenstein-Titel sind zur Laufzeit lokalisiert (serviceT) —
  // derselbe locale-abhängige Query-Key wie `MilestonesPage` (geteilter
  // Cache, kein Duplikat). `enabled` nur im Ziele-Tab: `evaluateMilestones`
  // wertet Financial-Health/Schulden aus und persistiert neu erreichte
  // Meilensteine — das soll nicht bei jedem Ausgaben-Besuch mitlaufen.
  const { locale } = useI18n();
  // WP-9.6: `isEmpty: model.districts.length === 0` heisst „du hast noch nichts
  // erfasst" — die Stadt zeigt dann eine leere Landschaft. Bei einem
  // Lesefehler ist das die falscheste Aussage, die dieser Screen treffen kann.
  // Das Modell stellt nichts dar (AGENTS.md §3), es reicht den Unterschied
  // nach oben durch.
  const {
    data: milestones = [],
    isPending: milestonesPending,
    isError: milestonesError,
    refetch: refetchMilestones,
  } = useQuery({
    queryKey: ['milestones', locale],
    queryFn: evaluateMilestones,
    enabled: tab === 'goals',
  });

  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    // Limit im Query-Key (F-PERF-3-Muster) — identisch zum Dashboard, sonst
    // Cache-Kollision/-Duplikat statt geteiltem Cache.
    queryKey: financeKeys.transactions(FINANCE_TRANSACTION_LIMIT),
    queryFn: () => getTransactions(FINANCE_TRANSACTION_LIMIT),
  });

  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: financeKeys.categories,
    queryFn: () => getCategories(),
  });

  // Aufteilungen (Split-Buchungen): Gebäude UND Etagen rechnen damit
  // anteilsgenau — der Kleidungs-Anteil einer Aldi-Buchung baut am
  // Kleidungs-Gebäude mit, nicht am Lebensmittel-Gebäude.
  const { allocations, isError: allocError, refetch: refetchAllocations } = useAllocationMap();

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // WP-5.2: Zeitachse nur im Ausgaben-Tab (siehe Kommentar an `monthKey`).
  const timelineActive = tab === 'expenses';
  const nowMonth = new Date().toISOString().slice(0, 7);
  const selectedMonth = timelineActive ? monthKey : undefined;
  const selectedKind = selectedMonth ? monthKind(selectedMonth, nowMonth) : undefined;
  const isProjection = selectedKind === 'future';

  // WP-5.2: DIESELBE Query wie `useForecast` (`['forecast-input']`) — geteilter
  // Cache, kein Duplikat (AGENTS.md §4/§7). Damit greift die Stadt buchstäblich
  // die Eingaben der bestehenden Simulation ab, statt eine zweite Prognose zu
  // bauen, die der ersten widersprechen könnte. `enabled` nur im
  // Prognosemonat: der Normalfall lädt dadurch keinen Byte mehr als bisher.
  const {
    data: forecastInput,
    isLoading: forecastLoading,
    isError: forecastError,
    refetch: refetchForecast,
  } = useQuery({
    queryKey: ['forecast-input'],
    queryFn: buildForecastInput,
    staleTime: 5 * 60 * 1000,
    enabled: isProjection,
  });

  const timeline = useMemo(() => {
    if (!timelineActive) return [];
    const monthsWithData = new Set<string>();
    for (const transaction of transactions) {
      const month = transaction.date?.slice(0, 7);
      if (month) monthsWithData.add(month);
    }
    return buildCityTimeline({ monthsWithData: [...monthsWithData], nowMonth });
  }, [timelineActive, transactions, nowMonth]);

  // WP-5.3: Zuletzt gezeigte Fortschritts-Stufe je Bauprojekt. Die Hysterese
  // in `goalProgressStage` braucht diesen Vorzustand, damit ein Ziel, das um
  // eine Schwelle pendelt, nicht bei jedem Datenrefresh die Farbe wechselt.
  // Ein Ref (kein State): der Wert löst nie selbst ein Rendern aus, er
  // beeinflusst nur die nächste Ableitung.
  const goalStagesRef = useRef<Map<string, GoalProgressStage>>(new Map());

  const { model, overview } = useMemo(() => {
    if (tab === 'goals') {
      // Ziele-Welt (WP-D7): Bauprojekte aus der Meilenstein-Auswertung.
      const goalsModel = buildCityModelFromMilestones(milestones, goalStagesRef.current);
      goalStagesRef.current = new Map(
        goalsModel.districts.flatMap((district) => (district.stage ? [[district.id, district.stage]] : [])),
      );
      return { model: goalsModel, overview: undefined };
    }
    if (tab === 'income') {
      // Einnahmen-Welt (WP-D5): geteilte Strom-Ableitung (Income-Seite nutzt
      // dieselbe Funktion) -> Einnahmen-Adapter. Keine eigene Aggregation.
      return {
        model: buildCityModelFromIncomeStreams(deriveIncomeStreams(transactions, categories)),
        overview: undefined,
      };
    }

    // WP-5.2: Die Farben kommen IMMER aus dem Gesamtmodell über alle Monate.
    // Ohne diesen festen Bezug änderte sich mit den Monatsbeträgen die
    // Sortierung und damit die Farbe jedes Viertels bei jedem Monatsschritt —
    // die Stadt wäre nicht mehr als dieselbe erkennbar.
    const allTimeSunburst = buildSunburstTree(transactions, categories, allocations);
    const allTimeFloors = buildMerchantFloorsByBuilding(transactions, categoriesById, allocations);
    const colorByDistrictId = districtColorMap(
      buildCityModelFromData(allTimeSunburst, categoriesById, allTimeFloors),
    );

    if (isProjection && selectedMonth) {
      // Zukunftsmonat: Beträge kommen fertig aus der Simulation.
      const projection = forecastInput
        ? projectCategorySpend(
            {
              recurringFlows: forecastInput.recurringFlows ?? [],
              variableExpenses: forecastInput.variableExpenses ?? [],
            },
            selectedMonth,
          )
        : new Map<string, number>();
      return {
        model: buildCityModelFromProjection(projection, categoriesById, { colorByDistrictId }),
        overview: undefined,
      };
    }

    // Vergangenheit/laufender Monat: echte Buchungen, auf den Monat gefiltert.
    const monthTransactions = selectedMonth
      ? transactions.filter((transaction) => transaction.date?.slice(0, 7) === selectedMonth)
      : transactions;

    const sunburst = selectedMonth
      ? buildSunburstTree(monthTransactions, categories, allocations)
      : allTimeSunburst;
    const floorsByBuilding = selectedMonth
      ? buildMerchantFloorsByBuilding(monthTransactions, categoriesById, allocations)
      : allTimeFloors;
    const expensesModel = buildCityModelFromData(sunburst, categoriesById, floorsByBuilding, {
      colorByDistrictId,
    });
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
  }, [
    tab,
    transactions,
    categories,
    categoriesById,
    milestones,
    allocations,
    isProjection,
    selectedMonth,
    forecastInput,
  ]);

  return {
    model,
    overview,
    timeline,
    // Die Rangfolge (laden -> Fehler -> leer -> bereit) steht in der Domaene,
    // nicht hier und nicht in der Aufrufstelle: `deriveCityRequestState`.
    requestState: deriveCityRequestState({
      isLoading:
        tab === 'goals'
          ? milestonesPending
          : transactionsLoading || categoriesLoading || (isProjection && forecastLoading),
      // Derselbe Zuschnitt wie beim Laden: Im Ziele-Tab zaehlen die
      // Meilensteine, sonst die Finanzdaten.
      isError:
        tab === 'goals'
          ? milestonesError
          : transactionsError || categoriesError || allocError || (isProjection && forecastError),
      isEmpty: model.districts.length === 0,
    }),
    refetch: () => {
      void refetchMilestones();
      void refetchTransactions();
      void refetchCategories();
      void refetchAllocations();
      void refetchForecast();
    },
  };
}
