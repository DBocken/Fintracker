import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Camera, Minus, Plus, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import { useI18n } from "@/i18n/useI18n";
import FinanceErrorState from "@/components/common/FinanceErrorState";
import { getAccounts, createAccount } from "@/services/account-service";
import { getTransactions } from "@/services/transaction-service";
import { getNetWorthBreakdown } from "@/services/net-worth-service";
import { detectCashWithdrawals, findCashAccount, moveWithdrawalToCash } from "@/services/cash-service";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import { ReceiptScanDialog } from "@/components/transactions/ReceiptScanDialog";
import { CashWithdrawalDialog } from "./CashWithdrawalDialog";
import type { Account, Transaction } from "@/types";
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export function CashSection() {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });
  const cashAccount = findCashAccount(accounts);

  const {
    data: netWorth,
    isError: netWorthError,
    refetch: refetchNetWorth,
  } = useQuery({
    queryKey: ["net-worth"],
    queryFn: getNetWorthBreakdown,
    enabled: !!cashAccount,
  });
  const cashBalance = cashAccount ? netWorth?.accountBalances[cashAccount.id] ?? 0 : 0;

  const {
    data: transactions = [],
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery<Transaction[]>({
    queryKey: ["transactions", "cash-atm"],
    queryFn: () => getTransactions(500),
    enabled: !!cashAccount,
  });
  const atmSuggestions = cashAccount ? detectCashWithdrawals(transactions, cashAccount.id) : [];

  const hasLoadError = accountsError || netWorthError || transactionsError;
  const retryAll = () => {
    void refetchAccounts();
    void refetchNetWorth();
    void refetchTransactions();
  };

  // Reines Konto-Anlegen betrifft keine Buchung — nur ['accounts']/['net-worth']/
  // ['has-finance-data'] werden hier tatsächlich wieder gültig. Eine
  // Root-Invalidierung von ['transactions'] träfe unnötig BEIDE Großqueries
  // (['transactions', 5000] und ['transactions', 1000], PERF-2).
  const invalidateAfterAccountOnlyChange = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
  };

  // moveWithdrawalToCash legt eine neue Buchung an (gespiegelte Gutschrift)
  // und verknüpft sie mit der Giro-Abhebung — hier bleibt die
  // ['transactions']-Root-Invalidierung richtig.
  const invalidateAfterTransactionChange = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    queryClient.invalidateQueries({ queryKey: ["has-finance-data"] });
  };

  const createCashMutation = useMutation({
    mutationFn: () => createAccount({ name: "Bargeld", type: "cash", is_budget_pool_member: false }),
    onSuccess: () => {
      invalidateAfterAccountOnlyChange();
      showSuccess(t('accounts.cashSection.cashAccountCreated'));
    },
    onError: (e: Error) => showError(e.message),
  });

  const moveToCashMutation = useMutation({
    mutationFn: (giroTransaction: Transaction) =>
      moveWithdrawalToCash({ giroTransaction, cashAccountId: cashAccount!.id }),
    onSuccess: () => {
      invalidateAfterTransactionChange();
      showSuccess(t('accounts.cashSection.atmAccepted'));
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
              {t('accounts.cashSection.title')}
            </CardTitle>
            <CardDescription>
              {cashAccount
                ? t('accounts.cashSection.currentBalance').replace('{amount}', money.mask(eur.format(cashBalance)))
                : t('accounts.cashSection.emptyDesc')}
            </CardDescription>
          </div>
          {cashAccount ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
                <Camera className="mr-1.5 h-4 w-4" />
                {t('accounts.cashSection.scanReceipt')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                {t('accounts.cashSection.withdraw')}
              </Button>
              <Button size="sm" onClick={() => setExpenseOpen(true)}>
                <Minus className="mr-1.5 h-4 w-4" />
                {t('accounts.cashSection.addExpense')}
              </Button>
            </div>
          ) : (
            <Button onClick={() => createCashMutation.mutate()} disabled={createCashMutation.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('accounts.cashSection.createCashAccount')}
            </Button>
          )}
        </div>
      </CardHeader>

      {hasLoadError && <CardContent><FinanceErrorState variant="data" onRetry={retryAll} /></CardContent>}

      {!hasLoadError && (
        <>
          {cashAccount && atmSuggestions.length > 0 && (
            <CardContent>
              <div className="rounded-lg border border-dashed p-3">
                <div className="mb-2 text-sm font-medium">
                  {t('accounts.cashSection.atmSuggestionsTitle')
                    .replace('{count}', atmSuggestions.length.toString())
                    .replace('{plural}', atmSuggestions.length === 1 ? '' : 'en')}
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('accounts.cashSection.atmSuggestionsDesc')}
                </p>
                <div className="space-y-2">
                  {atmSuggestions.slice(0, 5).map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{suggestion.payee || suggestion.description}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(suggestion.date).toLocaleDateString("de-DE")} · {money.mask(eur.format(Math.abs(suggestion.amount)))}
                        </span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moveToCashMutation.mutate(suggestion)}
                        disabled={moveToCashMutation.isPending}
                      >
                        {t('accounts.cashSection.atmAccept')}
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
                title={t('accounts.cashSection.recordExpenseTitle')}
              />
              <CashWithdrawalDialog
                open={withdrawOpen}
                onOpenChange={setWithdrawOpen}
                cashAccountId={cashAccount.id}
              />
              <ReceiptScanDialog open={scanOpen} onOpenChange={setScanOpen} cashAccountId={cashAccount.id} />
            </>
          )}
        </>
      )}
    </Card>
  );
}
