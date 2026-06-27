import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "warning" | "brand";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  warning: "text-warning",
  brand: "text-brand",
};

interface InfoGroupProps {
  /** Kleiner, ruhiger Titel über der Gruppe (kein Karten-Header). */
  title?: ReactNode;
  /** Optionale Erläuterung unter dem Titel. */
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Karten-lose, gebündelte Anzeige für reine Information OHNE Follow-up
 * (Usability-Audit „Karten sind Aktionen"): kein Rahmen, kein Schatten, keine
 * Elevation — damit nichts fälschlich anklickbar wirkt. Nur ein ruhiger Titel
 * und klar gegliederter Inhalt. Für klickbare Flächen stattdessen
 * `InteractiveCard` verwenden.
 */
export function InfoGroup({ title, description, children, className }: InfoGroupProps) {
  return (
    <section className={cn("space-y-2", className)}>
      {(title || description) && (
        <div>
          {title && <div className="text-sm font-medium text-muted-foreground">{title}</div>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface InfoStat {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}

interface InfoStatStripProps {
  items: InfoStat[];
  className?: string;
}

/**
 * Kennzahlen-Bündel OHNE Karten: mehrere Stats in einem ruhigen, dezent
 * hinterlegten Block (kein Rahmen/Schatten → liest sich als Readout, nicht als
 * antippbare Kachel). Ersetzt Raster aus einzelnen `.ds-summary-card`-Kacheln,
 * wenn die Werte keine eigene Folgeaktion haben. Trennlinien gliedern die Werte
 * klar und präzise.
 */
export function InfoStatStrip({ items, className }: InfoStatStripProps) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4 rounded-xl bg-muted/30 p-4",
        "sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-border/60",
        className,
      )}
    >
      {items.map((s, i) => (
        <div key={i} className="min-w-0 sm:px-4 sm:first:pl-0 sm:last:pr-0">
          <dt className="truncate text-xs text-muted-foreground">{s.label}</dt>
          <dd className={cn("mt-1 text-xl font-semibold tabular-nums", toneClass[s.tone ?? "default"])}>
            {s.value}
          </dd>
          {s.hint && <dd className="mt-0.5 text-xs text-muted-foreground">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
