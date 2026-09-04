import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDemoDataActive, removeDemoData } from "@/services/demo-data-service";
import { showSuccess } from "@/utils/toast";
import { useI18n } from "@/i18n/useI18n";
import { invalidateFinanceData } from "@/features/shared/data/finance-query-keys";

/**
 * Banner über allen Screens, solange Beispieldaten geladen sind (Issue #39).
 * Klare Kennzeichnung + Ein-Klick-Entfernung — Demo-Daten dürfen sich nie
 * unbemerkt mit echten Daten vermischen.
 */
export default function DemoDataBanner() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  // Über react-query, damit der Banner auch erscheint, wenn die Demo nach
  // dem Mount geladen wird (EmptyState ruft invalidateQueries auf).
  //
  // `initialData` ist hier keine Schätzung, sondern derselbe synchrone Aufruf:
  // `isDemoDataActive()` liest den localStorage, nicht IndexedDB. Ohne ihn
  // liefert `useQuery` im ERSTEN Render `undefined`, der Banner bleibt einen
  // Durchlauf lang leer und schiebt danach die ganze Seite um seine Höhe nach
  // unten — auf `/dashboard` gemessene 41 px und rund ein Viertel des
  // CLS-Budgets, für nichts.
  const { data: active = false } = useQuery({
    queryKey: ["demo-data-active"],
    queryFn: () => isDemoDataActive(),
    initialData: isDemoDataActive,
  });
  const [removing, setRemoving] = useState(false);

  if (!active) return null;

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeDemoData();
      // Finanz-Domäne neu laden — Transaktionen, Konten, Schulden, KPIs
      // (`['demo-data-active']` fällt namentlich mit hinein, DAS lässt den
      // Banner sofort verschwinden). Trading/Haushalt/Sync/Settings sind
      // nachweislich unbetroffen und werden ausgelassen (WP 4.3, PERF-5).
      await invalidateFinanceData(queryClient);
      showSuccess(t('demoData.removeSuccess'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="border-b border-premium/30 bg-premium/10">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:text-sm md:px-8">
        <FlaskConical className="h-4 w-4 shrink-0 text-premium" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{t('demoData.banner')}</span>{" "}
          <span className="text-muted-foreground">
            {t('demoData.description')}{" "}
            <Link to="/csv" className="font-medium text-brand underline-offset-2 hover:underline">
              {t('demoData.csvImportLink')}
            </Link>
            .
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs fokussiert:min-h-11"
          onClick={handleRemove}
          disabled={removing}
        >
          <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {removing ? t('demoData.removing') : t('demoData.removeButton')}
        </Button>
      </div>
    </div>
  );
}
