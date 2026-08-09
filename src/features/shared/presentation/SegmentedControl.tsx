import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Gleichbreite Segmente, die die volle Breite füllen. Default: true. */
  fill?: boolean;
  size?: "sm" | "md";
  /** Pflicht-Label für die Tablist (a11y). */
  "aria-label": string;
  className?: string;
}

/**
 * Zugängliche Segment-Steuerung (Tablist-Semantik) im Markenton: eine ruhige
 * Schiene, das aktive Segment als helle Karte mit feinem Schatten – konsistent
 * mit den bestehenden Radix-Tabs. Ersetzt die vielen ad-hoc Button-/Select-Reihen
 * (Tag/Woche/Monat, Alle/Ausgaben/Einnahmen …). Rein gesteuert: verändert keine
 * Logik, nur die Darstellung eines bestehenden Zustands.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  fill = true,
  size = "md",
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1 rounded-full bg-muted p-1", fill && "flex w-full", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "inline-flex min-h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "text-xs" : "text-sm",
              fill && "flex-1",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
