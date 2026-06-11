import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CsvUploader } from "@/components/CsvUploader";
import { ReviewTable } from "@/components/ReviewTable";
import { showSuccess } from "@/utils/toast";

export default function CsvPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<unknown[]>([]);
  const [showReview, setShowReview] = useState(false);

  const handleTransactionsLoaded = (txs: unknown[]) => {
    setTransactions(txs);
    setShowReview(true);
  };

  const handleConfirm = () => {
    showSuccess(`${transactions.length} Transaktionen importiert`);
    setShowReview(false);
    navigate("/premium");
  };

  return !showReview ? (
    <CsvUploader onTransactionsLoaded={handleTransactionsLoaded} />
  ) : (
    <ReviewTable transactions={transactions as any[]} onConfirm={handleConfirm} />
  );
}
