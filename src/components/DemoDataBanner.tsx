import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDemoDataActive, removeDemoData } from "@/services/demo-data-service";
import { showSuccess } from "@/utils/toast";

/**
 * Banner über allen Screens, solange Beispieldaten geladen sind (Issue #39).
 * Klare Kennzeichnung + Ein-Klick-Entfernung — Demo-Daten dürfen sich nie
 * unbemerkt mit echten Daten vermischen.
 */
export default function DemoDataBanner() {
  const queryClient = useQueryClient();
  // Über react-query, damit der Banner auch erscheint, wenn die Demo nach
  // dem Mount geladen wird (EmptyState ruft invalidateQueries auf).
  const { data: active = false } = useQuery({
    queryKey: ["demo-data-active"],
    queryFn: () => isDemoDataActive(),
  });
  const [removing, setRemoving] = useState(false);

  if (!active) return null;

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeDemoData();
      // Alle Daten-Queries neu laden — Transaktionen, Konten, Schulden, KPIs.
      await queryClient.invalidateQueries();
      showSuccess("Beispieldaten entfernt");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="border-b border-premium/30 bg-premium/10">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:text-sm md:px-8">
        <FlaskConical className="h-4 w-4 shrink-0 text-premium" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Du siehst Beispieldaten.</span>{" "}
          <span className="text-muted-foreground">
            Alles hier geht auch mit deinen echten Daten —{" "}
            <Link to="/csv" className="font-medium text-brand underline-offset-2 hover:underline">
              CSV importieren
            </Link>
            .
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={handleRemove}
          disabled={removing}
        >
          <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {removing ? "Wird entfernt…" : "Beispieldaten entfernen"}
        </Button>
      </div>
    </div>
  );
}
