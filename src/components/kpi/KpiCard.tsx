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
 *
 * Kein `shadow-*`: WP-3.5 (Material Token System) hatte hier
 * `shadow-[var(--shadow-ambient)]` ergänzt und damit dem Readout wieder
 * Karten-Chrome gegeben — entgegen AGENTS.md §9 und dem Zweck dieser
 * Komponente. Der `[REGRESSION]`-Test in
 * `src/components/common/__tests__/decard-regression.test.tsx` war seither rot.
 * Tiefe entsteht allein aus der Hintergrund-Tönung, die dort ausdrücklich
 * nicht als Karte zählt.
 */
export function KpiCard({ label, value, icon: Icon, hint, className }: Props) {
  return (
    <div {...dyadProps("KpiCard")} className={cn("rounded-xl bg-muted/30 p-4 md:p-5", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <div
        data-testid="kpi-value"
        className="mt-2 font-semibold tracking-tight tabular-nums"
        style={{ fontSize: 'var(--font-size-headline, 1.25rem)' }}
      >
        {value}
      </div>
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
