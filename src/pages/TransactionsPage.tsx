import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionTable } from "@/components/dashboard/TransactionTable";
import { TransactionListMobile } from "@/components/dashboard/TransactionListMobile";
import { TransactionDetailsModal } from "@/components/dashboard/TransactionDetailsModal";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";
import { useI18n } from "@/i18n/useI18n";
import {
  getTransactions,
  getCategories,
  updateTransaction,
  deleteTransaction,
} from "@/services/transaction-service";
import { getAccounts } from "@/services/account-service";
import { getContractDecisionMap, type ContractDecision } from "@/services/contract-decision-service";
import { decodeDashboardFilters, filterTransactions } from "@/components/dashboard/filter-utils";
import { DEFAULT_DASHBOARD_FILTERS } from "@/components/dashboard/filter-constants";
import { useTransactionDetailEditing } from "@/hooks/useTransactionDetailEditing";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import type { Transaction, Category, Account } from "@/types";

/**
 * Eigene Buchungsseite (Audit P1.2): Transaktionen sind eine eigene Hauptseite
 * mit kompakten Karten auf Mobile und Tabelle auf Desktop. Die ganze Zeile öffnet
 * das Detail-Sheet (mit Sammeländerung + Undo über den geteilten Hook).
 */
export default function TransactionsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // Filter aus der URL (Übergabe vom Dashboard, Audit P1.3). Die Suche bleibt
  // interaktiv und wird aus dem URL-Parameter vorbelegt.
  const urlFilters = useMemo(() => decodeDashboardFilters(searchParams), [searchParams]);
  const [search, setSearch] = useState(urlFilters.search);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: "asc" | "desc" } | null>(null);
  const [hidden, toggleHidden] = usePersistedSet("transactions_hidden");

  const hasUrlFilters =
    urlFilters.category !== DEFAULT_DASHBOARD_FILTERS.category ||
    urlFilters.account !== DEFAULT_DASHBOARD_FILTERS.account ||
    urlFilters.contract !== DEFAULT_DASHBOARD_FILTERS.contract ||
    urlFilters.essential !== DEFAULT_DASHBOARD_FILTERS.essential ||
    urlFilters.ausgabenklasse !== DEFAULT_DASHBOARD_FILTERS.ausgabenklasse ||
    urlFilters.range !== DEFAULT_DASHBOARD_FILTERS.range;

  const { data: txs = [], isLoading } = useQuery<Transaction[]>({
    // Limit im Query-Key (F-PERF-3) gegen Cache-Kollision mit dem 1000er-Load.
    queryKey: ["transactions", 5000],
    queryFn: () => getTransactions(5000),
  });
  const { data: cats = [] } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: getCategories });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: getAccounts });
  const { data: contractDecisions = new Map<string, ContractDecision>() } = useQuery({
    queryKey: ["contract-decisions"],
    queryFn: getContractDecisionMap,
  });

  const { save: saveDetails, isPending: detailsSaving } = useTransactionDetailEditing(txs, () =>
    setDetailsOpen(false),
  );

  const categoryMutation = useMutation({
    mutationFn: (updates: { id: string; category_id: string }[]) => updateTransaction(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("dashboard.categoriesUpdated"));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("dashboard.transactionDeleted"));
    },
  });

  const filtered = useMemo(() => {
    // Vollständige Dashboard-Filter aus der URL anwenden; die Suche kommt aus
    // dem interaktiven Feld (überschreibt den URL-Suchwert).
    let list = filterTransactions(
      txs,
      cats,
      accounts,
      { ...urlFilters, search },
      new Date(),
      contractDecisions,
    );
    if (sortConfig) {
      const { key, direction } = sortConfig;
      list = [...list].sort((a, b) => {
        const av = a[key] ?? "";
        const bv = b[key] ?? "";
        if (av < bv) return direction === "asc" ? -1 : 1;
        if (av > bv) return direction === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      list = [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    return list;
  }, [txs, cats, accounts, urlFilters, search, sortConfig, contractDecisions]);

  const clearUrlFilters = () => {
    setSearch("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleSort = (key: keyof Transaction) =>
    setSortConfig((prev) =>
      prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );

  const openDetails = (t: Transaction) => {
    setDetailsTransaction(t);
    setDetailsOpen(true);
  };

  return (
    <div className="mx-auto max-w-2xl lg:max-w-none">
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
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("transactions.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-full pl-10"
            />
          </div>

          {hasUrlFilters && (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>Gefilterte Ansicht aus dem Dashboard.</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearUrlFilters}>
                <X className="h-3.5 w-3.5" />
                Filter aufheben
              </Button>
            </div>
          )}

          {/* Mobile: kompakte Karten */}
          <div className="lg:hidden">
            <TransactionListMobile
              transactions={filtered}
              categories={cats}
              selected={new Set()}
              hiddenTransactions={hidden}
              onSelect={() => {}}
              onOpenDetails={openDetails}
            />
          </div>

          {/* Desktop: Tabelle */}
          <div className="hidden lg:block">
            <TransactionTable
              transactions={filtered}
              categories={cats}
              selected={new Set()}
              hiddenTransactions={hidden}
              sortConfig={sortConfig}
              onSelect={() => {}}
              onToggleVisibility={toggleHidden}
              onUpdateCategory={(id, categoryId) => categoryMutation.mutate([{ id, category_id: categoryId }])}
              onDelete={(id) => deleteMut.mutate(id)}
              onSort={handleSort}
              onOpenDetails={openDetails}
            />
          </div>
        </div>
      )}

      <TransactionDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
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
