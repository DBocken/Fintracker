import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CsvUploader } from "@/components/CsvUploader";
import { ReviewTable } from "@/components/ReviewTable";
import { showSuccess } from "@/utils/toast";
import { useI18n } from "@/i18n/useI18n";

export default function CsvPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<import('../types').Transaction[]>([]);
  const [showReview, setShowReview] = useState(false);

  const handleTransactionsLoaded = (txs: import('../types').Transaction[]) => {
    setTransactions(txs);
    setShowReview(true);
  };

  const handleConfirm = (importedCount: number, skippedCount: number) => {
    const message = skippedCount > 0
      ? t('csv.importedWithSkipped').replace('{imported}', String(importedCount)).replace('{skipped}', String(skippedCount))
      : t('csv.imported').replace('{imported}', String(importedCount));
    showSuccess(message);
    setShowReview(false);
    // Direkt zur Visualisierung (Issue #39): das einfache Sankey auf dem
    // Basis-Dashboard ist der Aha-Moment — frei, ohne Login und Paywall.
    navigate("/dashboard");
  };

  return !showReview ? (
    <CsvUploader onTransactionsLoaded={handleTransactionsLoaded} />
  ) : (
    <ReviewTable transactions={transactions} onConfirm={handleConfirm} />
  );
}
