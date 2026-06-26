import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Lässt das Icon/Emoji dezent „atmen" (Schweben). Opt-in und still bei
   * `prefers-reduced-motion`. Default aus – bestehende Aufrufer unverändert.
   */
  animated?: boolean;
}

export default function EmptyState({ icon: Icon, emoji, title, description, action, animated = false }: EmptyStateProps) {
  const reduce = useReducedMotion();
  const motion = animated && !reduce;
  // 4s sanftes Schweben; läuft nur bei opt-in und ohne reduced-motion.
  const motionStyle = motion ? { animation: "float-breathe 4s ease-in-out infinite" } : undefined;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
      {emoji ? (
        <div className="mb-3 text-4xl" data-animated={motion} style={motionStyle}>
          {emoji}
        </div>
      ) : Icon ? (
        <Icon className={cn("mb-3 h-10 w-10 text-muted-foreground")} data-animated={motion} style={motionStyle} />
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
