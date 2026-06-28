import type { LucideIcon } from "lucide-react";
import { BadgePercent, CalendarClock } from "lucide-react";
import type { Transaction } from "@/types";

// Bewusst nur Kennzahlen, die NICHT bereits in der festen Übersicht
// (TransactionStats: Kontostand, Einnahmen, Ausgaben, Saldo, Transaktionen)
// stehen – sonst doppelte Darstellung. KPIs liefern ergänzende Analytik.
export type KpiId =
  | "savings_rate"
  | "average_daily_expenses";

export type KpiComputeInput = {
  transactions: Transaction[];
};

export type KpiDefinition = {
  id: KpiId;
  label: string;
  description?: string;
  icon?: LucideIcon;
  compute: (input: KpiComputeInput) => number;
  format: (value: number) => string;
};

const fmtEUR0 = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const fmtPct1 = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 1,
});

function calcIncomeExpenses(transactions: Transaction[]) {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (t.amount > 0) income += t.amount;
    else expenses += Math.abs(t.amount);
  }
  return { income, expenses };
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "savings_rate",
    label: "Sparquote",
    description: "(Einnahmen - Ausgaben) / Einnahmen",
    icon: BadgePercent,
    compute: ({ transactions }) => {
      const { income, expenses } = calcIncomeExpenses(transactions);
      if (income <= 0) return 0;
      return (income - expenses) / income;
    },
    format: (v) => fmtPct1.format(v),
  },
  {
    id: "average_daily_expenses",
    label: "Ø Tagesausgaben",
    description: "Ausgaben / 30",
    icon: CalendarClock,
    compute: ({ transactions }) => {
      const { expenses } = calcIncomeExpenses(transactions);
      return expenses / 30;
    },
    format: (v) => fmtEUR0.format(v),
  },
];

export const DEFAULT_KPI_PREFS = {
  order: ["savings_rate", "average_daily_expenses"] as KpiId[],
  active: ["savings_rate", "average_daily_expenses"] as KpiId[],
};

export const KPI_BY_ID: Record<KpiId, KpiDefinition> = KPI_DEFINITIONS.reduce(
  (acc, k) => {
    acc[k.id] = k;
    return acc;
  },
  {} as Record<KpiId, KpiDefinition>
);
