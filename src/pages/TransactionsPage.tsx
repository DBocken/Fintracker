import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TransactionDayList } from "@/components/dashboard/TransactionDayList";
import { TransactionStats } from "@/components/dashboard/TransactionStats";
import { TransactionFilters } from "@/components/dashboard/TransactionFilters";
import { TransactionDetailsModal } from "@/components/dashboard/TransactionDetailsModal";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";
import { useI18n } from "@/i18n/useI18n";
import {
  getTransactions,
  getCategories,
  deleteTransaction,
} from "@/services/transaction-service";
import { getAccounts } from "@/services/account-service";
import { getContractDecisionMap, type ContractDecision } from "@/services/contract-decision-service";
import {
  decodeDashboardFilters,
  encodeDashboardFilters,
  filterTransactions,
  type DashboardFilterState,
} from "@/components/dashboard/filter-utils";
import {
  DEFAULT_DASHBOARD_FILTERS,
  PERIOD_RANGES,
  DEFAULT_CUSTOM_GRANULARITY,
  type ContractFilter,
  type DashboardGranularity,
  type DashboardRange,
  type EssentialFilter,
  type AusgabenklasseFilter,
} from "@/components/dashboard/filter-constants";
import { listAvailablePeriods } from "@/components/dashboard/period-utils";
import { useTransactionDetailEditing } from "@/hooks/useTransactionDetailEditing";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import type { Transaction, Category, Account } from "@/types";

/**
 * Eigene Buchungsseite (Audit P1.2). Die Filter leben hier interaktiv – wie auf
 * dem Dashboard – und steuern die ganze Seite (Kennzahlen + Liste). Der Zustand
 * wird aus der URL vorbelegt (Deep-Link vom Dashboard) und bei jeder Änderung
 * zurückgespiegelt. Layout: volle Breite; die Tages-Gruppen fließen auf dem
 * Desktop horizontal in mehrere Spalten (statt einer langen Mobil-Kolumne). Das
 * Detail öffnet als Dialog (Desktop) bzw. Bottom-Sheet (Mobil) – kein zweiter,
 * verschachtelter Scrollbalken mehr.
 */
