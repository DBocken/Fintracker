import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, ArrowRight, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CoachRecommendation } from "@/types";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const STYLES = {
  danger: { border: "border-warning/20", bg: "bg-warning/5", icon: ShieldAlert, iconColor: "text-warning" },
  warning: { border: "border-warning/20", bg: "bg-warning/5", icon: AlertTriangle, iconColor: "text-warning" },
  success: { border: "border-positive/20", bg: "bg-positive/5", icon: CheckCircle2, iconColor: "text-positive" },
  info: { border: "border-brand/20", bg: "bg-brand/5", icon: Info, iconColor: "text-brand" },
} as const;

export default function CoachFeedCard({ card, index, featured }: { card: CoachRecommendation; index: number; featured?: boolean }) {
  const style = STYLES[card.severity];
  const Icon = style.icon;
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { delay: index * 0.05 }}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm",
        style.border,
        style.bg,
        featured && "ring-2 ring-primary/30",
      )}
    >
      {featured && (
        <div className="mb-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          Wichtigste Aktion heute
        </div>
      )}
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconColor)} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{card.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{card.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">{card.reason}</p>
          {card.ctaLabel && card.ctaTo && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to={card.ctaTo}>
                {card.ctaLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}