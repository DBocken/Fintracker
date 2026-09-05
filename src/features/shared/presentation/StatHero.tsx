import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "warning" | "brand";

interface StatHeroProps {
  /** Kleines Label über der Kennzahl (z. B. „Aktueller Kontostand"). */
  label: ReactNode;
  /** Optionales Icon links neben dem Label. */
  icon?: ReactNode;
  /** Die Hauptkennzahl – als bereits formatierter String oder beliebiger Node. */
  value: ReactNode;
  /** Farbton der Kennzahl (Beträge: positive/warning nach Schwelle, siehe lib/delta-color.ts). */
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
  // Karten-los (Usability-Audit „Karten sind Aktionen"): kein Rahmen/Schatten,
  // damit die Hero-Kennzahl nicht fälschlich antippbar wirkt. Der dezente
  // Premium-Verlauf bleibt als ruhige Hauptaussage erhalten.
  return (
    <div
      className={cn(
        // ADR Regel 9: In der fokussierten Dichte keine Boxen. Der Verlauf
        // ist Dekoration — die AUSSAGE ist die Zahl darin, und die bleibt
        // unveraendert gross. In kompakt ordnet der Kasten den Hero gegen
        // die Kacheln daneben; auf einem Telefon steht nichts daneben.
        "overflow-hidden py-2",
        "kompakt:rounded-xl kompakt:bg-gradient-to-br kompakt:from-brand/10",
        "kompakt:via-premium/15 kompakt:to-transparent kompakt:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div
        className={cn("hero-value mt-1 font-bold tracking-tight tabular-nums", toneClass[tone])}
        data-testid="stat-hero-value"
      >
        {value}
      </div>
      {caption && <div className="mt-1 text-sm text-muted-foreground">{caption}</div>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
