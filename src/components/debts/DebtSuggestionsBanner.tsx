import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { detectPotentialDebts, type DebtSuggestion } from "@/services/debt-detection-service";
import type { Debt } from "@/types";
import { useI18n } from "@/i18n/useI18n";

const DISMISS_PREFIX = "debt-suggestion-dismissed:";

interface DebtSuggestionsBannerProps {
  onAdopt: (prefill: Partial<Debt>) => void;
}

export function DebtSuggestionsBanner({ onAdopt }: DebtSuggestionsBannerProps) {
  const { t } = useI18n();
  const { data: allSuggestions = [] } = useQuery<DebtSuggestion[]>({
    queryKey: ["debt-suggestions"],
    queryFn: detectPotentialDebts,
  });

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const set = new Set<string>();
    allSuggestions.forEach((s) => {
      if (localStorage.getItem(`${DISMISS_PREFIX}${s.key}`) === "1") {
        set.add(s.key);
      }
    });
    return set;
  });

  const suggestions = useMemo(
    () => allSuggestions.filter((s) => !dismissed.has(s.key)),
    [allSuggestions, dismissed]
  );

  const handleDismiss = (key: string) => {
    localStorage.setItem(`${DISMISS_PREFIX}${key}`, "1");
    setDismissed((prev) => new Set(prev).add(key));
  };

  const handleAdopt = (s: DebtSuggestion) => {
    onAdopt({
      name: s.payee,
      type: s.suggestedType,
      provider: s.payee,
      priority: s.suggestedPriority,
      is_bnpl: s.kind === "bnpl_recurring",
    });
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4">
      <Alert>
        <AlertTitle>{t('debts.suggestionsBanner.title')}</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            {t('debts.suggestionsBanner.message').replace('{count}', String(suggestions.length))}
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm">{s.description}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => handleAdopt(s)}>
                    {t('debts.suggestionsBanner.adopt')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(s.key)}>
                    {t('debts.suggestionsBanner.dismiss')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
