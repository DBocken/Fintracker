import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showSuccess, showError } from "@/utils/toast";
import { getAccounts } from "@/services/account-service";
import { createTransaction, getCategories } from "@/services/transaction-service";
import { useI18n } from "@/i18n/useI18n";
import type { Account, Category } from "@/types";

export interface TransactionPrefill {
  accountId?: string | null;
  direction?: "expense" | "income";
  amount?: number;
  date?: string;
  payee?: string;
  description?: string;
  categoryId?: string | null;
}

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: TransactionPrefill | null;
  /** Vorausgewähltes Konto (z. B. Bargeld-Konto) als Fallback. */
  defaultAccountId?: string | null;
  title?: string;
  onSaved?: () => void;
}

const NO_CATEGORY = "__none__";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  prefill,
  defaultAccountId,
  title,
  onSaved,
}: TransactionFormDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    enabled: open,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: open,
  });

  const [accountId, setAccountId] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);

  useEffect(() => {
    if (!open) return;
    setDirection(prefill?.direction ?? "expense");
    setAmount(prefill?.amount != null ? String(prefill.amount) : "");
    setDate(prefill?.date ?? today());
    setPayee(prefill?.payee ?? "");
    setDescription(prefill?.description ?? "");
    setCategoryId(prefill?.categoryId ?? NO_CATEGORY);
    setAccountId(prefill?.accountId ?? defaultAccountId ?? "");
  }, [open, prefill, defaultAccountId]);

  // Fällt das Konto erst nach dem Laden ein, sinnvoll vorbelegen.
  useEffect(() => {
    if (open && !accountId && accounts.length > 0) {
      setAccountId(defaultAccountId ?? accounts[0].id);
    }
  }, [open, accountId, accounts, defaultAccountId]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [categories],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const numeric = Math.abs(parseFloat(amount.replace(",", ".")) || 0);
      if (numeric <= 0) throw new Error(t("forms.amountGreaterThanZero", "Bitte einen Betrag größer 0 angeben."));
      if (!accountId) throw new Error(t("forms.selectAccountRequired", "Bitte ein Konto auswählen."));
      const signed = direction === "expense" ? -numeric : numeric;
      return createTransaction({
        account_id: accountId,
        date,
        amount: signed,
        payee: payee.trim() || (direction === "expense" ? "Barausgabe" : "Geldeingang"),
        description: description.trim(),
        category_id: categoryId === NO_CATEGORY ? null : categoryId,
        confirmed: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["financial-health"] });
      queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      showSuccess(t("dashboard.updateSuccess", "Buchung gespeichert"));
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("forms.addTransaction", "Buchung hinzufügen")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as "expense" | "income")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">Ausgabe</TabsTrigger>
              <TabsTrigger value="income">Einnahme</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label>Konto</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t("forms.selectAccountPlaceholder", "Konto auswählen")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.icon} {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Betrag (€)</Label>
              <Input
                id="tx-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Datum</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-payee">Empfänger / Händler</Label>
            <Input
              id="tx-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="z. B. Friseur Schmidt"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Verwendungszweck (optional)</Label>
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z. B. Haarschnitt"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategorie (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t("forms.selectCategoryPlaceholder", "Kategorie auswählen")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>— Keine —</SelectItem>
                {sortedCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
