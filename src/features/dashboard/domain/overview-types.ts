import type { SpendingSunburst, SunburstTree } from '@/lib/chart-data/sunburst';

// Kanonische Quelle: src/features/shared/domain/balance-calculations.ts (≥2 Slices benötigen diesen Typ).
export type { EffectiveBalance } from '@/features/shared/domain/balance-calculations';

/**
 * Kanonische Definition der Dashboard-Granularität — hier in der Domain-Schicht,
 * damit sowohl Domain- als auch Presentation-Module importieren können, ohne
 * dass die Domain von `components` abhängt.
 */
export type DashboardGranularity = 'daily' | 'weekly' | 'monthly';

export type IncomeExpensePoint = { date: string; income: number; expenses: number };

export type FinanceOverviewStats = {
  income: number;
  expenses: number;
  balance: number;
  currentBalance: number;
  count: number;
  series: IncomeExpensePoint[];
  sunburst: SpendingSunburst;
  sunburstTree: SunburstTree;
};

export type BalanceHistoryPoint = {
  iso: string;
  label: string;
  income: number;
  expenses: number;
  balance: number;
  cumulative: number;
};
