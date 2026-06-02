"use client";

import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Lightbulb } from "lucide-react";
import { dyadProps } from "@/lib/dyad";

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
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const items = [
    {
      icon: TrendingDown,
      label: "Größte Ausgabe",
      value: fmtEUR0.format(topExpense?.amount || 0),
      detail: topExpense?.name || "Keine Daten",
    },
    {
      icon: TrendingUp,
      label: "Höchste Einnahme",
      value: fmtEUR0.format(topIncome?.amount || 0),
      detail: topIncome?.name || "Keine Daten",
    },
    {
      icon: Lightbulb,
      label: "Sparquote",
      value: `${savingsRate.toFixed(1)}%`,
      detail: savingsRate >= 0 ? "Positiv" : "Negativ",
    },
  ];

  return (
    <div {...dyadProps("SmartInsightsPanel")} className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {items.map((it) => (
        <Card key={it.label} className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">{it.label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{it.value}</div>
              <div className="mt-2 text-xs text-muted-foreground truncate">{it.detail}</div>
            </div>
            <div className="shrink-0 rounded-md border bg-background p-2 text-muted-foreground">
              <it.icon className="h-4 w-4" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}