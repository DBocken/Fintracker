import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { dyadProps } from "@/lib/dyad";

type Props = {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
};

/**
 * Kennzahl als karten-loses Readout (Usability-Audit „Karten sind Aktionen"):
 * Eine KPI hat keine eigene Folgeaktion, daher KEIN Rahmen/Schatten und kein
 * verschachteltes Icon-Kästchen, das fälschlich klickbar wirkt. Stattdessen ein
 * ruhig hinterlegter Block mit großer Zahl. Auswahl/Sortierung passiert zentral
 * über „Dashboard anpassen".
 */
export function KpiCard({ label, value, icon: Icon, hint, className }: Props) {
  return (
    <div {...dyadProps("KpiCard")} className={cn("rounded-xl bg-muted/30 p-4 md:p-5", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">
        {value}
      </div>
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
