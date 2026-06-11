import type { LucideIcon } from "lucide-react";
import { Activity, BadgePercent, ArrowLeftRight } from "lucide-react";
import type { Transaction } from "@/types";

export type KpiId =
  | "net_cashflow"
  | "savings_rate"
  | "transactions_count"
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

const fmtInt = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

function calcIncomeExpenses(transactions: Transaction[]) {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.amount > 0) income += t.amount;
    else expenses += Math.abs(t.amount);
  }
  return { income, expenses };
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "net_cashflow",
    label: "Netto-Cashflow",
    description: "Einnahmen minus Ausgaben",
    icon: ArrowLeftRight,
    compute: ({ transactions }) => {
      const { income, expenses } = calcIncomeExpenses(transactions);
      return income - expenses;
    },
    format: (v) => fmtEUR0.format(v),
  },
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
    id: "transactions_count",
    label: "Transaktionen",
    icon: Activity,
    compute: ({ transactions }) => transactions.length,
    format: (v) => fmtInt.format(v),
  },
  {
    id: "average_daily_expenses",
    label: "Ø Tagesausgaben",
    description: "Ausgaben / 30 (vorbereitet)",
    compute: ({ transactions }) => {
      const { expenses } = calcIncomeExpenses(transactions);
      return expenses / 30;
    },
    format: (v) => fmtEUR0.format(v),
  },
];

export const DEFAULT_KPI_PREFS = {
  order: ["net_cashflow", "savings_rate", "transactions_count"] as KpiId[],
  active: ["net_cashflow", "savings_rate", "transactions_count"] as KpiId[],
};

export const KPI_BY_ID: Record<KpiId, KpiDefinition> = KPI_DEFINITIONS.reduce(
  (acc, k) => {
    acc[k.id] = k;
    return acc;
  },
  {} as Record<KpiId, KpiDefinition>
);
