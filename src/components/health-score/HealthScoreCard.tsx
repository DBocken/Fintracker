import { useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FinancialHealth } from "@/services/financial-health-service";
import { getHealthLabel } from "@/services/financial-health-service";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import {
  getStatusBucket,
  statusColorVar,
  statusTextClass,
  statusBgClass,
} from "@/lib/status-bucket";

export default function HealthScoreCard({ health }: { health: FinancialHealth }) {
  const { enabled: gentleModeEnabled } = useGentleMode();
  const [open, setOpen] = useState(false);
  const { label } = getHealthLabel(health.score);
  const bucket = getStatusBucket(health.score);
  const ringColor = statusColorVar(bucket);

  const circumference = 2 * Math.PI * 42;

  // Ring-Sweep und hochzählende Zahl teilen denselben eased Tween wie das
  // Einfüllen des Budget-Tanks; reduced-motion springt direkt auf das Ziel.
  const animatedScore = useAnimatedNumber(health.score);
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div
      className="rounded-xl border bg-gradient-to-br from-brand/10 to-transparent p-5"
      data-health-score={health.score}
    >
      {/* Ganze Kopfzeile klappt die Subscores auf/zu (Usability-Audit „Karten
          sind Aktionen") – die ganze Fläche ist das Disclosure-Ziel. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="health-subscores"
        className="-m-2 flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-5"
      >
        <div className="relative h-20 w-20 shrink-0 sm:h-28 sm:w-28">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums sm:text-2xl">
              {gentleModeEnabled ? '••' : Math.round(animatedScore)}
            </span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4" />
            Finanzieller Gesundheits-Score
          </div>
          <div className={cn("mt-1 text-lg font-semibold sm:text-xl", statusTextClass(bucket))}>{label}</div>
          <span className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-sm text-primary">
            Subscores {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="health-subscores"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t pt-4">
              {health.subScores.map((s) => (
                <SubScoreBar key={s.key} sub={s} gentle={gentleModeEnabled} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Unter-Score-Balken: füllt sich datengetrieben auf (count-up), statt aufzupoppen. */
function SubScoreBar({ sub, gentle }: { sub: FinancialHealth["subScores"][number]; gentle: boolean }) {
  const shown = useAnimatedNumber(sub.score);
  const subBucket = getStatusBucket(sub.score);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{sub.label}</span>
        <span className="tabular-nums text-muted-foreground">{gentle ? "••" : Math.round(shown)}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", statusBgClass(subBucket))} style={{ width: `${shown}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{sub.explanation}</p>
    </div>
  );
}
