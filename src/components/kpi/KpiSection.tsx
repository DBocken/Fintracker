"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiCustomizeSheet } from "@/components/kpi/KpiCustomizeSheet";
import { useKpiPreferences } from "@/hooks/useKpiPreferences";
import type { KpiComputeInput } from "@/components/kpi/kpis";
import { dyadProps } from "@/lib/dyad";

export function KpiSection({ data }: { data: KpiComputeInput }) {
  const { prefs, save, reset } = useKpiPreferences();
  const [open, setOpen] = useState(false);

  const orderedActive = useMemo(() => {
    const byOrder = prefs.order.filter((id) => prefs.active.includes(id));
    const missing = prefs.active.filter((id) => !byOrder.includes(id));
    return [...byOrder, ...missing];
  }, [prefs]);

  return (
    <section {...dyadProps("KpiSection")} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Kennzahlen</div>
          <div className="text-xs text-muted-foreground">Wähle KPIs aus und sortiere sie nach Wichtigkeit.</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings2 className="mr-2 h-4 w-4" />
          Dashboard anpassen
        </Button>
      </div>

      {prefs.active.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-6">
          <div className="text-sm font-medium">Keine Kennzahlen ausgewählt</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Wähle mindestens eine Kennzahl aus, damit sie auf dem Dashboard angezeigt wird.
          </div>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            Kennzahlen auswählen
          </Button>
        </div>
      ) : (
        <KpiGrid data={data} order={prefs.order} active={orderedActive} />
      )}

      <KpiCustomizeSheet
        open={open}
        onOpenChange={setOpen}
        value={prefs}
        onSave={save}
        onReset={reset}
      />
    </section>
  );
}