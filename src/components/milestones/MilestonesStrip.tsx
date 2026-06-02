"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MilestoneStatus } from "@/services/milestones-service";

export default function MilestonesStrip({ milestones }: { milestones: MilestoneStatus[] }) {
  const justAchieved = milestones.filter((m) => m.justAchieved);

  return (
    <div className="space-y-4">
      {justAchieved.length > 0 && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-500/15 to-transparent p-4"
        >
          <div className="text-sm font-semibold text-emerald-500">🎉 Meilenstein erreicht!</div>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn(
              "rounded-lg border p-3 text-center",
              m.achieved ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed bg-muted/20 opacity-70"
            )}
          >
            <div className="relative text-2xl">
              {m.definition.icon}
              {!m.achieved && (
                <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="mt-1 text-xs font-medium leading-tight">{m.definition.title}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
