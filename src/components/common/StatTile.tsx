import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "warning" | "brand";

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Kurzer Hinweis unter dem Wert. */
  hint?: ReactNode;
  className?: string;
}

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  warning: "text-warning",
  brand: "text-brand",
};

/**
 * Kompakte Kennzahl-Kachel für 2-/3-spaltige Raster (Status, KPIs). Ruhiger
 * Rahmen, Label oben, große tabellarische Zahl, optionaler Hinweis. Baut auf dem
 * bestehenden .ds-summary-card-Token auf, damit Kacheln überall gleich wirken.
 */
export default function StatTile({ label, value, icon, tone = "default", hint, className }: StatTileProps) {
  return (
    <div className={cn("ds-summary-card", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", toneClass[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
