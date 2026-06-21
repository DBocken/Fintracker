import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MilestoneStatus } from "@/services/milestones-service";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Meilenstein-Anzeige. `variant="compact"` (Coach) zeigt nur den letzten Erfolg
 * und das nächste erreichbare Ziel; `variant="full"` (eigene Seite) zeigt den
 * kompletten Fortschrittspfad. Animationen laufen nur beim erstmaligen Erreichen
 * und respektieren `prefers-reduced-motion` – kein beschämendes Hervorheben
 * schlechter Werte.
 */
export default function MilestonesStrip({
  milestones,
  variant = "full",
}: {
  milestones: MilestoneStatus[];
  variant?: "full" | "compact";
}) {
  const justAchieved = milestones.filter((m) => m.justAchieved);
  const reduce = useReducedMotion();

  if (variant === "compact") {
    const lastAchieved = [...milestones].reverse().find((m) => m.achieved);
    const nextGoal = milestones.find((m) => !m.achieved);
    const cards = [lastAchieved, nextGoal].filter(Boolean) as MilestoneStatus[];

    return (
      <div className="space-y-4">
        {justAchieved.length > 0 && (
          <motion.div
            initial={reduce ? false : { scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl border border-positive/50 bg-gradient-to-r from-positive/15 to-transparent p-4"
          >
            <div className="text-sm font-semibold text-positive">🎉 Meilenstein erreicht!</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {justAchieved.map((m) => (
                <span key={m.definition.key} className="text-sm">
                  {m.definition.icon} {m.definition.title}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((m) => (
            <div
              key={m.definition.key}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                m.achieved ? "border-positive/40 bg-positive/5" : "border-dashed bg-muted/20"
              )}
            >
              <div className="relative text-2xl">
                {m.definition.icon}
                {!m.achieved && <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {m.achieved ? "Zuletzt erreicht" : "Nächstes Ziel"}
                </div>
                <div className="truncate text-sm font-medium">{m.definition.title}</div>
                {!m.achieved && (
                  <div className="truncate text-xs text-muted-foreground">{m.definition.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {justAchieved.length > 0 && (
        <motion.div
          initial={reduce ? false : { scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-xl border border-positive/50 bg-gradient-to-r from-positive/15 to-transparent p-4"
        >
          <div className="text-sm font-semibold text-positive">🎉 Meilenstein erreicht!</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {justAchieved.map((m) => (
              <span key={m.definition.key} className="text-sm">
                {m.definition.icon} {m.definition.title}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {milestones.map((m, i) => (
          <motion.div
            key={m.definition.key}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { delay: i * 0.04 }}
            className={cn(
              "rounded-lg border p-3 text-center",
              m.achieved ? "border-positive/40 bg-positive/5" : "border-dashed bg-muted/20 opacity-70"
            )}
          >
            <div className="relative text-2xl">
              {m.definition.icon}
              {!m.achieved && (
                <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="mt-1 text-xs font-medium leading-tight">{m.definition.title}</div>
            {!m.achieved && (
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.definition.description}</div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
