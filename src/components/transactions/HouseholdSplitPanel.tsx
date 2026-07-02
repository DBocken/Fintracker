import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { showSuccess, showError } from "@/utils/toast";
import {
  getHouseholds,
  getHouseholdMembers,
  getSharedExpenseSplit,
  upsertSharedExpenseSplit,
  deleteSharedExpenseSplit,
  splitEqually,
  type SharedExpenseShare,
} from "@/services/household-service";
import type { Transaction } from "@/types";
import { parseGermanNumber } from "@/lib/money";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
// Zentraler Parser (money.ts): korrekter Tausenderpunkt (F-MONEY-1/-6).
const parseAmount = (v: string) => parseGermanNumber(v) ?? 0;

/**
 * Haushalts-Split (Issue #108): teilt EINE Ausgabe auf die Mitglieder eines
 * Haushalts auf. Lokal persistiert (household-service). Minimaler vertikaler
 * Slice zur Validierung des Datenmodells — Auswahl Haushalt → Beträge je
 * Mitglied (Default gleichmäßig) → speichern/entfernen.
 */
export function HouseholdSplitPanel({ transaction }: { transaction: Transaction }) {
  const qc = useQueryClient();
  const txId = transaction.id ?? "";
  const total = Math.abs(transaction.amount);

  const { data: households = [] } = useQuery({ queryKey: ["households"], queryFn: getHouseholds });
  const { data: existing } = useQuery({
    queryKey: ["shared-split", txId],
    queryFn: () => getSharedExpenseSplit(txId),
    enabled: !!txId,
  });

  const [householdId, setHouseholdId] = useState("");
  useEffect(() => {
    if (existing?.household_id) setHouseholdId(existing.household_id);
  }, [existing]);

  const { data: members = [] } = useQuery({
    queryKey: ["household-members", householdId],
    queryFn: () => getHouseholdMembers(householdId),
    enabled: !!householdId,
  });

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!householdId || members.length === 0) return;
    const map: Record<string, string> = {};
    if (existing && existing.household_id === householdId) {
      for (const m of members) {
        map[m.id] = (existing.shares.find((s) => s.member_id === m.id)?.amount ?? 0).toFixed(2);
      }
    } else {
      for (const s of splitEqually(total, members.map((m) => m.id))) map[s.member_id] = s.amount.toFixed(2);
    }
    setAmounts(map);
  }, [householdId, members, existing, total]);

  const sum = useMemo(
    () => members.reduce((s, m) => s + parseAmount(amounts[m.id] ?? ""), 0),
    [members, amounts],
  );
  const balanced = Math.abs(sum - total) < 0.01;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const shares: SharedExpenseShare[] = members.map((m) => ({
        member_id: m.id,
        amount: parseAmount(amounts[m.id] ?? ""),
      }));
      return upsertSharedExpenseSplit({ transaction_id: txId, household_id: householdId, shares });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shared-split", txId] });
      showSuccess("Aufteilung gespeichert");
    },
    onError: (e: Error) => showError(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteSharedExpenseSplit(txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shared-split", txId] });
      setHouseholdId("");
      setAmounts({});
      showSuccess("Aufteilung entfernt");
    },
  });

  if (households.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Lege zuerst einen Haushalt in den{" "}
        <Link to="/settings" className="underline underline-offset-2">
          Einstellungen
        </Link>{" "}
        an.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">Haushalt</span>
        <Select value={householdId} onValueChange={setHouseholdId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Haushalt wählen" />
          </SelectTrigger>
          <SelectContent>
            {households.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {householdId && members.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Dieser Haushalt hat noch keine Mitglieder – lege sie in den Einstellungen an.
        </p>
      )}

      {householdId && members.length > 0 && (
        <>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                <Input
                  inputMode="decimal"
                  className="h-8 w-24 text-right tabular-nums"
                  value={amounts[m.id] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [m.id]: e.target.value }))}
                  aria-label={`Anteil ${m.name}`}
                />
              </li>
            ))}
          </ul>

          <div className={`flex justify-between text-xs ${balanced ? "text-muted-foreground" : "text-warning"}`}>
            <span>Summe der Anteile</span>
            <span className="tabular-nums">
              {eur.format(sum)} / {eur.format(total)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!balanced || saveMutation.isPending}>
              Aufteilung speichern
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAmounts(
                  Object.fromEntries(
                    splitEqually(total, members.map((m) => m.id)).map((s) => [s.member_id, s.amount.toFixed(2)]),
                  ),
                )
              }
            >
              Gleich aufteilen
            </Button>
            {existing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
                aria-label="Aufteilung entfernen"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
