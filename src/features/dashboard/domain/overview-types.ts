import type { SpendingSunburst, SunburstTree } from '@/lib/analysis-data';

/**
 * Effektiver Kontosaldo: entweder der Live-Saldo der Bank (GoCardless-Sync)
 * oder der lokal aus Eröffnungssaldo + erfassten Transaktionen berechnete Wert.
 */
export type EffectiveBalance = { amount: number; source: 'bank' | 'local'; balanceType?: string };

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
