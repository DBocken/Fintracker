import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import EmptyState from "@/components/common/EmptyState";
import { loadDemoData } from "@/services/demo-data-service";

/**
 * Leerer Zustand der Hauptseiten (Issue #39): nie eine leere Seite —
 * immer eine konkrete nächste Aktion (CSV-Import oder Beispieldaten).
 */
export default function FinanceEmptyState() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      await loadDemoData();
      await queryClient.invalidateQueries();
    } finally {
      setLoading(false);
    }
  };

  return (
    <EmptyState
      emoji="📊"
      title={t("financeEmptyState.title")}
      description={t("financeEmptyState.description")}
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/csv">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("financeEmptyState.csvImportButton")}
            </Link>
          </Button>
          <Button variant="outline" onClick={handleLoadDemo} disabled={loading}>
            <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />
            {loading ? t("financeEmptyState.loadingLabel") : t("financeEmptyState.sampleDataButton")}
          </Button>
        </div>
      }
    />
  );
}
