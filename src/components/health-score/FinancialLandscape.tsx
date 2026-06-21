import { useState } from "react";
import { motion } from "framer-motion";
import type { FinancialHealth } from "@/services/financial-health-service";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getStatusBucket,
  getStatusStage,
  statusColorVar,
  statusLabel,
} from "@/lib/status-bucket";
import { cn } from "@/lib/utils";

type MetricMeta = {
  top: string;
  left: string;
  file: string;
  label: string;
  /** Emoji-Metapher als Fallback, falls die PNG (noch) fehlt — Audit G. */
  emoji: string;
};

// Positionen für das Portrait-9:16-Bild (Hero). Emoji = Fallback-Metapher.
const METRICS: Record<string, MetricMeta> = {
  emergency_fund: { top: "22%", left: "48%", file: "notgroschen", label: "Notgroschen", emoji: "🛡️" },
  debt:           { top: "35%", left: "5%",  file: "schulden",    label: "Schulden",    emoji: "🎒" },
  savings_rate:   { top: "50%", left: "50%", file: "sparquote",   label: "Sparquote",   emoji: "🌱" },
  liquidity:      { top: "60%", left: "1%",  file: "liquiditaet", label: "Liquidität",  emoji: "💧" },
  contracts:      { top: "70%", left: "38%", file: "vertraege",   label: "Verträge",    emoji: "🗂️" },
};

/** Asset-Indikator mit Emoji-Fallback bei fehlender PNG (kein Broken-Image). */
function MetricIcon({ file, stage, emoji, size }: { file: string; stage: number; emoji: string; size: number }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        style={{ width: size, height: size, fontSize: size * 0.6 }}
        className="flex items-center justify-center"
        aria-hidden
      >
        {emoji}
      </div>
    );
  }
  return (
    <img
      src={`/assets/illustrations/${file}${stage - 1}.png`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setBroken(true)}
      draggable={false}
    />
  );
}

interface FinancialLandscapeProps {
  health?: FinancialHealth;
  /**
   * "hero" = Portrait-Illustration (volle Größe, Desktop),
   * "hero-compact" = dieselbe Illustration mobil-tauglich verkleinert,
   * "strip" = kompakter Statusstreifen.
   */
  variant?: "hero" | "hero-compact" | "strip";
  className?: string;
}

/**
 * Bottom-Sheet mit Erklärung/Status einer Metrik. Wiederverwendet von Strip-
 * Kacheln und den antippbaren Hotspots der Illustration (Progressive Disclosure).
 */
function MetricDetailSheet({
  meta,
  score,
  explanation,
  gentleMode,
  children,
}: {
  meta: MetricMeta;
  score: number;
  explanation: string;
  gentleMode: boolean;
  children: React.ReactNode;
}) {
  const bucket = getStatusBucket(score);
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span aria-hidden>{meta.emoji}</span>
            {meta.label}
          </SheetTitle>
          <SheetDescription>
            Status: <span style={{ color: statusColorVar(bucket) }}>{statusLabel(bucket)}</span>
            {!gentleMode && ` · ${score}/100`}
          </SheetDescription>
        </SheetHeader>
        <p className="mt-4 text-sm text-muted-foreground">{explanation}</p>
      </SheetContent>
    </Sheet>
  );
}

export default function FinancialLandscape({ health, variant = "hero", className }: FinancialLandscapeProps) {
  const { enabled: gentleMode } = useGentleMode();
  const reduce = useReducedMotion();
  const isCompact = variant === "hero-compact";
  const iconSize = isCompact ? 72 : 112;

  // Kompakter, interaktiver Status-Raster (Audit C-P0/F): mobil-first, kein
  // horizontales Scrollen mehr. Jede Kachel ist ein vollwertiges Touch-Ziel und
  // öffnet ein Bottom-Sheet mit Erklärung und Status (Progressive Disclosure).
  if (variant === "strip") {
    const subs = (health?.subScores ?? []).filter((s) => METRICS[s.key]);
    return (
      <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-5", className)}>
        {subs.map((s) => {
          const meta = METRICS[s.key];
          const bucket = getStatusBucket(s.score);
          return (
            <MetricDetailSheet key={s.key} meta={meta} score={s.score} explanation={s.explanation} gentleMode={gentleMode}>
              <button
                type="button"
                className="flex min-h-[44px] flex-col items-center gap-1 rounded-xl border bg-card p-2 text-center shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-lg leading-none" aria-hidden>{meta.emoji}</span>
                <span className="text-[11px] font-medium leading-tight text-muted-foreground">{meta.label}</span>
                <span
                  className="text-sm font-bold leading-none"
                  style={{ color: statusColorVar(bucket) }}
                >
                  {gentleMode ? "••" : s.score}
                </span>
              </button>
            </MetricDetailSheet>
          );
        })}
      </div>
    );
  }

  // Hero: Portrait-9:16-Illustration mit positionierten, antippbaren Indikatoren.
  // "hero-compact" rendert dieselbe Illustration mit kleineren Hotspots für mobil.
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl shadow-lg", className)}
      style={{ paddingBottom: "177%" }}
    >
      <img
        src="/assets/illustrations/background.png"
        alt="Finanzlandschaft"
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "cover", objectPosition: "center center" }}
        draggable={false}
      />

      {health && health.subScores.map((s, i) => {
        const meta = METRICS[s.key];
        if (!meta) return null;
        const stage = getStatusStage(s.score);
        const bucket = getStatusBucket(s.score);
        const color = statusColorVar(bucket);

        return (
          <motion.div
            key={s.key}
            className="absolute flex flex-col items-center"
            style={{ top: meta.top, left: meta.left }}
            initial={reduce ? false : { scale: 0.6, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { delay: 0.15 * i + 0.2, type: "spring", stiffness: 180 }}
          >
            <MetricDetailSheet meta={meta} score={s.score} explanation={s.explanation} gentleMode={gentleMode}>
              <button
                type="button"
                aria-label={`${meta.label}: Details ansehen`}
                className="flex flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MetricIcon file={meta.file} stage={stage} emoji={meta.emoji} size={iconSize} />
                <div
                  className="mt-0.5 rounded-lg bg-white/90 px-1.5 py-0.5 text-center shadow backdrop-blur-sm"
                  style={{ minWidth: isCompact ? 44 : 52 }}
                >
                  <div className="text-[8px] font-medium leading-tight text-gray-500">{meta.label}</div>
                  <div className="text-xs font-bold leading-tight" style={{ color }}>
                    {gentleMode ? "••" : s.score}
                  </div>
                </div>
              </button>
            </MetricDetailSheet>
          </motion.div>
        );
      })}
    </div>
  );
}
