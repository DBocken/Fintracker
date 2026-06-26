import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "warning" | "brand";

interface StatHeroProps {
  /** Kleines Label über der Kennzahl (z. B. „Aktueller Kontostand"). */
  label: ReactNode;
  /** Optionales Icon links neben dem Label. */
  icon?: ReactNode;
  /** Die Hauptkennzahl – als bereits formatierter String oder beliebiger Node. */
  value: ReactNode;
  /** Farbton der Kennzahl (Beträge: positive/warning nach Schwelle, siehe delta.ts). */
  tone?: Tone;
  /** Optionaler Delta-/Status-Chip rechts oben. */
  badge?: ReactNode;
  /** Kurze Bildunterschrift unter der Kennzahl. */
  caption?: ReactNode;
  /** Zusätzlicher Inhalt unter der Kennzahl (Chips, Mini-Stats, Sparkline). */
  children?: ReactNode;
  className?: string;
}

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  warning: "text-warning",
  brand: "text-brand",
};

/**
 * Einheitliche „Hero"-Kennzahlkarte für mobile Screens: ein Label, eine große
 * tabellarische Kennzahl und optional ein Status-Chip plus Zusatzinhalt. Bündelt
 * das bisher pro Screen handgebaute Finance-Pulse-/Saldo-Muster an einer Stelle,
 * damit jede Hauptseite mit derselben ruhigen Aussage startet.
 */
export default function StatHero({
  label,
  icon,
  value,
  tone = "default",
  badge,
  caption,
  children,
  className,
}: StatHeroProps) {
  return (
    <Card variant="premium" className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {icon}
            <span className="truncate">{label}</span>
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        <div className={cn("mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl", toneClass[tone])}>
          {value}
        </div>
        {caption && <div className="mt-1 text-sm text-muted-foreground">{caption}</div>}
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}
