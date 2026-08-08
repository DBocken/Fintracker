import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/common/DecimalInput";
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
import { TaxCategorySelect } from "@/components/tax/TaxCategorySelect";
import FinanceErrorState from "@/components/common/FinanceErrorState";
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

  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    enabled: open,
  });
  const {
    data: categories = [],
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: open,
  });

  const [accountId, setAccountId] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [taxCategoryId, setTaxCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDirection(prefill?.direction ?? "expense");
    setAmount(prefill?.amount ?? null);
    setDate(prefill?.date ?? today());
    setPayee(prefill?.payee ?? "");
    setDescription(prefill?.description ?? "");
    setCategoryId(prefill?.categoryId ?? NO_CATEGORY);
    setTaxCategoryId(null);
    setAccountId(prefill?.accountId ?? defaultAccountId ?? "");
  }, [open, prefill, defaultAccountId]);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Steuer-Rubrik aus dem Default der gewählten Kategorie vorbelegen (Vorschlag,
  // nie erzwungen — der Nutzer kann sie im Select ändern oder entfernen).
  useEffect(() => {
    if (categoryId === NO_CATEGORY) return;
    const def = categoriesById.get(categoryId)?.attributes?.default_tax_category_id ?? null;
    setTaxCategoryId(def);
  }, [categoryId, categoriesById]);

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
      // Der Betrag kommt als ZAHL aus <DecimalInput>. Frueher stand hier
      // `parseGermanNumber` auf einem `type="number"`-Feld — das half nichts,
      // weil der Browser das Komma schon geschluckt hatte und aus „12,50" der
      // Wert „1250" wurde (F-MONEY-1).
      const numeric = amount === null ? 0 : Math.abs(amount);
      if (numeric <= 0) throw new Error(t("forms.amountGreaterThanZero"));
      if (!accountId) throw new Error(t("forms.selectAccountRequired"));
      const signed = direction === "expense" ? -numeric : numeric;
      return createTransaction({
        account_id: accountId,
        date,
        amount: signed,
        payee: payee.trim() || (direction === "expense" ? t("transactions.cashExpense") : t("transactions.moneyIncome")),
        description: description.trim(),
        category_id: categoryId === NO_CATEGORY ? null : categoryId,
        // Steuer-Markierung nur bei Ausgaben übernehmen.
        tax_category_id: direction === "expense" ? taxCategoryId : null,
        confirmed: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["financial-health"] });
      queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      showSuccess(t("forms.addTransaction"));
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => showError(e.message),
  });

  const hasLoadError = accountsError || categoriesError;
  const retryAll = () => {
    void refetchAccounts();
    void refetchCategories();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("forms.addTransaction")}</DialogTitle>
        </DialogHeader>

        {hasLoadError && <FinanceErrorState variant="data" onRetry={retryAll} />}

        <div className="space-y-4">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as "expense" | "income")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">{t("forms.expenseLabel")}</TabsTrigger>
              <TabsTrigger value="income">{t("forms.incomeLabel")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label>{t("forms.accountLabel")}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger aria-label={t("forms.accountLabel")}>
                <SelectValue placeholder={t("forms.selectAccountPlaceholder")} />
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
              <Label htmlFor="tx-amount">{t("forms.amountLabel")}</Label>
              <DecimalInput
                id="tx-amount"
                value={amount}
                onChange={setAmount}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">{t("forms.dateLabel")}</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-payee">{t("forms.payeeLabel")}</Label>
            <Input
              id="tx-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder={t("forms.payeeExample")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">{t("forms.descriptionLabel")}</Label>
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("forms.descriptionExample")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("forms.categoryLabel")}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger aria-label={t("forms.categoryLabel")}>
                <SelectValue placeholder={t("forms.selectCategoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>{t("forms.noCategoryOption")}</SelectItem>
                {sortedCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {direction === "expense" && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-tax-category">{t("tax.form.sectionTitle", "Steuer")}</Label>
              <TaxCategorySelect
                id="tx-tax-category"
                className="w-full"
                value={taxCategoryId}
                onChange={setTaxCategoryId}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("forms.cancelButton")}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {t("forms.saveButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
