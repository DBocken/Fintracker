import { useMemo } from "react";
import { motion } from "framer-motion";
import type { FinancialHealth } from "@/services/financial-health-service";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useI18n } from "@/i18n/useI18n";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getStatusBucket, statusColorVar, statusLabel } from "@/lib/status-bucket";
import { cn } from "@/lib/utils";
import DynamicLandscape from "./DynamicLandscape";
import { buildLandscapeScene, SCENE_HOTSPOTS } from "./landscape-scene";

type MetricMeta = {
  label: string;
  /** Emoji-Metapher für Strip-Kacheln und Sheet-Titel. */
  emoji: string;
};

// Emoji = kompakte Metapher (Strip/Sheet). Labels kommen aus useI18n; die
// Hotspot-Positionen der Hero-Illustration liegen in SCENE_HOTSPOTS beim
// generativen Szenen-Modell.
const METRICS_BASE: Record<string, Omit<MetricMeta, "label"> & { labelKey: string }> = {
  emergency_fund: { labelKey: "health.emergencyFund", emoji: "🛡️" },
  debt:           { labelKey: "health.debt", emoji: "🎒" },
  savings_rate:   { labelKey: "health.savingsRate", emoji: "🌱" },
  liquidity:      { labelKey: "health.liquidity", emoji: "💧" },
  contracts:      { labelKey: "health.contracts", emoji: "🗂️" },
};

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
  const { t } = useI18n();
  const { enabled: gentleMode } = useGentleMode();
  const reduce = useReducedMotion();
  const isCompact = variant === "hero-compact";
  const scene = useMemo(() => buildLandscapeScene(health), [health]);

  const METRICS: Record<string, MetricMeta> = useMemo(() => {
    const baseLabels = {
      emergency_fund: t("health.emergencyFund", "Notgroschen"),
      debt: t("health.debt", "Schulden"),
      savings_rate: t("health.savingsRate", "Sparquote"),
      liquidity: t("health.liquidity", "Liquidität"),
      contracts: t("health.contracts", "Verträge"),
    };

    return Object.entries(METRICS_BASE).reduce((acc, [key, meta]) => {
      acc[key] = { ...meta, label: baseLabels[key as keyof typeof baseLabels] || key };
      return acc;
    }, {} as Record<string, MetricMeta>);
  }, [t]);

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

  // Hero: komplett generativ gezeichnete Portrait-9:16-Szene (kein Bild-Asset).
  // Jede Metrik formt ihr Landschaftselement; die Hotspots liegen deckungsgleich
  // darüber und öffnen das Detail-Sheet. "hero-compact" = kleinere Hotspots.
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl shadow-lg", className)}
      style={{ paddingBottom: "177%" }}
    >
      <DynamicLandscape
        scene={scene}
        label={t("health.landscapeAlt", "Finanzlandschaft")}
        className="absolute inset-0 h-full w-full"
      />

      {health && health.subScores.map((s, i) => {
        const meta = METRICS[s.key];
        const hotspot = SCENE_HOTSPOTS[s.key as keyof typeof SCENE_HOTSPOTS];
        if (!meta || !hotspot) return null;
        const bucket = getStatusBucket(s.score);
        const color = statusColorVar(bucket);

        return (
          <motion.div
            key={s.key}
            className="absolute flex flex-col items-center"
            style={{ top: hotspot.top, left: hotspot.left }}
            initial={reduce ? false : { scale: 0.6, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { delay: 0.15 * i + 0.2, type: "spring", stiffness: 180 }}
          >
            <MetricDetailSheet meta={meta} score={s.score} explanation={s.explanation} gentleMode={gentleMode}>
              <button
                type="button"
                aria-label={`${meta.label}: Details ansehen`}
                className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div
                  className="rounded-lg bg-white/90 px-1.5 py-0.5 text-center shadow backdrop-blur-sm"
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