export default function TransactionsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<DashboardFilterState>(() => decodeDashboardFilters(searchParams));
  const [customGran, setCustomGran] = useState<DashboardGranularity>(DEFAULT_CUSTOM_GRANULARITY);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [hidden, toggleHidden] = usePersistedSet("transactions_hidden");

  // Filteränderungen in die URL spiegeln (replace, kein History-Spam pro Tastendruck).
  useEffect(() => {
    setSearchParams(encodeDashboardFilters(filters), { replace: true });
  }, [filters, setSearchParams]);

  const patchFilters = (patch: Partial<DashboardFilterState>) => setFilters((prev) => ({ ...prev, ...patch }));

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsTransaction(null);
  };

  const { data: txs = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", 5000],
    queryFn: () => getTransactions(5000),
  });
  const { data: cats = [] } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: getCategories });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: getAccounts });
  const { data: contractDecisions = new Map<string, ContractDecision>() } = useQuery({
    queryKey: ["contract-decisions"],
    queryFn: getContractDecisionMap,
  });

  const { save: saveDetails, isPending: detailsSaving } = useTransactionDetailEditing(txs, closeDetails);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("dashboard.transactionDeleted"));
    },
  });

  // Effektiver Saldo je Konto (Live-Saldo der Bank oder Eröffnungssaldo + lokale
  // Buchungen) – Anker für den rückwärts abgeleiteten Tages-Kontostand.
  const effectiveBalanceById = useMemo(() => {
    const local: Record<string, number> = {};
    for (const tx of txs) {
      if (!tx.account_id) continue;
      local[tx.account_id] = (local[tx.account_id] ?? 0) + (tx.amount || 0);
    }
    const map: Record<string, number> = {};
    for (const a of accounts) {
      map[a.id] =
        a.live_balance_amount !== null && a.live_balance_amount !== undefined
          ? Number(a.live_balance_amount) || 0
          : (a.opening_balance ?? 0) + (local[a.id] ?? 0);
    }
    return map;
  }, [txs, accounts]);

  const scopedCurrentBalance = useMemo(() => {
    if (filters.account === "all") {
      return accounts.reduce((sum, a) => sum + (effectiveBalanceById[a.id] ?? 0), 0);
    }
    if (filters.account === "budget-pool") {
      return accounts
        .filter((a) => a.is_budget_pool_member)
        .reduce((sum, a) => sum + (effectiveBalanceById[a.id] ?? 0), 0);
    }
    return effectiveBalanceById[filters.account] ?? 0;
  }, [accounts, effectiveBalanceById, filters.account]);

  const filtered = useMemo(() => {
    const list = filterTransactions(txs, cats, accounts, filters, new Date(), contractDecisions);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [txs, cats, accounts, filters, contractDecisions]);

  const visible = useMemo(() => filtered.filter((tx) => !hidden.has(tx.id || "")), [filtered, hidden]);

  // Inhalts-Filter verändern, WELCHE Buchungen erscheinen, nicht die echte
  // Kontobewegung. Der rückwärts abgeleitete Kontostand wäre dann irreführend →
  // Kopfzeile nur bei reinen Konto-/Zeitraum-Filtern zeigen.
  const hasContentFilter =
    filters.category !== DEFAULT_DASHBOARD_FILTERS.category ||
    filters.contract !== DEFAULT_DASHBOARD_FILTERS.contract ||
    filters.essential !== DEFAULT_DASHBOARD_FILTERS.essential ||
    filters.ausgabenklasse !== DEFAULT_DASHBOARD_FILTERS.ausgabenklasse ||
    filters.search.trim() !== "";

  // Anker am Ende des sichtbaren Fensters: heutiger Saldo minus alle konto-
  // bezogenen Buchungen NACH dem jüngsten sichtbaren Tag (relevant bei Zeitfilter).
  const endingBalance = useMemo(() => {
    const newestVisibleDate = visible[0]?.date;
    if (!newestVisibleDate) return scopedCurrentBalance;
    const inScope = (tx: Transaction) => {
      if (filters.account === "all") return true;
      if (filters.account === "budget-pool") {
        return !!tx.account_id && accounts.find((a) => a.id === tx.account_id)?.is_budget_pool_member === true;
      }
      return tx.account_id === filters.account;
    };
    const sumAfter = txs
      .filter((tx) => inScope(tx) && tx.date > newestVisibleDate)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    return scopedCurrentBalance - sumAfter;
  }, [visible, txs, accounts, filters.account, scopedCurrentBalance]);

  const stats = useMemo(() => {
    const flow = visible.filter((tx) => !tx.is_transfer);
    const income = flow.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = flow.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return { income, expenses, balance: income - expenses, count: visible.length };
  }, [visible]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category !== DEFAULT_DASHBOARD_FILTERS.category) count += 1;
    if (filters.account !== DEFAULT_DASHBOARD_FILTERS.account) count += 1;
    if (filters.contract !== DEFAULT_DASHBOARD_FILTERS.contract) count += 1;
    if (filters.essential !== DEFAULT_DASHBOARD_FILTERS.essential) count += 1;
    if (filters.ausgabenklasse !== DEFAULT_DASHBOARD_FILTERS.ausgabenklasse) count += 1;
    if (filters.range !== DEFAULT_DASHBOARD_FILTERS.range) count += 1;
    if (filters.search.trim() !== "") count += 1;
    return count;
  }, [filters]);

  const periodOptions = useMemo(
    () => (PERIOD_RANGES.has(filters.range) ? listAvailablePeriods(txs, filters.range) : []),
    [txs, filters.range],
  );

  const handleSetRange = (next: DashboardRange) => {
    if (PERIOD_RANGES.has(next)) {
      const opts = listAvailablePeriods(txs, next);
      patchFilters({ range: next, customPeriod: opts[0]?.value ?? "" });
    } else {
      patchFilters({ range: next, customPeriod: "" });
    }
  };

  const resetFilters = () => {
    setFilters({
      category: DEFAULT_DASHBOARD_FILTERS.category,
      account: DEFAULT_DASHBOARD_FILTERS.account,
      contract: DEFAULT_DASHBOARD_FILTERS.contract,
      essential: DEFAULT_DASHBOARD_FILTERS.essential,
      ausgabenklasse: DEFAULT_DASHBOARD_FILTERS.ausgabenklasse,
      search: DEFAULT_DASHBOARD_FILTERS.search,
      range: DEFAULT_DASHBOARD_FILTERS.range,
      customDays: DEFAULT_DASHBOARD_FILTERS.customDays,
      customPeriod: DEFAULT_DASHBOARD_FILTERS.customPeriod,
    });
    setCustomGran(DEFAULT_CUSTOM_GRANULARITY);
  };

  const formatBalance = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

  const openDetails = (tx: Transaction) => {
    setDetailsTransaction(tx);
    setDetailsOpen(true);
  };

  const emptyList = (
    <div className="space-y-4 py-8 text-center text-muted-foreground">
      <div>
        <div className="font-medium text-foreground">Keine Buchungen gefunden</div>
        <div className="text-sm">Passe Filter oder Suchbegriff an.</div>
      </div>
      {activeFilterCount > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
          Filter zurücksetzen
        </Button>
      )}
    </div>
  );

  return (
    <div className="w-full">
      <PageHeader
        title={t("transactions.title")}
        description={t("transactions.description")}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Buchung hinzufügen
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : txs.length === 0 ? (
        <FinanceEmptyState />
      ) : (
        <div className="space-y-5">
          {/* Filter-Leiste – steuert Kennzahlen + Liste (wie auf dem Dashboard). */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <input
                type="search"
                aria-label={t("transactions.search")}
                placeholder={t("transactions.search")}
                value={filters.search}
                onChange={(e) => patchFilters({ search: e.target.value })}
                className="h-11 w-full rounded-full border border-input bg-background/50 px-4 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative h-11"
              onClick={() => setFilterDialogOpen(true)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-2 h-5 min-w-5 justify-center px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
            <DialogContent className="flex max-h-[85dvh] flex-col overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Filter</DialogTitle>
              </DialogHeader>
              <TransactionFilters
                filterCat={filters.category}
                setFilterCat={(v) => patchFilters({ category: v })}
                filterAccount={filters.account}
                setFilterAccount={(v) => patchFilters({ account: v })}
                searchInput={filters.search}
                setSearchInput={(v) => patchFilters({ search: v })}
                range={filters.range}
                setRange={handleSetRange}
                customDays={filters.customDays}
                setCustomDays={(v) => patchFilters({ customDays: v })}
                customGran={customGran}
                setCustomGran={setCustomGran}
                customPeriod={filters.customPeriod ?? ""}
                setCustomPeriod={(v) => patchFilters({ customPeriod: v })}
                periodOptions={periodOptions}
                categories={cats}
                filterContract={filters.contract}
                setFilterContract={(v: ContractFilter) => patchFilters({ contract: v })}
                filterEssential={filters.essential}
                setFilterEssential={(v: EssentialFilter) => patchFilters({ essential: v })}
                filterAusgabenklasse={filters.ausgabenklasse}
                setFilterAusgabenklasse={(v: AusgabenklasseFilter) => patchFilters({ ausgabenklasse: v })}
                showSearch={false}
                stacked
              />
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  Filter zurücksetzen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <TransactionStats
            income={stats.income}
            expenses={stats.expenses}
            balance={stats.balance}
            count={stats.count}
            totalTransactions={txs.length}
            currentBalance={formatBalance(scopedCurrentBalance)}
          />

          {visible.length === 0 ? emptyList : (
            <TransactionDayList
              transactions={visible}
              categories={cats}
              hiddenTransactions={hidden}
              onOpenDetails={openDetails}
              endingBalance={endingBalance}
              showRunningBalance={!hasContentFilter}
              selectedId={detailsTransaction?.id}
            />
          )}
        </div>
      )}

      {/* Detail als Dialog (Desktop) bzw. Bottom-Sheet (Mobil). */}
      <TransactionDetailsModal
        open={detailsOpen}
        onOpenChange={(open) => (open ? setDetailsOpen(true) : closeDetails())}
        transaction={detailsTransaction}
        categories={cats}
        accounts={accounts}
        allTransactions={txs}
        onSave={(id, patch, options) => detailsTransaction && saveDetails(detailsTransaction, id, patch, options)}
        onToggleVisibility={toggleHidden}
        onDelete={(id) => deleteMut.mutate(id)}
        isHidden={detailsTransaction?.id ? hidden.has(detailsTransaction.id) : false}
        isLoading={detailsSaving}
      />

      <TransactionFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ["transactions"] })}
      />
    </div>
  );
}
