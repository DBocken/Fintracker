import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { updateTransaction } from "@/services/transaction-service";
import { upsertContractDecision } from "@/services/contract-decision-service";
import { showSuccess, showError } from "@/utils/toast";
import type { ContractRow } from "./contract-types";
import { mapCycleToRhythmus } from "./contract-types";

const DISMISS_PREFIX = "contract-suggestion-dismissed:";

interface ContractSuggestionsBannerProps {
  rows: ContractRow[];
}

/**
 * Vorschlagsliste für mögliche Verträge. Zeigt wiederkehrende Zahlungen, die
 * noch nicht als Vertrag bestätigt wurden. Beim Bestätigen werden alle
 * zugehörigen Buchungen als Vertrag markiert; beim Ablehnen verschwindet der
 * Vorschlag dauerhaft. In beiden Fällen ist er danach aus der Liste raus.
 */
export function ContractSuggestionsBanner({ rows }: ContractSuggestionsBannerProps) {
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
      if (row.status !== "candidate") return false; // nur noch unentschiedene Kandidaten
      if (row.confirmed) return false; // bereits bestätigt → nicht mehr vorschlagen
      if (row.cycle === "Unbekannt") return false;
      if (row.transactionIds.length === 0) return false;
      return true;
    });
  }, [rows, dismissed]);

  const confirmMutation = useMutation({
    mutationFn: async (row: ContractRow) => {
      const cycle = mapCycleToRhythmus(row.cycle);
      await updateTransaction(
        row.transactionIds.map((id) => ({ id, is_contract: true, contract_cycle: cycle }))
      );
      // Dauerhafte Entscheidung an die Händlerfamilie binden (überlebt Re-Ableitung).
      await upsertContractDecision(row.fingerprint, { status: "active", cycle_override: cycle });
    },
    onSuccess: (_data, row) => {
      showSuccess(`„${row.payee}" als Vertrag bestätigt`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions", "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract-decisions"] });
    },
    onError: () => showError("Fehler beim Bestätigen des Vertrags"),
  });

  const dismissMutation = useMutation({
    mutationFn: (row: ContractRow) => upsertContractDecision(row.fingerprint, { status: "rejected" }),
    onSuccess: (_data, row) => {
      localStorage.setItem(`${DISMISS_PREFIX}${row.key}`, "1");
      setDismissed((prev) => new Set(prev).add(row.key));
      queryClient.invalidateQueries({ queryKey: ["contract-decisions"] });
    },
    onError: () => showError("Fehler beim Ablehnen"),
  });

  if (suggestions.length === 0) return null;

  return (
    <Card className="mb-4 border-brand/40">
      <CardHeader>
        <CardTitle className="text-base">Mögliche Verträge</CardTitle>
        <CardDescription>
          {suggestions.length} wiederkehrende Zahlung{suggestions.length === 1 ? "" : "en"} erkannt.
          Bestätige sie als Vertrag oder lehne den Vorschlag ab – danach verschwindet er aus dieser Liste.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {suggestions.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <span className="text-sm">
                <Badge variant={row.type === "Einnahme" ? "secondary" : "outline"} className="mr-2">
                  {row.type}
                </Badge>
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
                  onClick={() => confirmMutation.mutate(row)}
                  disabled={confirmMutation.isPending}
                >
                  <Check className="mr-1 h-4 w-4" aria-hidden="true" /> Bestätigen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissMutation.mutate(row)}
                  disabled={dismissMutation.isPending}
                >
                  <X className="mr-1 h-4 w-4" aria-hidden="true" /> Ablehnen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
