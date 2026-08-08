import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/common/DecimalInput";
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
import { useI18n } from "@/i18n/useI18n";
import { getAccounts } from "@/services/account-service";
import { recordCashWithdrawal } from "@/services/cash-service";
import FinanceErrorState from "@/components/common/FinanceErrorState";
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today());

  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    enabled: open,
  });

  const sourceAccounts = accounts.filter((a) => a.id !== cashAccountId && a.type !== "cash");

  useEffect(() => {
    if (!open) return;
    setAmount(null);
    setDate(today());
    setSourceAccountId(sourceAccounts[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accounts.length]);

  const mutation = useMutation({
    mutationFn: () =>
      recordCashWithdrawal({
        sourceAccountId,
        cashAccountId,
        amount: amount ?? 0,
        date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
      showSuccess(t('accounts.cashWithdrawal.withdrawSuccess'));
      onOpenChange(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('accounts.cashWithdrawal.title')}</DialogTitle>
        </DialogHeader>

        {accountsError && <FinanceErrorState variant="data" onRetry={() => void refetchAccounts()} />}

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('accounts.cashWithdrawal.description')}
          </p>

          <div className="space-y-1.5">
            <Label>{t('accounts.cashWithdrawal.fromAccount')}</Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger aria-label={t('accounts.cashWithdrawal.fromAccount')}>
                <SelectValue placeholder={t('accounts.cashWithdrawal.fromAccountPlaceholder')} />
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
              <Label htmlFor="wd-amount">{t('accounts.cashWithdrawal.amountLabel')}</Label>
              <DecimalInput
                id="wd-amount"
                value={amount}
                onChange={setAmount}
                placeholder={t('accounts.cashWithdrawal.amountPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wd-date">{t('accounts.cashWithdrawal.dateLabel')}</Label>
              <Input id="wd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('accounts.cashWithdrawal.cancelButton')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !sourceAccountId}>
            {t('accounts.cashWithdrawal.withdrawButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
