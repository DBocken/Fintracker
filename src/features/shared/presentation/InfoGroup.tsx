import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "warning" | "brand" | "critical" | "good";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  warning: "text-warning",
  brand: "text-brand",
  critical: "text-destructive",
  good: "text-positive",
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
        "grid gap-x-6 gap-y-4",
        // Kompakt: ein ruhig hinterlegter Block, nebeneinander mit Trennlinien.
        // Auf einem breiten Bildschirm ordnet die Fläche, was nebeneinander
        // liegt — dafür ist der Hintergrund da.
        "kompakt:rounded-xl kompakt:bg-muted/30 kompakt:p-4",
        // Die Spalten folgen der DICHTE, nicht einer Breite. Vorher stand hier
        // `sm:` (640 px) — in der kompakten Dichte ist das immer wahr, denn
        // kompakt beginnt bei 768. Der Breakpoint entschied also nichts und
        // hätte umgekehrt in einer breiten fokussierten Ansicht (Tablet-App)
        // fälschlich gegriffen. Genau davor warnt die ADR: Layout-Schwellen
        // dürfen nie über die Dichte entscheiden.
        "kompakt:grid-flow-col kompakt:auto-cols-fr kompakt:divide-x kompakt:divide-border/60",
        // Fokussiert: KEINE Box. `docs/architecture/darstellungsdichte.md`
        // Regel 9 verbietet Rahmen, Hintergrund und Schatten um Inhalt — auch
        // den weichen. Auf einem Telefon liegt nichts nebeneinander, dort
        // ordnet die Reihenfolge; getrennt wird über Haarlinien.
        "fokussiert:divide-y fokussiert:divide-border/60",
        className,
      )}
    >
      {items.map((s, i) => (
        <div
          key={i}
          className="min-w-0 kompakt:px-4 kompakt:first:pl-0 kompakt:last:pr-0 fokussiert:py-3 fokussiert:first:pt-0 fokussiert:last:pb-0"
        >
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
