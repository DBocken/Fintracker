import { TrendingDown, TrendingUp, Lightbulb } from "lucide-react";
import { dyadProps } from "@/lib/dyad";
import { useI18n } from "@/i18n/useI18n";

interface SmartInsightsPanelProps {
  totalIncome: number;
  totalExpenses: number;
  topExpense: { name: string; amount: number };
  topIncome: { name: string; amount: number };
}

const fmtEUR0 = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function SmartInsightsPanel({ totalIncome, totalExpenses, topExpense, topIncome }: SmartInsightsPanelProps) {
  const { t } = useI18n();
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const items = [
    {
      icon: TrendingDown,
      label: t("premium.smartInsights.topExpense"),
      value: fmtEUR0.format(topExpense?.amount || 0),
      detail: topExpense?.name || t("premium.smartInsights.noData"),
    },
    {
      icon: TrendingUp,
      label: t("premium.smartInsights.topIncome"),
      value: fmtEUR0.format(topIncome?.amount || 0),
      detail: topIncome?.name || t("premium.smartInsights.noData"),
    },
    {
      icon: Lightbulb,
      label: t("premium.smartInsights.savingsRate"),
      value: `${savingsRate.toFixed(1)}%`,
      detail: savingsRate >= 0 ? t("premium.smartInsights.positive") : t("premium.smartInsights.negative"),
    },
  ];

  return (
    <div {...dyadProps("SmartInsightsPanel")} className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Karten-loses Readout (Usability-Audit „Karten sind Aktionen"): kein
          Rahmen/Schatten und kein verschachteltes Icon-Kästchen, das fälschlich
          klickbar wirkt. */}
      {items.map((it) => (
        <div key={it.label} className="rounded-xl bg-muted/30 p-5 md:p-6">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <it.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{it.label}</span>
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{it.value}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{it.detail}</div>
        </div>
      ))}
    </div>
  );
}