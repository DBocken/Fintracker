import { useState } from "react";
import { motion } from "framer-motion";
import type { FinancialHealth } from "@/services/financial-health-service";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
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
  /** "hero" = Portrait-Illustration (Desktop), "strip" = kompakter Statusstreifen (mobil). */
  variant?: "hero" | "strip";
  className?: string;
}

export default function FinancialLandscape({ health, variant = "hero", className }: FinancialLandscapeProps) {
  const { enabled: gentleMode } = useGentleMode();
  const reduce = useReducedMotion();

  // Kompakter, interaktiver Statusstreifen (Audit C-P0/F): mobil-first,
  // erzwingt kein 9:16-Bild über dem Fold.
  if (variant === "strip") {
    return (
      <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
        {(health?.subScores ?? []).map((s) => {
          const meta = METRICS[s.key];
          if (!meta) return null;
          const bucket = getStatusBucket(s.score);
          return (
            <div
              key={s.key}
              className="flex min-w-[88px] flex-1 shrink-0 flex-col items-center gap-1 rounded-xl border bg-card p-2 text-center shadow-sm"
            >
              <span className="text-lg leading-none" aria-hidden>{meta.emoji}</span>
              <span className="text-[11px] font-medium leading-tight text-muted-foreground">{meta.label}</span>
              <span
                className="text-sm font-bold leading-none"
                style={{ color: statusColorVar(bucket) }}
                title={statusLabel(bucket)}
              >
                {gentleMode ? "••" : s.score}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Hero: Portrait-9:16-Illustration mit positionierten Indikatoren (Desktop).
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
            <MetricIcon file={meta.file} stage={stage} emoji={meta.emoji} size={112} />
            <div
              className="mt-0.5 rounded-lg bg-white/90 px-1.5 py-0.5 text-center shadow backdrop-blur-sm"
              style={{ minWidth: 52 }}
            >
              <div className="text-[8px] font-medium leading-tight text-gray-500">{meta.label}</div>
              <div className="text-xs font-bold leading-tight" style={{ color }}>
                {gentleMode ? "••" : s.score}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
