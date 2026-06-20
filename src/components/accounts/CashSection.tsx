import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Camera, Minus, Plus, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import { getAccounts, createAccount } from "@/services/account-service";
import { getTransactions } from "@/services/transaction-service";
import { getNetWorthBreakdown } from "@/services/net-worth-service";
import { detectCashWithdrawals, findCashAccount, moveWithdrawalToCash } from "@/services/cash-service";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import { ReceiptScanDialog } from "@/components/transactions/ReceiptScanDialog";
import { CashWithdrawalDialog } from "./CashWithdrawalDialog";
import type { Account, Transaction } from "@/types";

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export function CashSection() {
  const queryClient = useQueryClient();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });
  const cashAccount = findCashAccount(accounts);

  const { data: netWorth } = useQuery({
    queryKey: ["net-worth"],
    queryFn: getNetWorthBreakdown,
    enabled: !!cashAccount,
  });
  const cashBalance = cashAccount ? netWorth?.accountBalances[cashAccount.id] ?? 0 : 0;

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", "cash-atm"],
    queryFn: () => getTransactions(500),
    enabled: !!cashAccount,
  });
  const atmSuggestions = cashAccount ? detectCashWithdrawals(transactions, cashAccount.id) : [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
  };

  const createCashMutation = useMutation({
    mutationFn: () => createAccount({ name: "Bargeld", type: "cash", is_budget_pool_member: false }),
    onSuccess: () => {
      invalidate();
      showSuccess("Bargeld-Konto angelegt");
    },
    onError: (e: Error) => showError(e.message),
  });

  const moveToCashMutation = useMutation({
    mutationFn: (giroTransaction: Transaction) =>
      moveWithdrawalToCash({ giroTransaction, cashAccountId: cashAccount!.id }),
    onSuccess: () => {
      invalidate();
      showSuccess("Abhebung ins Bargeld-Konto übernommen");
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Bargeld
            </CardTitle>
            <CardDescription>
              {cashAccount
                ? `Aktueller Bargeld-Bestand: ${eur.format(cashBalance)}`
                : "Lege ein Bargeld-Konto an, um Abhebungen und Barausgaben zu tracken."}
            </CardDescription>
          </div>
          {cashAccount ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
                <Camera className="mr-1.5 h-4 w-4" />
                Beleg scannen
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                Abheben
              </Button>
              <Button size="sm" onClick={() => setExpenseOpen(true)}>
                <Minus className="mr-1.5 h-4 w-4" />
                Barausgabe
              </Button>
            </div>
          ) : (
            <Button onClick={() => createCashMutation.mutate()} disabled={createCashMutation.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              Bargeld-Konto anlegen
            </Button>
          )}
        </div>
      </CardHeader>

      {cashAccount && atmSuggestions.length > 0 && (
        <CardContent>
          <div className="rounded-lg border border-dashed p-3">
            <div className="mb-2 text-sm font-medium">
              {atmSuggestions.length} mögliche Abhebung{atmSuggestions.length === 1 ? "" : "en"} erkannt
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Diese Abbuchungen sehen nach Bargeldabhebungen aus. Übernimm sie ins Bargeld-Konto,
              damit dein Bestand stimmt.
            </p>
            <div className="space-y-2">
              {atmSuggestions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.payee || t.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("de-DE")} · {eur.format(Math.abs(t.amount))}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveToCashMutation.mutate(t)}
                    disabled={moveToCashMutation.isPending}
                  >
                    Übernehmen
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}

      {cashAccount && (
        <>
          <TransactionFormDialog
            open={expenseOpen}
            onOpenChange={setExpenseOpen}
            defaultAccountId={cashAccount.id}
            prefill={{ accountId: cashAccount.id, direction: "expense" }}
            title="Barausgabe erfassen"
          />
          <CashWithdrawalDialog
            open={withdrawOpen}
            onOpenChange={setWithdrawOpen}
            cashAccountId={cashAccount.id}
          />
          <ReceiptScanDialog open={scanOpen} onOpenChange={setScanOpen} cashAccountId={cashAccount.id} />
        </>
      )}
    </Card>
  );
}
