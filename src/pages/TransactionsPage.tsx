import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import FinanceEmptyState from "@/components/common/FinanceEmptyState";
import { useI18n } from "@/i18n/useI18n";
import { useIsWideDesktop } from "@/hooks/useIsWideDesktop";
import { decodeDashboardFilters, encodeDashboardFilters } from "@/components/dashboard/filter-utils";
import { useTransactionsOverview } from "@/features/transactions/application/use-transactions-overview";
import { transactionsKeys } from "@/features/transactions/data/transactions-query-keys";
import { TransactionsDesktopView } from "@/features/transactions/presentation/desktop/TransactionsDesktopView";
import { TransactionsMobileView } from "@/features/transactions/presentation/mobile/TransactionsMobileView";
import type { Transaction } from "@/types";

/**
 * Eigene Buchungsseite (Audit P1.2). Dünner Orchestrator über
 * `useTransactionsOverview()` (`src/features/transactions/`): der Hook trägt
 * Queries, Filterzustand und abgeleitete Werte; hier bleiben nur URL-Sync,
 * Deep-Link, Dialog-/Auswahlzustand und die Seiten-Chrome. Layout: Master-
 * Detail auf großen Screens – links Filter + Kennzahlen + Tagesliste, rechts
 * das Detail als angedocktes Panel (horizontal 1/3 · 2/3), nicht als Overlay.
 * Auf kleinen Screens Liste + Bottom-Sheet.
 *
 * Die Wahl zwischen Desktop-/Mobile-View passiert bewusst per JS
 * (`isWide ? <TransactionsDesktopView/> : <TransactionsMobileView/>`), NICHT
 * über CSS-Dual-Render wie beim Dashboard: die fenstervirtualisierte
 * Tagesliste (bis zu 5000 Buchungen) darf nicht doppelt im DOM stehen.
 * Details: `src/features/transactions/README.md`.
 */
export default function TransactionsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWide = useIsWideDesktop();

  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsTransaction(null);
  };

  const [initialFilters] = useState(() => decodeDashboardFilters(searchParams));
  const model = useTransactionsOverview({ initialFilters, onDetailsSaved: closeDetails });

  // Filteränderungen in die URL spiegeln (replace, kein History-Spam pro
  // Tastendruck). `model.filters.values` ist referenzstabil, solange sich kein
  // Filterfeld ändert (siehe ViewModel-Doku) – keine Sync-Schleife.
  useEffect(() => {
    setSearchParams(encodeDashboardFilters(model.filters.values), { replace: true });
  }, [model.filters.values, setSearchParams]);

  const openDetails = (tx: Transaction) => {
    setDetailsTransaction(tx);
    // Desktop: inline im rechten Panel; sonst als Bottom-Sheet/Overlay.
    setDetailsOpen(!isWide);
  };

  const handleDetailsOpenChange = (open: boolean) => {
    if (open) setDetailsOpen(true);
    else closeDetails();
  };

  const handleSaveDetails = (
    id: string,
    patch: Partial<Transaction>,
    options: { applyToSimilar: boolean; similarIds: string[] },
  ) => {
    if (detailsTransaction) model.actions.saveDetails(detailsTransaction, id, patch, options);
  };

  // Deep-Link `?tx=<id>` (z. B. von /tax): einmalig nach dem Laden der Buchungen
  // das Detail öffnen. Die ID wird im State-Initializer eingefangen, BEVOR der
  // Filter-Sync-Effekt den fremden Param aus der URL entfernt. One-Shot via Ref:
  // auch eine unbekannte/gelöschte ID wird nur einmal gesucht.
  const [deepLinkTxId] = useState<string | null>(() => searchParams.get("tx"));
  const deepLinkConsumedRef = useRef(false);
  useEffect(() => {
    if (deepLinkConsumedRef.current || !deepLinkTxId || model.transactions.all.length === 0) return;
    deepLinkConsumedRef.current = true;
    const target = model.transactions.all.find((candidate) => candidate.id === deepLinkTxId);
    if (target) openDetails(target);
    // openDetails ist stabil genug für den One-Shot (Ref verhindert Re-Runs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTxId, model.transactions.all]);

  return (
    <div className="w-full">
      <PageHeader
        title={t("transactions.title")}
        description={t("transactions.description")}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("forms.addTransaction")}
          </Button>
        }
      />

      {model.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : model.isEmpty ? (
        <FinanceEmptyState />
      ) : isWide ? (
        <TransactionsDesktopView
          model={model}
          detailsTransaction={detailsTransaction}
          onOpenDetails={openDetails}
          onCloseDetails={closeDetails}
          onSaveDetails={handleSaveDetails}
        />
      ) : (
        <TransactionsMobileView
          model={model}
          detailsTransaction={detailsTransaction}
          onOpenDetails={openDetails}
          onSaveDetails={handleSaveDetails}
          detailsOpen={detailsOpen}
          onDetailsOpenChange={handleDetailsOpenChange}
        />
      )}

      <TransactionFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: transactionsKeys.transactionsRoot })}
      />
    </div>
  );
}
