import { useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FinancialHealth } from "@/services/financial-health-service";
import { getHealthLabel } from "@/services/financial-health-service";
import { useGentleMode } from "@/components/providers/GentleModeProvider";

function toneColor(tone: "good" | "ok" | "warn" | "bad") {
  switch (tone) {
    case "good":
      return "text-positive";
    case "ok":
      return "text-positive";
    case "warn":
      return "text-warning";
    case "bad":
      return "text-warning";
  }
}

function ringColor(score: number) {
  if (score >= 60) return "hsl(var(--positive))";
  if (score >= 40) return "hsl(var(--brand))";
  return "hsl(var(--warning))";
}

function subScoreColor(score: number) {
  if (score >= 70) return "bg-positive";
  if (score >= 50) return "bg-warning";
  return "bg-warning";
}

export default function HealthScoreCard({ health }: { health: FinancialHealth }) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  const [open, setOpen] = useState(false);
  const { label, tone } = getHealthLabel(health.score);
  const color = ringColor(health.score);

  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (health.score / 100) * circumference;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-brand/10 to-transparent p-5">
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{gentleModeEnabled ? '••' : health.score}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4" />
            Finanzieller Gesundheits-Score
          </div>
          <div className={cn("mt-1 text-xl font-semibold", toneColor(tone))}>{label}</div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Subscores {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t pt-4">
              {health.subScores.map((s) => (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">{gentleModeEnabled ? '••' : s.score}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", subScoreColor(s.score))}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.explanation}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
