import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/common/EmptyState";
import { loadDemoData } from "@/services/demo-data-service";

/**
 * Leerer Zustand der Hauptseiten (Issue #39): nie eine leere Seite —
 * immer eine konkrete nächste Aktion (CSV-Import oder Beispieldaten).
 */
export default function FinanceEmptyState() {
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
      title="Noch keine Transaktionen"
      description="Importiere eine CSV deiner Bank — oder schau dir die App erst mal mit Beispieldaten an. Beides bleibt komplett auf deinem Gerät."
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/csv">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              CSV importieren
            </Link>
          </Button>
          <Button variant="outline" onClick={handleLoadDemo} disabled={loading}>
            <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />
            {loading ? "Wird geladen…" : "Beispieldaten ansehen"}
          </Button>
        </div>
      }
    />
  );
}
