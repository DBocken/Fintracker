import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showSuccess, showError } from "@/utils/toast";
import { getAccounts } from "@/services/account-service";
import { recordCashWithdrawal } from "@/services/cash-service";
import type { Account } from "@/types";

interface CashWithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashAccountId: string;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function CashWithdrawalDialog({ open, onOpenChange, cashAccountId }: CashWithdrawalDialogProps) {
  const queryClient = useQueryClient();
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    enabled: open,
  });

  const sourceAccounts = accounts.filter((a) => a.id !== cashAccountId && a.type !== "cash");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(today());
    setSourceAccountId(sourceAccounts[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accounts.length]);

  const mutation = useMutation({
    mutationFn: () =>
      recordCashWithdrawal({
        sourceAccountId,
        cashAccountId,
        amount: parseFloat(amount.replace(",", ".")) || 0,
        date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
      showSuccess("Abhebung erfasst");
      onOpenChange(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bargeld abheben</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bucht den Betrag vom Quellkonto ab und aufs Bargeld-Konto gut – als interner Übertrag,
            der nicht als Ausgabe zählt.
          </p>

          <div className="space-y-1.5">
            <Label>Von Konto</Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Konto auswählen" />
              </SelectTrigger>
              <SelectContent>
                {sourceAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.icon} {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wd-amount">Betrag (€)</Label>
              <Input
                id="wd-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wd-date">Datum</Label>
              <Input id="wd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !sourceAccountId}>
            Abheben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
