import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, ArrowRight, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CoachRecommendation } from "@/types";

const STYLES = {
  danger: { border: "border-red-500/20", bg: "bg-red-500/5", icon: ShieldAlert, iconColor: "text-red-500" },
  warning: { border: "border-amber-500/20", bg: "bg-amber-500/5", icon: AlertTriangle, iconColor: "text-amber-500" },
  success: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", icon: CheckCircle2, iconColor: "text-emerald-500" },
  info: { border: "border-sky-500/20", bg: "bg-sky-500/5", icon: Info, iconColor: "text-sky-500" },
} as const;

export default function CoachFeedCard({ card, index }: { card: CoachRecommendation; index: number }) {
  const style = STYLES[card.severity];
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn("rounded-2xl border bg-card p-4 shadow-sm", style.border, style.bg)}
    >
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