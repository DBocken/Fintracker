import { Plus, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import type { BudgetSuggestion } from "@/types";
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface SuggestedBudgetsProps {
  suggestions: BudgetSuggestion[];
  onAdd: (suggestion: BudgetSuggestion) => void;
  isLoading?: boolean;
}

/**
 * Vorgeschlagene Budgets für Hauptkategorien (auf Basis des Durchschnitts der
 * letzten Monate). Ein Klick legt das Budget mit dem vorgeschlagenen Limit an.
 */
export default function SuggestedBudgets({ suggestions, onAdd, isLoading }: SuggestedBudgetsProps) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4 text-brand" />
          {t('budgets.suggestedBudgets.title')}
        </CardTitle>
        <CardDescription>
          {t('budgets.suggestedBudgets.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Button
            key={s.category_id}
            variant="outline"
            size="sm"
            className="h-auto py-2"
            disabled={isLoading}
            onClick={() => onAdd(s)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            <span className="font-medium">
              {s.icon ? `${s.icon} ` : ""}
              {s.name}
            </span>
            <span className="ml-1.5 text-muted-foreground">{money.mask(eur.format(s.limit))}{t('budgets.suggestedBudgets.perMonth')}</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
