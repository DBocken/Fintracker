import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { updateCategory } from "@/services/transaction-service";
import { showSuccess, showError } from "@/utils/toast";
import type { Category } from "@/types";
import type { ContractRow } from "./contract-types";
import { mapCycleToRhythmus } from "./contract-types";
import { parseISO } from "date-fns";

const DISMISS_PREFIX = "contract-suggestion-dismissed:";

interface ContractSuggestionsBannerProps {
  rows: ContractRow[];
  categoryMap: Map<string, Category>;
}

export function ContractSuggestionsBanner({ rows, categoryMap }: ContractSuggestionsBannerProps) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (localStorage.getItem(`${DISMISS_PREFIX}${row.key}`) === "1") {
        set.add(row.key);
      }
    });
    return set;
  });

  const suggestions = useMemo(() => {
    return rows.filter((row) => {
      if (dismissed.has(row.key)) return false;
      if (row.cycle === "Unbekannt") return false;
      if (!row.categoryId) return false;
      const cat = categoryMap.get(row.categoryId);
      if (!cat) return false;
      if (cat.attributes?.ist_vertrag) return false;
      return true;
    });
  }, [rows, categoryMap, dismissed]);

  const markAsContractMutation = useMutation({
    mutationFn: (row: ContractRow) => {
      const cat = categoryMap.get(row.categoryId!)!;
      return updateCategory({
        ...cat,
        attributes: {
          ...cat.attributes,
          ist_vertrag: true,
          rhythmus: mapCycleToRhythmus(row.cycle),
          faelligkeitstag: row.nextDateISO ? parseISO(row.nextDateISO).getDate() : null,
          next_due_date: row.nextDateISO,
        },
      });
    },
    onSuccess: () => {
      showSuccess("Als Vertrag markiert");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions", "contracts"] });
    },
    onError: () => showError("Fehler beim Markieren als Vertrag"),
  });

  const handleDismiss = (key: string) => {
    localStorage.setItem(`${DISMISS_PREFIX}${key}`, "1");
    setDismissed((prev) => new Set(prev).add(key));
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4">
      <Alert>
        <AlertTitle>Potenzielle Verträge erkannt</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Wir haben {suggestions.length} wiederkehrende Zahlung{suggestions.length === 1 ? "" : "en"} erkannt,
            die noch nicht als Vertrag markiert {suggestions.length === 1 ? "ist" : "sind"}.
          </p>
          <ul className="space-y-2">
            {suggestions.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm">
                  <span className="font-medium">{row.payee}</span> · {row.categoryName} · {row.cycle} ·{" "}
                  {row.amountTypical.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => markAsContractMutation.mutate(row)}
                    disabled={markAsContractMutation.isPending}
                  >
                    Als Vertrag markieren
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(row.key)}>
                    Ignorieren
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
