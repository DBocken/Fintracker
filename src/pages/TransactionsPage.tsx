import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionTable } from "@/components/dashboard/TransactionTable";
import { TransactionListMobile } from "@/components/dashboard/TransactionListMobile";
import { TransactionDetailsModal } from "@/components/dashboard/TransactionDetailsModal";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";
import {
  getTransactions,
  getCategories,
  updateTransaction,
  deleteTransaction,
} from "@/services/transaction-service";
import { getAccounts } from "@/services/account-service";
import { useTransactionDetailEditing } from "@/hooks/useTransactionDetailEditing";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import type { Transaction, Category, Account } from "@/types";

/**
 * Eigene Buchungsseite (Audit P1.2): Transaktionen sind eine eigene Hauptseite
 * mit kompakten Karten auf Mobile und Tabelle auf Desktop. Die ganze Zeile öffnet
 * das Detail-Sheet (mit Sammeländerung + Undo über den geteilten Hook).
 */
export default function TransactionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: "asc" | "desc" } | null>(null);
  const [hidden, toggleHidden] = usePersistedSet("transactions_hidden");

  const { data: txs = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: () => getTransactions(5000),
  });
  const { data: cats = [] } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: getCategories });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: getAccounts });

  const { save: saveDetails, isPending: detailsSaving } = useTransactionDetailEditing(txs, () =>
    setDetailsOpen(false),
  );

  const categoryMutation = useMutation({
    mutationFn: (updates: { id: string; category_id: string }[]) => updateTransaction(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Kategorie aktualisiert");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaktion gelöscht");
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? txs.filter((t) => `${t.payee} ${t.description} ${t.original_text}`.toLowerCase().includes(q))
      : txs;
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
  }, [txs, search, sortConfig]);

  const handleSort = (key: keyof Transaction) =>
    setSortConfig((prev) =>
      prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );

  const openDetails = (t: Transaction) => {
    setDetailsTransaction(t);
    setDetailsOpen(true);
  };

  return (
    <div>
      <PageHeader title="Buchungen" description="Alle Transaktionen – tippe eine Zeile an, um sie zu bearbeiten." />

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
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buchungen durchsuchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

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
    </div>
  );
}
