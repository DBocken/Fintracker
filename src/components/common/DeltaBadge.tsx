import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deltaTone,
  deltaToneClass,
  relativeDelta,
  type DeltaToneOptions,
} from "@/lib/delta-color";

interface DeltaBadgeProps {
  current: number;
  previous: number;
  /** Anzeige als Prozent (Default) oder als absolute Differenz (via `formatAbsolute`). */
  format?: "percent" | "absolute";
  /** Formatter für die absolute Differenz (z. B. EUR). Nur bei format="absolute". */
  formatAbsolute?: (diff: number) => string;
  options?: DeltaToneOptions;
  className?: string;
}

/**
 * Schwellwertbewusster Veränderungs-Chip (Design-System #54): kleine Deltas
 * bleiben neutral („+5 % ist kein Alarm"), größere werden richtungs- und
 * schwellwertabhängig eingefärbt (siehe lib/delta-color.ts). Pfeil zeigt die
 * Richtung; neutral → waagerecht, kein Alarm-Ton.
 */
export default function DeltaBadge({
  current,
  previous,
  format = "percent",
  formatAbsolute,
  options,
  className,
}: DeltaBadgeProps) {
  const tone = deltaTone(current, previous, options);
  const rel = relativeDelta(current, previous);
  const diff = current - previous;

  const Arrow = tone === "neutral" ? Minus : diff > 0 ? ArrowUp : ArrowDown;

  let text: string;
  if (format === "absolute") {
    const fmt = formatAbsolute ?? ((d: number) => `${d > 0 ? "+" : ""}${Math.round(d)}`);
    text = fmt(diff);
  } else if (!Number.isFinite(rel)) {
    text = "neu";
  } else {
    const pct = Math.round(rel * 100);
    text = `${pct > 0 ? "+" : ""}${pct} %`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        deltaToneClass(tone),
        className,
      )}
    >
      <Arrow className="h-3 w-3 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}
